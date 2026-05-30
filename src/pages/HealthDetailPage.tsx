import { useMemo, useState, useCallback } from 'react';
import { Trash2, Plus, Archive, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useLogsStore, type DayGroup } from '../stores/useLogsStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useUI } from '../context/UIContext';
import SwipeableRow from '../components/swipe/SwipeableRow';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import EmptyState from '../components/primitives/EmptyState';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import CollapsibleSection from '../components/primitives/CollapsibleSection';
import ActivityIcon from '../components/health/ActivityIcon';
import IntensityDot from '../components/health/IntensityDot';
import type { Log, HealthLog, RoutineGroup } from '../types';
import {
  filterRoutineLogs,
  sumCalories,
  sumDuration,
} from '../firebase/healthQueries';
import { recurrenceLabel } from '../firebase/routineSpawner';
import '../components/health/health-components.css';
import './health-detail-page.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOOD_COLORS: Record<number, string> = {
  1: '#ff8a8a', 2: '#ffb86c', 3: '#fcd34d', 4: '#a3d977', 5: '#6ee7a8',
};

function computeStreak(logs: Log[]): number {
  const healthLogs = logs.filter((l) => l.logType === 'health-log');
  if (healthLogs.length === 0) return 0;
  const dates = new Set(healthLogs.map((l) => l.occurredAt.toDate().toISOString().slice(0, 10)));
  let streak = 0;
  const cur = new Date();
  let startChecked = false;
  for (let i = 0; i < 365; i++) {
    const key = cur.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
      startChecked = true;
    } else if (!startChecked) {
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

function todayStartMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── Routine card ─────────────────────────────────────────────────────────────

interface RoutineCardProps {
  routine: RoutineGroup;
  todayLogs: HealthLog[];
  onClick: () => void;
  onArchive: () => void;
}

function RoutineCard({ routine, todayLogs, onClick, onArchive }: RoutineCardProps) {
  const workoutCount = routine.templateChildren?.filter((i) => i.isWorkout).length ?? 0;
  const taskCount = routine.templateChildren?.filter((i) => !i.isWorkout).length ?? 0;
  const totalItems = workoutCount + taskCount;
  const doneWorkouts = todayLogs.length;
  const progressPct = totalItems > 0 ? Math.min(doneWorkouts / totalItems, 1) : 0;
  const todayCal = sumCalories(todayLogs);
  const todayDur = sumDuration(todayLogs);

  return (
    <div
      className="sn-health-routine-card sn-health-routine-card--clickable"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="sn-health-routine-card__header">
        <div className="sn-health-routine-card__info">
          <span className="sn-health-routine-card__name">{routine.name}</span>
          <span className="sn-health-routine-card__recurrence">
            {recurrenceLabel(routine.recurrence)}
          </span>
        </div>
        <div className="sn-health-routine-card__right">
          {routine.streakCount > 0 && (
            <span className="sn-health-routine-card__streak">{routine.streakCount}d</span>
          )}
          <button
            type="button"
            className="sn-health-routine-card__archive-btn"
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            aria-label="Archive routine"
            title="Archive"
          >
            <Archive size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {totalItems > 0 && (
        <div className="sn-health-routine-card__progress">
          <div className="sn-health-routine-card__progress-track">
            <div
              className="sn-health-routine-card__progress-fill"
              style={{ width: `${Math.round(progressPct * 100)}%` }}
            />
          </div>
          <span className="sn-health-routine-card__progress-label">
            {doneWorkouts}/{totalItems} today
            {todayCal > 0 && ` · ${todayCal} kcal`}
            {todayDur > 0 && ` · ${todayDur} min`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Health log row ────────────────────────────────────────────────────────────

interface HealthRowProps {
  log: HealthLog;
  onDelete: (log: Log) => void;
}

function HealthRow({ log, onDelete }: HealthRowProps) {
  const { openComposeForEdit } = useUI();
  const time = formatTime(log.occurredAt.toDate());

  const parts: string[] = [];
  if (log.durationMin) parts.push(`${log.durationMin} min`);
  if (log.caloriesBurned) parts.push(`${log.caloriesBurned} kcal`);
  if (log.distanceValue) parts.push(`${log.distanceValue} ${log.distanceUnit ?? 'km'}`);
  if (log.sets && log.reps) parts.push(`${log.sets}×${log.reps}`);
  if (!log.workoutType && log.weightKg !== undefined) parts.push(`${log.weightKg} kg`);
  const meta = parts.join(' · ');

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
          {log.workoutType
            ? <ActivityIcon type={log.workoutType} size={14} />
            : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          }
        </span>
        <span className="sn-health-body">
          <span className="sn-health-title">{log.title}</span>
          {(meta || log.intensity) && (
            <span className="sn-health-meta">
              {log.intensity && <IntensityDot intensity={log.intensity} size={6} />}
              {log.intensity && meta && ' '}
              {meta}
            </span>
          )}
          {log.notes && <span className="sn-health-notes">{log.notes}</span>}
        </span>
        <span className="sn-health-right">
          {log.mood !== undefined && (
            <span
              className="sn-health-mood-dot"
              style={{ background: MOOD_COLORS[log.mood] }}
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

  const groups = useGroupsStore((s) => s.groups);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);

  const { openComposeLog } = useUI();

  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteArchivedId, setConfirmDeleteArchivedId] = useState<string | null>(null);

  // ── Health routines ──────────────────────────────────────────────────────────
  const healthRoutines = useMemo(
    () => groups.filter((g): g is RoutineGroup =>
      g.groupKind === 'routine' && !!(g as RoutineGroup).isHealthRoutine && !g.archivedAt
    ),
    [groups],
  );

  const archivedHealthRoutines = useMemo(
    () => groups.filter((g): g is RoutineGroup =>
      g.groupKind === 'routine' && !!(g as RoutineGroup).isHealthRoutine && !!g.archivedAt
    ),
    [groups],
  );

  const uid = user?.uid ?? getCachedUid();

  const handleArchiveRoutine = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      await updateGroup(uid, id, { archivedAt: Timestamp.now() });
      showToast('Routine archived', 'success');
    } catch {
      showToast('Could not archive routine', 'error');
    }
  }, [uid, updateGroup, showToast]);

  const handleUnarchiveRoutine = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      await updateGroup(uid, id, { archivedAt: undefined });
      showToast('Routine restored', 'success');
    } catch {
      showToast('Could not restore routine', 'error');
    }
  }, [uid, updateGroup, showToast]);

  const handleDeleteArchivedConfirmed = useCallback(async () => {
    const id = confirmDeleteArchivedId;
    setConfirmDeleteArchivedId(null);
    if (!id || !uid) return;
    try {
      await deleteGroup(uid, id);
      showToast('Routine deleted', 'success');
    } catch {
      showToast('Could not delete routine', 'error');
    }
  }, [confirmDeleteArchivedId, uid, deleteGroup, showToast]);

  const todayStart = todayStartMs();
  const todayEnd = todayStart + 86400000 - 1;

  // ── Log data ─────────────────────────────────────────────────────────────────
  const allGroups = useMemo(() => getLogsGroupedByDay(), [logs, getLogsGroupedByDay]);
  const healthGroups = useMemo(() => filterHealthOnly(allGroups), [allGroups]);
  const streak = useMemo(() => computeStreak(logs), [logs]);
  const thisWeek = useMemo(() => weeklyCount(logs), [logs]);

  const hasLogs = healthGroups.length > 0;
  const hasRoutines = healthRoutines.length > 0;

  const handleDelete = async (log: Log) => {
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
    <>
    {confirmArchiveId && (
      <ConfirmSheet
        title="Archive routine?"
        message={`"${healthRoutines.find((r) => r.id === confirmArchiveId)?.name ?? 'This routine'}" will be archived. You can restore it below.`}
        confirmLabel="Archive"
        onConfirm={() => { handleArchiveRoutine(confirmArchiveId); setConfirmArchiveId(null); }}
        onCancel={() => setConfirmArchiveId(null)}
      />
    )}
    {confirmDeleteArchivedId && (
      <ConfirmSheet
        title="Delete routine?"
        message="This routine will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteArchivedConfirmed}
        onCancel={() => setConfirmDeleteArchivedId(null)}
      />
    )}
    <div className="sn-health-page">
      <DetailPageHeader onBack={() => navigate('/more')} title="Health" />

      {/* ── Stats bar ── */}
      {(hasLogs || loaded) && (
        <div className="sn-health-stats">
          <div className="sn-health-stat">
            <span className="sn-health-stat-value">{thisWeek}</span>
            <span className="sn-health-stat-label">This week</span>
          </div>
          <div className="sn-health-stat-divider" />
          <div className="sn-health-stat">
            <span className="sn-health-stat-value">{streak}</span>
            <span className="sn-health-stat-label">Day streak</span>
          </div>
        </div>
      )}

      {/* ── Health routines section ── */}
      <div className="sn-health-routines-section">
        {hasRoutines && (
          <>
            <div className="sn-health-section-header">
              <span className="sn-health-section-label">ROUTINES</span>
            </div>
            <div className="sn-health-routines-list">
              {healthRoutines.map((routine) => {
                const todayLogs = filterRoutineLogs(logs, routine.id!, todayStart, todayEnd);
                return (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    todayLogs={todayLogs}
                    onClick={() => navigate(`/health/routines/${routine.id}`)}
                    onArchive={() => setConfirmArchiveId(routine.id!)}
                  />
                );
              })}
            </div>
          </>
        )}
        <button
          type="button"
          className="sn-health-new-routine-btn"
          onClick={() => navigate('/health/routines/new')}
        >
          <Plus size={14} />
          {hasRoutines ? 'New routine' : 'Create a health routine'}
        </button>

        {archivedHealthRoutines.length > 0 && (
          <CollapsibleSection
            label="Archived"
            count={archivedHealthRoutines.length}
            className="sn-health-archived-section"
          >
            <div className="sn-health-archived-list">
              {archivedHealthRoutines.map((r) => (
                <div key={r.id} className="sn-health-archived-row">
                  <span className="sn-health-archived-row__name">{r.name}</span>
                  <span className="sn-health-archived-row__badge">{recurrenceLabel(r.recurrence)}</span>
                  <button
                    type="button"
                    className="sn-health-archived-row__action"
                    onClick={() => handleUnarchiveRoutine(r.id!)}
                    aria-label="Restore routine"
                    title="Restore"
                  >
                    <RotateCcw size={13} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="sn-health-archived-row__action sn-health-archived-row__action--danger"
                    onClick={() => setConfirmDeleteArchivedId(r.id!)}
                    aria-label="Delete routine"
                    title="Delete"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* ── Log list ── */}
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
        <>
          <div className="sn-health-section-header sn-health-section-header--list">
            <span className="sn-health-section-label">LOGS</span>
          </div>
          <div className="sn-health-list">
            {healthGroups.map((g) => (
              <DaySection key={g.dateKey} group={g} onDelete={handleDelete} />
            ))}
          </div>
        </>
      ) : !hasRoutines ? (
        <EmptyState
          glyph="♡"
          title="No health logs yet"
          sub="Log a workout, mood, or weight to start your streak."
          cta={{ label: 'Log workout', onClick: () => openComposeLog('health-log'), variant: 'success' }}
        />
      ) : null}
    </div>
    </>
  );
}
