import { create } from 'zustand';
import type { ChatMessage, ChatSessionStatus, ProposedAction } from '../types';
import {
  ensureChatSession,
  subscribeToSession,
  subscribeToMessages,
  sendUserMessage,
  resolveProposedAction,
} from '../firebase/chatQueries';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { cacheKey, readCache, writeCache } from '../utils';
import { getCachedUid } from '../auth/AuthContext';

// Mirrors the other Zustand stores (cache-seed → Firestore subscription). Unlike
// todos/logs/groups, the assistant store is a SINGLE-session model: it resolves
// one active chat session per user and subscribes to its messages. proposedActions
// are wired now but only populated once the Phase 2 approval gate ships.

const CACHE_KEY = 'chat';

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  proposedActions: ProposedAction[];
  status: ChatSessionStatus;
  loaded: boolean;
  /** True while the agent is working on the latest user turn. */
  thinking: boolean;

  /** Resolve/create the session and subscribe. Returns an unsubscribe. */
  init: (uid: string) => Promise<() => void>;
  send: (uid: string, text: string) => Promise<void>;
  /** Approve/reject a destructive proposal (Phase 2 gate). */
  resolveAction: (uid: string, aid: string, status: 'approved' | 'rejected') => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => {
  const cachedUid = getCachedUid();
  const initialMessages = cachedUid ? readCache<ChatMessage[]>(cacheKey(cachedUid, CACHE_KEY)) ?? [] : [];

  return {
    sessionId: null,
    messages: initialMessages,
    proposedActions: [],
    status: 'idle',
    loaded: initialMessages.length > 0,
    thinking: false,

    init: async (uid: string) => {
      const sid = await ensureChatSession(uid);
      set({ sessionId: sid });

      const unsubMessages = subscribeToMessages(uid, sid, (messages) => {
        set({ messages, loaded: true });
        writeCache(cacheKey(uid, CACHE_KEY), messages);
        // Stop the local thinking indicator once an assistant reply lands.
        if (messages[messages.length - 1]?.role === 'assistant') set({ thinking: false });
      });

      const unsubSession = subscribeToSession(uid, sid, (session) => {
        if (session) set({ status: session.status });
      });

      const paCol = collection(db, 'users', uid, 'chatSessions', sid, 'proposedActions');
      const unsubActions = onSnapshot(query(paCol, orderBy('createdAt', 'asc')), (snap) => {
        set({ proposedActions: snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProposedAction)) });
      });

      return () => { unsubMessages(); unsubSession(); unsubActions(); };
    },

    send: async (uid: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      let sid = get().sessionId;
      if (!sid) {
        sid = await ensureChatSession(uid);
        set({ sessionId: sid });
      }
      set({ thinking: true });
      try {
        await sendUserMessage(uid, sid, trimmed);
      } catch (err) {
        set({ thinking: false });
        throw err;
      }
    },

    resolveAction: async (uid: string, aid: string, status: 'approved' | 'rejected') => {
      const sid = get().sessionId;
      if (!sid) return;
      // resumeAgent posts the outcome as an assistant message → show thinking.
      set({ thinking: true });
      try {
        await resolveProposedAction(uid, sid, aid, status);
      } catch (err) {
        set({ thinking: false });
        throw err;
      }
    },
  };
});
