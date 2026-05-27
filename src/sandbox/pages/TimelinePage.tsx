import { useMemo } from 'react';
import { IndianRupee, TrendingUp, StickyNote, Heart, Trash2 } from 'lucide-react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useLogsStore, type DayGroup } from '../stores/useLogsStore';
import { useSandboxUI } from '../context/SandboxUIContext';
import SwipeableRow from '../components/swipe/SwipeableRow';
import type { Log, ExpenseLog, IncomeLog } from '../types';
import './timeline-page.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function formatTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── Log row icons ─────────────────────────────────────────────────────────────

function LogIcon({ logType }: { logType: Log['logType'] }) {
  switch (logType) {
    case 'expense':      return <IndianRupee size={14} strokeWidth={2} />;
    case 'income':       return <TrendingUp size={14} strokeWidth={2} />;
    case 'generic-note': return <StickyNote size={14} strokeWidth={2} />;
    case 'health-log':   return <Heart size={14} strokeWidth={2} />;
  }
}

function logIconClass(logType: Log['logType']): string {
  switch (logType) {
    case 'expense':      return 'sb-tl-icon--expense';
    case 'income':       return 'sb-tl-icon--income';
    case 'generic-note': return 'sb-tl-icon--note';
    case 'health-log':   return 'sb-tl-icon--health';
  }
}

// ── Single log row ────────────────────────────────────────────────────────────

interface LogRowProps {
  log: Log;
  onDelete: (log: Log) => void;
}

function LogRow({ log, onDelete }: LogRowProps) {
  const { openComposeForEdit } = useSandboxUI();

  const subtitle =
    log.logType === 'expense' ? (log as ExpenseLog).category :
    log.logType === 'income'  ? undefined :
    undefined;

  const amount =
    log.logType === 'expense' ? (log as ExpenseLog).amount :
    log.logType === 'income'  ? (log as IncomeLog).amount :
    undefined;

  const time = formatTime(log.occurredAt.toDate());

  return (
    <SwipeableRow
      leftActions={[{
        label: 'Delete',
        className: 'sb-swipe-action--danger',
        icon: <Trash2 size={16} strokeWidth={2} />,
        onTrigger: () => onDelete(log),
      }]}
    >
      <button
        type="button"
        className="sb-tl-row"
        onClick={() => openComposeForEdit(log)}
      >
        <span className={`sb-tl-icon ${logIconClass(log.logType)}`}>
          <LogIcon logType={log.logType} />
        </span>
        <span className="sb-tl-body">
          <span className="sb-tl-title">{log.title}</span>
          {subtitle && <span className="sb-tl-sub">{subtitle}</span>}
        </span>
        <span className="sb-tl-right">
          {amount !== undefined && (
            <span className={`sb-tl-amount sb-tl-amount--${log.logType}`}>
              {log.logType === 'expense' ? '−' : '+'}{formatAmount(amount)}
            </span>
          )}
          <span className="sb-tl-time">{time}</span>
        </span>
      </button>
    </SwipeableRow>
  );
}

// ── Day section ───────────────────────────────────────────────────────────────

interface DaySectionProps {
  group: DayGroup;
  onDelete: (log: Log) => void;
}

function DaySection({ group, onDelete }: DaySectionProps) {
  return (
    <div className="sb-tl-day">
      <div className="sb-tl-day-label">{group.label}</div>
      <div className="sb-tl-day-list">
        {group.logs.map((log) => (
          <LogRow key={log.id} log={log} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  const { openComposeLog } = useSandboxUI();
  return (
    <div className="sb-tl-empty">
      <span className="sb-tl-empty-glyph">◷</span>
      <p className="sb-tl-empty-title">No logs yet</p>
      <p className="sb-tl-empty-sub">Log an expense or income to see it here.</p>
      <button
        type="button"
        className="sb-tl-empty-cta"
        onClick={() => openComposeLog()}
      >
        Log something
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Subscribe to the logs array for reactivity — when it changes we get a new ref
  const logs = useLogsStore((s) => s.logs);
  const loaded = useLogsStore((s) => s.loaded);
  const deleteLog = useLogsStore((s) => s.deleteLog);
  const restoreLog = useLogsStore((s) => s.restoreLog);
  const getLogsGroupedByDay = useLogsStore((s) => s.getLogsGroupedByDay);
  const getWeekTotals = useLogsStore((s) => s.getWeekTotals);

  // Use `logs` as the dependency so memo re-runs on every store update
  const dayGroups = useMemo(() => getLogsGroupedByDay(), [logs, getLogsGroupedByDay]);
  const weekTotals = useMemo(() => getWeekTotals(), [logs, getWeekTotals]);

  const handleDelete = async (log: Log) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) return;

    const deleted = await deleteLog(uid, log.id!);
    if (!deleted) return;

    showToast('Log deleted', 'info', {
      duration: 4000,
      action: {
        label: 'Undo',
        onClick: () => {
          const restore = deleted;
          const restoreUid = user?.uid ?? getCachedUid();
          if (restoreUid) restoreLog(restoreUid, restore);
        },
      },
    });
  };

  const hasLogs = dayGroups.length > 0;
  const hasWeekData = weekTotals.expenses > 0 || weekTotals.income > 0;

  return (
    <div className="sb-timeline">
      <div className="sb-tl-header">
        <h1 className="sb-tl-heading">Timeline</h1>
      </div>

      {hasWeekData && (
        <div className="sb-tl-week-stats">
          <div className="sb-tl-week-stat">
            <span className="sb-tl-week-label">This week spent</span>
            <span className="sb-tl-week-amount sb-tl-week-amount--expense">
              {formatAmount(weekTotals.expenses)}
            </span>
          </div>
          {weekTotals.income > 0 && (
            <div className="sb-tl-week-stat">
              <span className="sb-tl-week-label">Received</span>
              <span className="sb-tl-week-amount sb-tl-week-amount--income">
                {formatAmount(weekTotals.income)}
              </span>
            </div>
          )}
        </div>
      )}

      {!loaded && !hasLogs ? (
        <div className="sb-tl-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sb-tl-skeleton-row">
              <div className="sb-skeleton sb-skeleton--circle" />
              <div className="sb-tl-skeleton-body">
                <div className="sb-skeleton sb-skeleton--line sb-skeleton--long" />
                <div className="sb-skeleton sb-skeleton--line sb-skeleton--short" />
              </div>
            </div>
          ))}
        </div>
      ) : hasLogs ? (
        <div className="sb-tl-list">
          {dayGroups.map((group) => (
            <DaySection key={group.dateKey} group={group} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
