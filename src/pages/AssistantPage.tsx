import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Wand2, Wrench, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useChatStore } from '../stores/useChatStore';
import { useToast } from '../shared/components/Toast';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import EmptyState from '../components/primitives/EmptyState';
import type { ChatMessage, ProposedAction, ToolActivity } from '../types';
import './assistant-page.css';

function ToolChips({ activity }: { activity: ToolActivity[] }) {
  return (
    <div className="sn-assistant-tools">
      {activity.map((a, i) => (
        <span
          key={i}
          className={`sn-assistant-tool-chip${a.status === 'error' ? ' sn-assistant-tool-chip--error' : ''}`}
        >
          {a.status === 'error' ? <AlertTriangle size={11} strokeWidth={2} /> : <Wrench size={11} strokeWidth={2} />}
          {a.summary}
        </span>
      ))}
    </div>
  );
}

function ApprovalCard({
  action,
  onApprove,
  onReject,
  busy,
}: {
  action: ProposedAction;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <div className="sn-assistant-approval" role="group" aria-label="Confirm destructive action">
      <div className="sn-assistant-approval__head">
        <ShieldAlert size={15} strokeWidth={2} />
        <span>Confirm this action</span>
      </div>
      <p className="sn-assistant-approval__summary">{action.summary}</p>
      <p className="sn-assistant-approval__note">This can't be undone.</p>
      <div className="sn-assistant-approval__actions">
        <button
          type="button"
          className="sn-assistant-approval__btn sn-assistant-approval__btn--cancel"
          onClick={onReject}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="sn-assistant-approval__btn sn-assistant-approval__btn--confirm"
          onClick={onApprove}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`sn-assistant-msg sn-assistant-msg--${isUser ? 'user' : 'assistant'}`}>
      {!isUser && message.toolActivity && message.toolActivity.length > 0 && (
        <ToolChips activity={message.toolActivity} />
      )}
      <div className="sn-assistant-bubble">{message.content}</div>
    </div>
  );
}

export default function AssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid ?? getCachedUid();

  const messages = useChatStore((s) => s.messages);
  const proposedActions = useChatStore((s) => s.proposedActions);
  const thinking = useChatStore((s) => s.thinking);
  const init = useChatStore((s) => s.init);
  const send = useChatStore((s) => s.send);
  const resolveAction = useChatStore((s) => s.resolveAction);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pendingActions = proposedActions.filter((a) => a.status === 'pending');

  const handleResolve = async (aid: string, status: 'approved' | 'rejected') => {
    if (!uid || resolvingId) return;
    setResolvingId(aid);
    try {
      await resolveAction(uid, aid, status);
    } catch {
      showToast('Could not update. Try again.', 'error');
      setResolvingId(null);
    }
  };

  useEffect(() => {
    if (!uid) return;
    let cleanup: (() => void) | undefined;
    init(uid).then((unsub) => { cleanup = unsub; }).catch(console.error);
    return () => cleanup?.();
  }, [uid, init]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, pendingActions.length]);

  // Once a resolving proposal leaves the pending set, clear the busy lock.
  useEffect(() => {
    if (resolvingId && !pendingActions.some((a) => a.id === resolvingId)) setResolvingId(null);
  }, [pendingActions, resolvingId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!uid || !text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await send(uid, text);
    } catch {
      showToast('Could not send. Try again.', 'error');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sn-assistant-page">
      <DetailPageHeader onBack={() => navigate('/more')} title="Assistant" />

      <div className="sn-assistant-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <EmptyState
            glyph={<Wand2 size={28} strokeWidth={1.6} />}
            title="Ask me about your tasks"
            sub="I can look things up, add todos and logs, and organize your lists and projects. Try “what's overdue?” or “add milk to my groceries.”"
          />
        ) : (
          <div className="sn-assistant-thread">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {pendingActions.map((a) => (
              <ApprovalCard
                key={a.id}
                action={a}
                busy={resolvingId === a.id}
                onApprove={() => handleResolve(a.id!, 'approved')}
                onReject={() => handleResolve(a.id!, 'rejected')}
              />
            ))}
            {thinking && (
              <div className="sn-assistant-msg sn-assistant-msg--assistant">
                <div className="sn-assistant-bubble sn-assistant-bubble--thinking" aria-label="Assistant is thinking">
                  <span className="sn-assistant-dot" />
                  <span className="sn-assistant-dot" />
                  <span className="sn-assistant-dot" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sn-assistant-composer">
        <textarea
          className="sn-assistant-input"
          placeholder="Message the assistant…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          rows={1}
          maxLength={2000}
        />
        <button
          type="button"
          className="sn-assistant-send"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
