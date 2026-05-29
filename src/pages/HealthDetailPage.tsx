import { useMemo } from 'react';
import { Heart, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useLogsStore, type DayGroup } from '../stores/useLogsStore';
import { useUI } from '../context/UIContext';
import SwipeableRow from '../components/swipe/SwipeableRow';
import type { Log, HealthLog } from '../types';
import './health-detail-page.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOOD_LABELS: Record<number, string> = { 1: 'Very low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };
const MOOD_COLORS: Record<number, string> = {
  1: '#ff8a8a', 2: '#ffb86c', 3: '#fcd34d', 4: '#a3d977', 5: '#6ee7a8',
};

function computeStreak(logs: Log[]): number {
  const healthLogs = logs.filter((l) => l.logType === 'health-log');
  if (healthLogs.length === 0) return 0;
  const dates = new Set(healthLogs.map((l) => l.occurredAt.toDate().toISOString().slice(0, 10)));
  let streak = 0;
  const cur = new Date();
  // Allow today to not have a log yet without breaking streak
  // Start from today; if missing, try yesterday
  let startChecked = false;
  for (let i = 0; i < 365; i++) {
    const key = cur.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
      startChecked = true;
    } else if (!startChecked) {
      // Skip today if not logged yet
      startChecked = true;
    } else {
      break;
    }
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function weeklyCount(logs: Log[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return logs.filter((l) => l.logType === 'health-log' && l.occurredAt.toMillis() >= cutoff).length;
}

function filterHealthOnly(dayGroups: DayGroup[]): DayGroup[] {
  return dayGroups
    .map((g) => ({ ...g, logs: g.logs.filter((l) => l.logType === 'health-log') }))
    .filter((g) => g.logs.length > 0);
}

function formatTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ── Health log row ────────────────────────────────────────────────────────────

interface HealthRowProps {
  log: HealthLog;
  onDelete: (log: Log) => void;
}

function HealthRow({ log, onDelete }: HealthRowProps) {
  const { openComposeForEdit } = useUI();
  const time = formatTime(log.occurredAt.toDate());

  const meta = [
    log.workoutType,
    log.mood !== undefined ? `Mood ${log.mood} — ${MOOD_LABELS[log.mood]}` : undefined,
    log.weightKg !== undefined ? `${log.weightKg} kg` : undefined,
  ].filter(Boolean).join(' · ');

  return (
    <SwipeableRow
      leftActions={[{
        label: 'Delete',
        className: 'sn-swipe-action--danger',
        icon: <Trash2 size={16} strokeWidth={2} />,
        onTrigger: () => onDelete(log),
      }]}
    >
      <button
        type="button"
        className="sn-health-row"
        onClick={() => openComposeForEdit(log)}
      >
        <span className="sn-health-icon">
          <Heart size={14} strokeWidth={2} />
        </span>
        <span className="sn-health-body">
          <span className="sn-health-title">{log.title}</span>
          {meta && <span className="sn-health-meta">{meta}</span>}
          {log.notes && <span className="sn-health-notes">{log.notes}</span>}
        </span>
        <span className="sn-health-right">
          {log.mood !== undefined && (
            <span
              className="sn-health-mood-dot"
              style={{ background: MOOD_COLORS[log.mood] }}
              title={MOOD_LABELS[log.mood]}
            />
          )}
          <span className="sn-health-time">{time}</span>
        </span>
      </button>
    </SwipeableRow>
  );
}

// ── Day section ───────────────────────────────────────────────────────────────

function DaySection({ group, onDelete }: { group: DayGroup; onDelete: (log: Log) => void }) {
  return (
    <div className="sn-health-day">
      <div className="sn-health-day-label">{group.label}</div>
      <div className="sn-health-day-list">
        {group.logs.map((log) => (
          <HealthRow key={log.id} log={log as HealthLog} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  const { openComposeLog } = useUI();
  return (
    <div className="sn-health-empty">
      <span className="sn-health-empty-glyph">♡</span>
      <p className="sn-health-empty-title">No health logs yet</p>
      <p className="sn-health-empty-sub">Log a workout, mood, or weight to start your streak.</p>
      <button
        type="button"
        className="sn-health-empty-cta"
        onClick={() => openComposeLog('health-log')}
      >
        Log workout
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HealthDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const logs = useLogsStore((s) => s.logs);
  const loaded = useLogsStore((s) => s.loaded);
  const deleteLog = useLogsStore((s) => s.deleteLog);
  const restoreLog = useLogsStore((s) => s.restoreLog);
  const getLogsGroupedByDay = useLogsStore((s) => s.getLogsGroupedByDay);

  const allGroups = useMemo(() => getLogsGroupedByDay(), [logs, getLogsGroupedByDay]);
  const healthGroups = useMemo(() => filterHealthOnly(allGroups), [allGroups]);
  const streak = useMemo(() => computeStreak(logs), [logs]);
  const thisWeek = useMemo(() => weeklyCount(logs), [logs]);

  const hasLogs = healthGroups.length > 0;

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
          const restoreUid = user?.uid ?? getCachedUid();
          if (restoreUid) restoreLog(restoreUid, deleted);
        },
      },
    });
  };

  return (
    <div className="sn-health-page">
      <div className="sn-health-header">
        <button
          type="button"
          className="sn-health-back-btn"
          onClick={() => navigate('/more')}
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="sn-health-heading">Health</h1>
      </div>

      {(hasLogs || loaded) && (
        <div className="sn-health-stats">
          <div className="sn-health-stat">
            <span className="sn-health-stat-value">{thisWeek}</span>
            <span className="sn-health-stat-label">This week</span>
          </div>
          <div className="sn-health-stat-divider" />
          <div className="sn-health-stat">
            <span className="sn-health-stat-value">{streak}</span>
            <span className="sn-health-stat-label">{streak === 1 ? 'Day streak' : 'Day streak'}</span>
          </div>
        </div>
      )}

      {!loaded && !hasLogs ? (
        <div className="sn-health-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sn-health-skeleton-row">
              <div className="sn-skeleton sn-skeleton--circle" />
              <div className="sn-health-skeleton-body">
                <div className="sn-skeleton sn-skeleton--line sn-skeleton--long" />
                <div className="sn-skeleton sn-skeleton--line sn-skeleton--short" />
              </div>
            </div>
          ))}
        </div>
      ) : hasLogs ? (
        <div className="sn-health-list">
          {healthGroups.map((g) => (
            <DaySection key={g.dateKey} group={g} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
