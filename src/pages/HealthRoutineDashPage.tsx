import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Pencil, Archive, Trash2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useLogsStore } from '../stores/useLogsStore';
import { useUI } from '../context/UIContext';
import { useToast } from '../shared/components/Toast';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import GoalRing from '../components/health/GoalRing';
import WeeklyBarChart from '../components/health/WeeklyBarChart';
import WorkoutCard from '../components/health/WorkoutCard';
import type { RoutineGroup, HealthLog } from '../types';
import {
  filterRoutineLogs,
  groupLogsByDay,
  sumCalories,
  sumDuration,
  last7DayKeys,
  shortDayLabel,
} from '../firebase/healthQueries';
import { recurrenceLabel } from '../firebase/routineSpawner';
import '../components/health/health-components.css';
import './health-routine-dash-page.css';


function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfToday(): number {
  return startOfToday() + 86400000 - 1;
}

export default function HealthRoutineDashPage() {
  const { routineId } = useParams<{ routineId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openComposeHealthLog } = useUI();

  const groups = useGroupsStore((s) => s.groups);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);
  const completeTodo = useTodosStore((s) => s.completeTodo);
  const markPending = useTodosStore((s) => s.markPending);
  const logs = useLogsStore((s) => s.logs);
  const { showToast } = useToast();

  const [chartOpen, setChartOpen] = useState(true);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const routine = routineId
    ? (groups.find((g) => g.id === routineId) as RoutineGroup | undefined)
    : undefined;

  // ── Today's todos for this routine ──────────────────────────────────────────
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const todayTodos = useMemo(() => {
    if (!routineId) return [];
    return getTodosForGroup(routineId).filter((t) => {
      if (!t.dueAt) return false;
      const ms = t.dueAt.toMillis();
      return ms >= todayStart && ms <= todayEnd;
    });
  }, [routineId, getTodosForGroup, todayStart, todayEnd]);

  // ── Health logs ──────────────────────────────────────────────────────────────
  const todayHealthLogs = useMemo<HealthLog[]>(() => {
    if (!routineId) return [];
    return filterRoutineLogs(logs, routineId, todayStart, todayEnd);
  }, [logs, routineId, todayStart, todayEnd]);

  const weekHealthLogs = useMemo<HealthLog[]>(() => {
    if (!routineId) return [];
    return filterRoutineLogs(logs, routineId, Date.now() - 7 * 86400000);
  }, [logs, routineId]);

  // ── Goals and progress ───────────────────────────────────────────────────────
  const todayCal = sumCalories(todayHealthLogs);
  const todayDur = sumDuration(todayHealthLogs);
  const calGoal = routine?.dailyCalorieGoal ?? 0;
  const durGoal = routine?.dailyDurationGoal ?? 0;
  const calPct = calGoal > 0 ? Math.min(todayCal / calGoal, 1) : 0;
  const durPct = durGoal > 0 ? Math.min(todayDur / durGoal, 1) : 0;

  const workoutItems = routine?.templateChildren?.filter((i) => i.isWorkout) ?? [];
  const taskItems = routine?.templateChildren?.filter((i) => !i.isWorkout) ?? [];

  const workoutsDoneToday = todayHealthLogs.length;
  const tasksDoneToday = todayTodos.filter((t) => t.status === 'done').length;
  const totalItems = workoutItems.length + taskItems.length;
  const doneItems = workoutsDoneToday + tasksDoneToday;
  const progressPct = totalItems > 0 ? doneItems / totalItems : 0;

  // ── Weekly chart data ────────────────────────────────────────────────────────
  const dayKeys = last7DayKeys();
  const byDay = groupLogsByDay(weekHealthLogs);
  const chartData = dayKeys.map((k) => sumCalories(byDay.get(k) ?? []));
  const chartLabels = dayKeys.map(shortDayLabel);

  // ── Weekly session count ─────────────────────────────────────────────────────
  const weekSessions = useMemo(() => {
    const days = new Set(
      weekHealthLogs.map((l) => l.occurredAt.toDate().toISOString().slice(0, 10))
    );
    return days.size;
  }, [weekHealthLogs]);

  const uid = user?.uid;

  const handleLogWorkout = (idx: number) => {
    const item = workoutItems[idx];
    openComposeHealthLog({
      workoutType: item.workoutType,
      targetDurationMin: item.targetDurationMin,
      targetIntensity: item.targetIntensity,
      targetDistanceValue: item.targetDistanceValue,
      targetDistanceUnit: item.targetDistanceUnit,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      sourceRoutineId: routineId,
      sourceTemplateIdx: idx,
    });
  };

  const handleArchive = async () => {
    if (!uid || !routineId) return;
    try {
      await updateGroup(uid, routineId, { archivedAt: Timestamp.now() });
      showToast('Routine archived', 'success');
      navigate('/health');
    } catch {
      showToast('Could not archive routine', 'error');
    }
  };

  const handleDelete = async () => {
    if (!uid || !routineId) return;
    try {
      await deleteGroup(uid, routineId);
      showToast('Routine deleted', 'success');
      navigate('/health');
    } catch {
      showToast('Could not delete routine', 'error');
    }
  };

  const handleToggleTask = async (todoId: string, done: boolean) => {
    if (!uid || !todoId) return;
    if (done) {
      await markPending(uid, todoId);
    } else {
      await completeTodo(uid, todoId);
    }
  };

  if (!routine) {
    return (
      <div className="sn-hrd-page">
        <DetailPageHeader onBack={() => navigate('/health')} title="Routine" />
        <div className="sn-hrd-body">
          <p className="sn-hrd-empty">Routine not found.</p>
        </div>
      </div>
    );
  }

  const hasGoals = (calGoal > 0 || durGoal > 0);

  return (
    <>
    {confirmArchive && (
      <ConfirmSheet
        title="Archive routine?"
        message={`"${routine.name}" will be archived. You can restore it from the Health page.`}
        confirmLabel="Archive"
        onConfirm={() => { setConfirmArchive(false); handleArchive(); }}
        onCancel={() => setConfirmArchive(false)}
      />
    )}
    {confirmDelete && (
      <ConfirmSheet
        title="Delete routine?"
        message={`"${routine.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    <div className="sn-hrd-page">
      <DetailPageHeader
        onBack={() => navigate('/health')}
        title={routine.name}
        rightSlot={
          <div className="sn-hrd-header-actions">
            <button
              className="sn-hrd-action-btn"
              onClick={() => setConfirmArchive(true)}
              aria-label="Archive routine"
              title="Archive"
            >
              <Archive size={16} />
            </button>
            <button
              className="sn-hrd-action-btn"
              onClick={() => navigate(`/health/routines/${routineId}/edit`)}
              aria-label="Edit routine"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              className="sn-hrd-action-btn sn-hrd-action-btn--danger"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete routine"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        }
      />

      <div className="sn-hrd-body">

        {/* ── Streak + recurrence ── */}
        <div className="sn-hrd-meta-row">
          <span className="sn-hrd-recurrence">{recurrenceLabel(routine.recurrence)}</span>
          {routine.streakCount > 0 && (
            <span className="sn-hrd-streak">{routine.streakCount}d streak</span>
          )}
        </div>

        {/* ── Today's progress bar ── */}
        <div className="sn-hrd-progress-card">
          <div className="sn-hrd-progress-header">
            <span className="sn-hrd-progress-label">Today</span>
            <span className="sn-hrd-progress-count">{doneItems} / {totalItems}</span>
          </div>
          <div className="sn-hrd-progress-track">
            <div
              className="sn-hrd-progress-fill"
              style={{ width: `${Math.round(progressPct * 100)}%` }}
            />
          </div>
        </div>

        {/* ── Goal rings ── */}
        {hasGoals && (
          <div className="sn-hrd-rings-row">
            {calGoal > 0 && (
              <div className="sn-hrd-ring-wrap">
                <GoalRing
                  pct={calPct}
                  color="#fb923c"
                  size={90}
                  strokeWidth={9}
                  label={todayCal > 0 ? `${todayCal}` : '0'}
                  sublabel={`/ ${calGoal} kcal`}
                />
                <span className="sn-hrd-ring-label">Calories</span>
              </div>
            )}
            {durGoal > 0 && (
              <div className="sn-hrd-ring-wrap">
                <GoalRing
                  pct={durPct}
                  color="#60a5fa"
                  size={90}
                  strokeWidth={9}
                  label={todayDur > 0 ? `${todayDur}` : '0'}
                  sublabel={`/ ${durGoal} min`}
                />
                <span className="sn-hrd-ring-label">Duration</span>
              </div>
            )}
            {routine.weeklySessionGoal && (
              <div className="sn-hrd-ring-wrap">
                <GoalRing
                  pct={weekSessions / routine.weeklySessionGoal}
                  color="#a78bfa"
                  size={90}
                  strokeWidth={9}
                  label={`${weekSessions}`}
                  sublabel={`/ ${routine.weeklySessionGoal} /wk`}
                />
                <span className="sn-hrd-ring-label">Sessions</span>
              </div>
            )}
          </div>
        )}

        {/* ── Weekly bar chart ── */}
        {chartData.some((v) => v > 0) && (
          <div className="sn-hrd-card">
            <button className="sn-hrd-chart-toggle" onClick={() => setChartOpen((o) => !o)}>
              <span className="sn-hrd-card-label">Weekly calories</span>
              <span className="sn-hrd-chart-right">
                <span className="sn-hrd-chart-total">{chartData.reduce((a, b) => a + b, 0)} kcal</span>
                {chartOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {chartOpen && (
              <div className="sn-hrd-chart-wrap">
                <WeeklyBarChart
                  data={chartData}
                  goal={calGoal}
                  labels={chartLabels}
                  height={90}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Workout items ── */}
        {workoutItems.length > 0 && (
          <section className="sn-hrd-section">
            <div className="sn-hrd-section-label">WORKOUTS</div>
            {workoutItems.map((item, idx) => {
              const todayLog = todayHealthLogs.find((l) => l.sourceTemplateIdx === idx);
              return (
                <WorkoutCard
                  key={idx}
                  item={item}
                  templateIdx={idx}
                  routineId={routineId!}
                  todayLog={todayLog}
                  onLog={() => handleLogWorkout(idx)}
                />
              );
            })}
          </section>
        )}

        {/* ── Task items ── */}
        {todayTodos.length > 0 && (
          <section className="sn-hrd-section">
            <div className="sn-hrd-section-label">TASKS</div>
            {todayTodos.map((todo) => {
              const done = todo.status === 'done';
              return (
                <div key={todo.id} className="sn-hrd-task-row">
                  <button
                    type="button"
                    className={`sn-hrd-task-check${done ? ' sn-hrd-task-check--done' : ''}`}
                    onClick={() => handleToggleTask(todo.id!, done)}
                    aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <polyline points="1.5,5 4,7.5 8.5,2.5" />
                      </svg>
                    )}
                  </button>
                  <span className={`sn-hrd-task-label${done ? ' sn-hrd-task-label--done' : ''}`}>
                    {todo.title}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {/* ── Empty state ── */}
        {workoutItems.length === 0 && taskItems.length === 0 && (
          <div className="sn-hrd-empty-card">
            <p className="sn-hrd-empty">No items yet. Edit the routine to add workouts or tasks.</p>
            <button
              className="sn-hrd-edit-cta"
              onClick={() => navigate(`/health/routines/${routineId}/edit`)}
            >
              Edit routine
            </button>
          </div>
        )}

      </div>
    </div>
    </>
  );
}

