import { useMemo, useState } from 'react';
import { IndianRupee, TrendingUp, StickyNote, Heart, Trash2, ArrowLeft, Repeat, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useLogsStore, type DayGroup } from '../stores/useLogsStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useSandboxUI } from '../context/SandboxUIContext';
import SwipeableRow from '../components/swipe/SwipeableRow';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
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
  onRequestDelete: (log: Log) => void;
}

function LogRow({ log, onRequestDelete }: LogRowProps) {
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
        onTrigger: () => onRequestDelete(log),
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

// ── Group activity row (routine/project completion) ───────────────────────────

interface GroupActivityRowProps {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  time: string;
  onClick: () => void;
}

function GroupActivityRow({ icon, label, sub, time, onClick }: GroupActivityRowProps) {
  return (
    <button type="button" className="sb-tl-row sb-tl-row--activity" onClick={onClick}>
      <span className="sb-tl-icon sb-tl-icon--activity">{icon}</span>
      <span className="sb-tl-body">
        <span className="sb-tl-title">{label}</span>
        {sub && <span className="sb-tl-sub">{sub}</span>}
      </span>
      <span className="sb-tl-right">
        <span className="sb-tl-time">{time}</span>
      </span>
    </button>
  );
}

// ── Day section ───────────────────────────────────────────────────────────────

interface DaySectionProps {
  group: DayGroup;
  onRequestDelete: (log: Log) => void;
  activityEntries?: ActivityEntry[];
}

interface ActivityEntry {
  id: string;
  kind: 'routine' | 'project';
  label: string;
  sub?: string;
  time: string;
  onClick: () => void;
}

function DaySection({ group, onRequestDelete, activityEntries = [] }: DaySectionProps) {
  return (
    <div className="sb-tl-day">
      <div className="sb-tl-day-label">{group.label}</div>
      <div className="sb-tl-day-list">
        {group.logs.map((log) => (
          <LogRow key={log.id} log={log} onRequestDelete={onRequestDelete} />
        ))}
        {activityEntries.map((entry) => (
          <GroupActivityRow
            key={entry.id}
            icon={entry.kind === 'routine'
              ? <Repeat size={14} strokeWidth={2} />
              : <FolderOpen size={14} strokeWidth={2} />}
            label={entry.label}
            sub={entry.sub}
            time={entry.time}
            onClick={entry.onClick}
          />
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [pendingDelete, setPendingDelete] = useState<Log | null>(null);

  // Logs store
  const logs = useLogsStore((s) => s.logs);
  const loaded = useLogsStore((s) => s.loaded);
  const deleteLog = useLogsStore((s) => s.deleteLog);
  const restoreLog = useLogsStore((s) => s.restoreLog);
  const getLogsGroupedByDay = useLogsStore((s) => s.getLogsGroupedByDay);
  const getWeekTotals = useLogsStore((s) => s.getWeekTotals);

  // Groups store — for routine/project completion entries
  const groups = useGroupsStore((s) => s.groups);

  const dayGroups = useMemo(() => getLogsGroupedByDay(), [logs, getLogsGroupedByDay]);
  const weekTotals = useMemo(() => getWeekTotals(), [logs, getWeekTotals]);

  // Build group-activity entries per day (completed routines + projects)
  const activityByDay = useMemo(() => {
    const map: Record<string, ActivityEntry[]> = {};
    for (const g of groups) {
      if (g.archivedAt) continue;
      if (g.groupKind === 'routine') {
        // Routine completed today (doneCount >= childCount, childCount > 0)
        if (g.childCount > 0 && g.doneCount >= g.childCount && g.lastSpawnedAt) {
          const d = g.lastSpawnedAt.toDate();
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          if (!map[key]) map[key] = [];
          map[key].push({
            id: `rtn-${g.id}`,
            kind: 'routine',
            label: `${g.name} — all done`,
            sub: `${g.doneCount}/${g.childCount} tasks`,
            time: formatTime(d),
            onClick: () => navigate(`/sandbox/routines/${g.id}`, { state: { from: '/sandbox/timeline' } }),
          });
        }
      } else if (g.groupKind === 'project') {
        if (g.completed && g.completedAt) {
          const d = g.completedAt.toDate();
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          if (!map[key]) map[key] = [];
          map[key].push({
            id: `proj-${g.id}`,
            kind: 'project',
            label: `${g.name} — complete`,
            sub: `${g.doneCount}/${g.childCount} tasks`,
            time: formatTime(d),
            onClick: () => navigate(`/sandbox/projects/${g.id}`, { state: { from: '/sandbox/timeline' } }),
          });
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const handleRequestDelete = (log: Log) => {
    setPendingDelete(log);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const log = pendingDelete;
    setPendingDelete(null);
    const uid = user?.uid ?? getCachedUid();
    if (!uid) return;

    const deleted = await deleteLog(uid, log.id!);
    if (!deleted) return;

    showToast('Log deleted', 'info', {
      duration: 4000,
      action: {
        label: 'Undo',
        onClick: () => {
          const restoreUid = user?.uid ?? getCachedUid();
          if (restoreUid) restoreLog(restoreUid, deleted);
        },
      },
    });
  };

  const hasLogs = dayGroups.length > 0;
  const hasWeekData = weekTotals.expenses > 0 || weekTotals.income > 0;
  // Has anything to show (logs OR activity entries)
  const hasActivityEntries = Object.keys(activityByDay).length > 0;
  const hasContent = hasLogs || hasActivityEntries;

  return (
    <>
    {pendingDelete && (
      <ConfirmSheet
        title="Delete log?"
        message={`"${pendingDelete.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    )}
    <div className="sb-timeline">
      <div className="sb-tl-header">
        <button
          type="button"
          className="sb-tl-back-btn"
          onClick={() => navigate('/sandbox')}
          aria-label="Back to Today"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
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

      {!loaded && !hasContent ? (
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
      ) : hasContent ? (
        <div className="sb-tl-list">
          {dayGroups.map((group) => (
            <DaySection
              key={group.dateKey}
              group={group}
              onRequestDelete={handleRequestDelete}
              activityEntries={activityByDay[group.dateKey]}
            />
          ))}
          {/* Days with only activity entries (no logs) */}
          {Object.entries(activityByDay)
            .filter(([dateKey]) => !dayGroups.find((dg) => dg.dateKey === dateKey))
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([dateKey, entries]) => {
              const d = new Date(dateKey + 'T00:00:00');
              const today = new Date();
              const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
              const label =
                d.toDateString() === today.toDateString() ? 'Today' :
                d.toDateString() === yesterday.toDateString() ? 'Yesterday' :
                d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <div key={dateKey} className="sb-tl-day">
                  <div className="sb-tl-day-label">{label}</div>
                  <div className="sb-tl-day-list">
                    {entries.map((entry) => (
                      <GroupActivityRow
                        key={entry.id}
                        icon={entry.kind === 'routine'
                          ? <Repeat size={14} strokeWidth={2} />
                          : <FolderOpen size={14} strokeWidth={2} />}
                        label={entry.label}
                        sub={entry.sub}
                        time={entry.time}
                        onClick={entry.onClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
    </>
  );
}
