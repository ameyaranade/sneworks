import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { ChevronLeft, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useEntriesStore } from '../stores/useEntriesStore';
import { useTypesStore } from '../stores/useTypesStore';
import { subscribeToEntriesByGroup } from '../firebase/loggerQueries';
import EntryList from '../components/composites/EntryList';
import type { Entry } from '../types';
import './group-detail-page.css';

// Maps group kind to the built-in type name best suited for quick-add
const QUICK_ADD_TYPE: Record<string, string> = {
  list: 'Shopping',
  project: 'Task',
  routine: 'Habit',
};

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const groups = useGroupsStore((s) => s.groups);
  const addEntry = useEntriesStore((s) => s.addEntry);
  const types = useTypesStore((s) => s.types);

  const group = groups.find((g) => g.id === groupId);

  // Bug 6 fix: subscribe directly to group entries (no 90-day cutoff)
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    const unsub = subscribeToEntriesByGroup(user.uid, groupId, (fetched) => {
      setEntries(fetched);
      setEntriesLoaded(true);
    });
    return unsub;
  }, [user, groupId]);

  const pending = entries.filter((e) => e.kind === 'todo' && e.status === 'pending');
  const done = entries.filter((e) => e.kind === 'todo' && e.status === 'done');
  const logs = entries.filter((e) => e.kind === 'log');

  // Bug 9 fix: inline quick-add state
  const [quickInput, setQuickInput] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuickAdd = useCallback(async () => {
    const text = quickInput.trim();
    if (!text || !user || !groupId || !group) return;

    const typeName = QUICK_ADD_TYPE[group.kind] ?? 'Task';
    const matchedType = types.find((t) => t.name === typeName) ?? types[0];
    if (!matchedType) return;

    setQuickAdding(true);
    try {
      await addEntry(user.uid, {
        kind: 'todo',
        typeId: matchedType.id!,
        title: text,
        data: {},
        dueAt: Timestamp.now(),
        status: 'pending',
        groupId,
        groupPath: [group.name],
        sortOrder: Date.now(),
        source: 'quick-add',
      });
      setQuickInput('');
      inputRef.current?.focus();
    } catch {
      showToast('Failed to add item.', 'error');
    } finally {
      setQuickAdding(false);
    }
  }, [quickInput, user, groupId, group, types, addEntry, showToast]);

  if (!group) {
    return (
      <div className="lg-group-detail-page">
        <p className="lg-group-not-found">Group not found.</p>
      </div>
    );
  }

  const stripeColor =
    group.kind === 'project'
      ? 'var(--lg-gold)'
      : group.kind === 'routine'
      ? 'var(--lg-purple)'
      : 'var(--lg-accent)';

  return (
    <div className="lg-group-detail-page">
      <div className="lg-group-detail-header">
        <button type="button" className="lg-group-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <div className="lg-group-detail-title-wrap">
          <h1
            className="lg-group-detail-title"
            style={{ color: stripeColor }}
          >
            {group.name}
          </h1>
          <span className="lg-group-detail-kind">{group.kind}</span>
        </div>
      </div>

      {/* Aggregation strip */}
      {group.childCount > 0 && (
        <div className="lg-group-detail-agg">
          {group.showProgress && (
            <div className="lg-group-detail-stat">
              <span className="lg-gd-stat-value">{group.doneCount}/{group.childCount}</span>
              <span className="lg-gd-stat-label">done</span>
              <div className="lg-gd-progress-track">
                <div
                  className="lg-gd-progress-fill"
                  style={{ width: `${group.childCount > 0 ? (group.doneCount / group.childCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {group.showSumMoney && group.totalSpent > 0 && (
            <div className="lg-group-detail-stat">
              <span className="lg-gd-stat-value">₹{group.totalSpent.toLocaleString('en-IN')}</span>
              <span className="lg-gd-stat-label">spent</span>
            </div>
          )}
        </div>
      )}

      {/* Bug 9: inline quick-add input */}
      <div className="lg-group-quick-add">
        <input
          ref={inputRef}
          type="text"
          className="lg-group-quick-add-input"
          placeholder={`Add item to ${group.name}…`}
          value={quickInput}
          disabled={quickAdding}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
        />
        <button
          type="button"
          className="lg-group-quick-add-btn"
          onClick={handleQuickAdd}
          disabled={!quickInput.trim() || quickAdding}
          aria-label="Add item"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="lg-group-detail-content">
        {!entriesLoaded ? (
          <div className="lg-group-empty">Loading…</div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="lg-group-detail-section">
                <div className="lg-group-section-header">To do · {pending.length}</div>
                <EntryList entries={pending} />
              </section>
            )}

            {logs.length > 0 && (
              <section className="lg-group-detail-section">
                <div className="lg-group-section-header">Log · {logs.length}</div>
                <EntryList entries={logs} showTime />
              </section>
            )}

            {done.length > 0 && (
              <section className="lg-group-detail-section lg-group-detail-section--done">
                <div className="lg-group-section-header">Done · {done.length}</div>
                <EntryList entries={done} />
              </section>
            )}

            {entries.length === 0 && (
              <div className="lg-group-empty">
                <p>No items yet. Type above and press Enter to add one.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
