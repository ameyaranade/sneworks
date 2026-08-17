import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import type { ChatMessage, ChatSession } from '../types';

// The chat agent's Firestore surface (functions/src/ai/assistantAgent.ts). The
// client only creates the session and appends USER messages; assistant messages
// (and toolActivity) are written by the Cloud Function via the Admin SDK.

// ─── Collection helpers ────────────────────────────────────────────────────────

function sessionsCol(uid: string) {
  return collection(db, 'users', uid, 'chatSessions');
}

function sessionDoc(uid: string, sid: string) {
  return doc(db, 'users', uid, 'chatSessions', sid);
}

function messagesCol(uid: string, sid: string) {
  return collection(db, 'users', uid, 'chatSessions', sid, 'messages');
}

// ─── Session lifecycle ──────────────────────────────────────────────────────────

/** Returns the most-recent session id, creating one if the user has none yet. */
export async function ensureChatSession(uid: string): Promise<string> {
  const recent = await getDocs(query(sessionsCol(uid), orderBy('updatedAt', 'desc'), limit(1)));
  if (!recent.empty) return recent.docs[0].id;
  const ref = await addDoc(sessionsCol(uid), {
    status: 'idle',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Live subscription to a session doc (status drives the UI thinking-indicator). */
export function subscribeToSession(uid: string, sid: string, cb: (s: ChatSession | null) => void): Unsubscribe {
  return onSnapshot(sessionDoc(uid, sid), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChatSession) : null);
  });
}

// ─── Messages ────────────────────────────────────────────────────────────────

/** Live subscription to a session's messages, oldest first. */
export function subscribeToMessages(uid: string, sid: string, cb: (m: ChatMessage[]) => void): Unsubscribe {
  return onSnapshot(query(messagesCol(uid, sid), orderBy('createdAt', 'asc')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  });
}

/** Appends a user message — the trigger that runs the agent. */
export async function sendUserMessage(uid: string, sid: string, content: string): Promise<void> {
  await addDoc(messagesCol(uid, sid), {
    role: 'user',
    content,
    createdAt: serverTimestamp(),
  });
  await setDoc(sessionDoc(uid, sid), { updatedAt: serverTimestamp() }, { merge: true });
}

// ─── Proposed actions (Phase 2 approval gate) ───────────────────────────────────

/** Approve or reject a destructive proposal — a plain owner write that the
 *  `resumeAgent` Cloud Function reacts to (executes on approve, acknowledges on reject). */
export async function resolveProposedAction(
  uid: string,
  sid: string,
  aid: string,
  status: 'approved' | 'rejected',
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'chatSessions', sid, 'proposedActions', aid), { status });
}

// ─── Erase (account-erase cascade; see userDataRegistry.ts) ─────────────────────

const BATCH_LIMIT = 400;

/** Deletes every session plus its messages/proposedActions subcollections. */
export async function eraseAllChatSessions(uid: string): Promise<void> {
  const sessions = await getDocs(sessionsCol(uid));
  for (const session of sessions.docs) {
    for (const sub of ['messages', 'proposedActions']) {
      const subSnap = await getDocs(collection(db, 'users', uid, 'chatSessions', session.id, sub));
      let batch = writeBatch(db);
      let pending = 0;
      for (const d of subSnap.docs) {
        batch.delete(d.ref);
        if (++pending === BATCH_LIMIT) { await batch.commit(); batch = writeBatch(db); pending = 0; }
      }
      if (pending > 0) await batch.commit();
    }
    await deleteDoc(session.ref);
  }
}
