import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { spawnDueRoutines } from '../firebase/routineSpawner';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import ActivityIcon from '../components/health/ActivityIcon';
import IntensityDot from '../components/health/IntensityDot';
import {
  WORKOUT_TYPES,
  INTENSITY_LEVELS,
  INTENSITY_COLORS,
  calcCalories,
  showsDistance,
  showsSetsReps,
  distanceUnit as getDistUnit,
} from '../constants/health';
import type { RoutineGroup, TemplateItem } from '../types';
import './health-routine-edit-page.css';

// ── Day picker ────────────────────────────────────────────────────────────────

const WEEK_DAYS = [
  { code: 'MON', label: 'M' },
  { code: 'TUE', label: 'T' },
  { code: 'WED', label: 'W' },
  { code: 'THU', label: 'T' },
  { code: 'FRI', label: 'F' },
  { code: 'SAT', label: 'S' },
  { code: 'SUN', label: 'S' },
] as const;

// ── Workout Item Editor (inline expandable) ───────────────────────────────────

interface WorkoutItemEditorProps {
  item: TemplateItem;
  onChange: (updated: TemplateItem) => void;
  onRemove: () => void;
}

function WorkoutItemEditor({ item, onChange, onRemove }: WorkoutItemEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const wt = item.workoutType ?? 'Run';
  const intensity = item.targetIntensity ?? 'Moderate';
  const ic = INTENSITY_COLORS[intensity];
  const dUnit = getDistUnit(wt);
  const estCal = item.targetDurationMin
    ? calcCalories(wt, intensity, item.targetDurationMin, 70)
    : null;

  const update = (partial: Partial<TemplateItem>) => onChange({ ...item, ...partial });

  const meta = [
    item.targetDurationMin ? `${item.targetDurationMin}min` : null,
    item.targetIntensity,
    item.targetDistanceValue ? `${item.targetDistanceValue}${item.targetDistanceUnit ?? dUnit ?? 'km'}` : null,
    item.targetSets && item.targetReps ? `${item.targetSets}×${item.targetReps}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="sn-hre-workout-item">
      <div className="sn-hre-workout-item-header">
        <span className="sn-hre-workout-icon">
          <ActivityIcon type={wt} size={16} />
        </span>
        <div className="sn-hre-workout-info" onClick={() => setExpanded((e) => !e)}>
          <span className="sn-hre-workout-name">{item.title || wt}</span>
          {meta && (
            <span className="sn-hre-workout-meta">
              {item.targetIntensity && <IntensityDot intensity={intensity} size={6} />}
              {' '}{meta}
            </span>
          )}
        </div>
        <button type="button" className="sn-hre-expand-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button type="button" className="sn-hre-remove-btn" onClick={onRemove} aria-label="Remove">
          <X size={14} />
        </button>
      </div>

      {expanded && (
        <div className="sn-hre-workout-editor">
          {/* Activity type */}
          <div className="sn-hre-field">
            <label className="sn-hre-label">Activity</label>
            <div className="sn-hre-chips">
              {WORKOUT_TYPES.map((t) => (
                <button key={t} type="button"
                  className={`sn-hre-chip${wt === t ? ' sn-hre-chip--active' : ''}`}
                  onClick={() => update({ workoutType: t, targetDistanceUnit: getDistUnit(t) ?? 'km' })}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="sn-hre-field">
            <label className="sn-hre-label">Name</label>
            <input type="text" className="sn-hre-input" placeholder={wt}
              value={item.title} maxLength={100}
              onChange={(e) => update({ title: e.target.value })} />
          </div>

          {/* Duration slider */}
          <div className="sn-hre-field">
            <div className="sn-hre-row-between">
              <label className="sn-hre-label">Duration</label>
              <span className="sn-hre-value">{item.targetDurationMin ?? 30} min</span>
            </div>
            <input type="range" min={5} max={120} step={5}
              value={item.targetDurationMin ?? 30}
              onChange={(e) => update({ targetDurationMin: Number(e.target.value) })}
              className="sn-hre-slider" />
            <div className="sn-hre-row-between" style={{ marginTop: 2 }}>
              <span className="sn-hre-hint">5 min</span>
              <span className="sn-hre-hint">2 hr</span>
            </div>
          </div>

          {/* Intensity */}
          <div className="sn-hre-field">
            <label className="sn-hre-label">Intensity</label>
            <div className="sn-hre-intensity-row">
              {INTENSITY_LEVELS.map((lvl) => {
                const c = INTENSITY_COLORS[lvl];
                const active = intensity === lvl;
                return (
                  <button key={lvl} type="button"
                    className="sn-hre-intensity-btn"
                    style={active ? { background: c.bg, borderColor: c.border, color: c.text, fontWeight: 700 } : {}}
                    onClick={() => update({ targetIntensity: lvl })}>
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance */}
          {showsDistance(wt) && (
            <div className="sn-hre-field">
              <label className="sn-hre-label">Target distance (optional)</label>
              <div className="sn-hre-input-unit-wrap">
                <input type="number" className="sn-hre-input" placeholder="0.0" min={0} step={0.1}
                  value={item.targetDistanceValue ?? ''}
                  onChange={(e) => update({ targetDistanceValue: e.target.value ? Number(e.target.value) : undefined, targetDistanceUnit: getDistUnit(wt) ?? 'km' })} />
                <span className="sn-hre-input-unit">{getDistUnit(wt) ?? 'km'}</span>
              </div>
            </div>
          )}

          {/* Sets & Reps */}
          {showsSetsReps(wt) && (
            <div className="sn-hre-field">
              <label className="sn-hre-label">Sets & Reps (average)</label>
              <div className="sn-hre-two-col">
                <div>
                  <div className="sn-hre-hint" style={{ marginBottom: 4 }}>SETS</div>
                  <input type="number" className="sn-hre-input sn-hre-input--center" placeholder="4" min={1} max={99}
                    value={item.targetSets ?? ''}
                    onChange={(e) => update({ targetSets: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div>
                  <div className="sn-hre-hint" style={{ marginBottom: 4 }}>REPS</div>
                  <input type="number" className="sn-hre-input sn-hre-input--center" placeholder="10" min={1} max={999}
                    value={item.targetReps ?? ''}
                    onChange={(e) => update({ targetReps: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
            </div>
          )}

          {/* Calorie preview */}
          {estCal != null && (
            <div className="sn-hre-cal-preview">
              <span className="sn-hre-hint">Est. calories (70 kg)</span>
              <span className="sn-hre-cal-val">~{estCal} kcal</span>
            </div>
          )}

          {/* Intensity description */}
          <div className="sn-hre-intensity-desc" style={{ color: ic.text, background: ic.bg, borderColor: ic.border }}>
            {intensity === 'Low' ? 'Easy, can hold a conversation'
              : intensity === 'Moderate' ? 'Comfortable but breathing harder'
              : intensity === 'High' ? 'Hard, short sentences only'
              : 'All out, unsustainable'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HealthRoutineEditPage() {
  const { routineId } = useParams<{ routineId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const groups = useGroupsStore((s) => s.groups);
  const addGroup = useGroupsStore((s) => s.addGroup);
  const updateGroup = useGroupsStore((s) => s.updateGroup);

  const isCreate = !routineId;
  const existing = routineId
    ? (groups.find((g) => g.id === routineId) as RoutineGroup | undefined)
    : undefined;

  // ── Recurrence helpers ────────────────────────────────────────────────────

  const initDays = (): string[] => {
    if (!existing) return ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const m = existing.recurrence.match(/^weekly:([A-Z,]+)$/);
    if (m) return m[1].split(',');
    if (existing.recurrence === 'daily') return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    if (existing.recurrence === 'weekdays') return ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    return ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  };

  // ── Form state ────────────────────────────────────────────────────────────

  const [name, setName] = useState(existing?.name ?? '');
  const [activeDays, setActiveDays] = useState<string[]>(initDays);
  const [spawnTime, setSpawnTime] = useState(existing?.spawnTime ?? '06:00');
  const [reminderEnabled, setReminderEnabled] = useState(existing?.reminderEnabled ?? false);
  const [reminderMinutes, setReminderMinutes] = useState(
    String(existing?.reminderMinutesBefore ?? 15)
  );
  const [calGoal, setCalGoal] = useState(
    existing?.dailyCalorieGoal != null ? String(existing.dailyCalorieGoal) : ''
  );
  const [durGoal, setDurGoal] = useState(
    existing?.dailyDurationGoal != null ? String(existing.dailyDurationGoal) : ''
  );
  const [sessGoal, setSessGoal] = useState(
    existing?.weeklySessionGoal != null ? String(existing.weeklySessionGoal) : ''
  );
  const [goalsOpen, setGoalsOpen] = useState(
    !!(existing?.dailyCalorieGoal || existing?.dailyDurationGoal || existing?.weeklySessionGoal)
  );

  // Workout items
  const [workoutItems, setWorkoutItems] = useState<TemplateItem[]>(
    existing?.templateChildren?.filter((i) => i.isWorkout) ?? []
  );

  // Task items (simple strings)
  const [taskItems, setTaskItems] = useState<string[]>(
    existing?.templateChildren?.filter((i) => !i.isWorkout).map((i) => i.title) ?? []
  );
  const [newTask, setNewTask] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleDay = (code: string) => {
    setActiveDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]
    );
  };

  const addWorkoutItem = () => {
    setWorkoutItems((prev) => [...prev, {
      title: 'Run',
      isWorkout: true,
      workoutType: 'Run',
      todoType: 'generic-task',
      targetDurationMin: 30,
      targetIntensity: 'Moderate',
    }]);
  };

  const updateWorkoutItem = useCallback((idx: number, updated: TemplateItem) => {
    setWorkoutItems((prev) => prev.map((item, i) => i === idx ? updated : item));
  }, []);

  const removeWorkoutItem = useCallback((idx: number) => {
    setWorkoutItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addTaskItem = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    setTaskItems((prev) => [...prev, trimmed]);
    setNewTask('');
  };

  const removeTaskItem = (idx: number) => {
    setTaskItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildRecurrence = (): string => {
    const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const sorted = allDays.filter((d) => activeDays.includes(d));
    if (sorted.length === 7) return 'daily';
    if (sorted.join(',') === weekdays.join(',')) return 'weekdays';
    return `weekly:${sorted.join(',')}`;
  };

  const handleSave = async () => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid || !name.trim()) return;
    setSaving(true);

    const templateChildren: TemplateItem[] = [
      ...workoutItems.map((item) => ({
        ...item,
        isWorkout: true as const,
        title: item.title || item.workoutType || 'Workout',
        todoType: 'generic-task' as const,
      })),
      ...taskItems.map((title) => ({
        title,
        isWorkout: false,
        todoType: 'generic-task' as const,
      })),
    ];

    const groupData = {
      name: name.trim(),
      recurrence: buildRecurrence(),
      spawnTime,
      templateChildren,
      isHealthRoutine: true,
      dailyCalorieGoal: calGoal ? Number(calGoal) : undefined,
      dailyDurationGoal: durGoal ? Number(durGoal) : undefined,
      weeklySessionGoal: sessGoal ? Number(sessGoal) : undefined,
      reminderEnabled,
      reminderMinutesBefore: reminderEnabled ? Number(reminderMinutes) : undefined,
      updatedAt: Timestamp.now(),
    };

    try {
      if (isCreate) {
        const id = await addGroup(uid, {
          groupKind: 'routine',
          ...groupData,
          streakCount: 0,
          ancestorPath: [],
          showProgress: true,
          showSumMoney: false,
          childCount: 0,
          doneCount: 0,
          completed: false,
        } as Parameters<typeof addGroup>[1]);
        spawnDueRoutines(uid).catch(console.error);
        showToast('Routine created', 'success');
        navigate(`/health/routines/${id}`);
      } else {
        await updateGroup(uid, routineId!, groupData as Parameters<typeof updateGroup>[2]);
        showToast('Routine saved', 'success');
        navigate(`/health/routines/${routineId}`);
      }
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sn-hre-page">
      <DetailPageHeader
        onBack={() => navigate(isCreate ? '/health' : `/health/routines/${routineId}`)}
        title={isCreate ? 'New Health Routine' : 'Edit Routine'}
      />

      <div className="sn-hre-body">

        {/* ── Section 1: Settings ── */}
        <section className="sn-hre-section">
          <div className="sn-hre-section-label">SETTINGS</div>

          {/* Name */}
          <div className="sn-hre-field">
            <label className="sn-hre-label">Routine name</label>
            <input
              type="text"
              className="sn-hre-input sn-hre-input--title"
              placeholder="e.g. Morning Health"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus={isCreate}
            />
          </div>

          {/* Schedule */}
          <div className="sn-hre-field">
            <label className="sn-hre-label">Days</label>
            <div className="sn-hre-day-row">
              {WEEK_DAYS.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  className={`sn-hre-day-btn${activeDays.includes(d.code) ? ' sn-hre-day-btn--active' : ''}`}
                  onClick={() => toggleDay(d.code)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sn-hre-field">
            <label className="sn-hre-label">Start time</label>
            <input
              type="time"
              className="sn-hre-input"
              value={spawnTime}
              onChange={(e) => setSpawnTime(e.target.value)}
            />
          </div>

          {/* Reminder */}
          <div className="sn-hre-reminder-row">
            <div>
              <div className="sn-hre-label">Reminder</div>
              <div className="sn-hre-hint">Notify before routine starts</div>
            </div>
            <button
              type="button"
              className={`sn-hre-toggle${reminderEnabled ? ' sn-hre-toggle--on' : ''}`}
              onClick={() => setReminderEnabled((r) => !r)}
              aria-pressed={reminderEnabled}
            >
              <span className="sn-hre-toggle-thumb" />
            </button>
          </div>
          {reminderEnabled && (
            <div className="sn-hre-field" style={{ marginTop: 10 }}>
              <label className="sn-hre-label">Minutes before</label>
              <div className="sn-hre-chips">
                {['5', '10', '15', '30'].map((m) => (
                  <button key={m} type="button"
                    className={`sn-hre-chip${reminderMinutes === m ? ' sn-hre-chip--active' : ''}`}
                    onClick={() => setReminderMinutes(m)}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Goals collapsible */}
          <button type="button" className="sn-hre-goals-toggle" onClick={() => setGoalsOpen((o) => !o)}>
            <span>Daily goals</span>
            {goalsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {goalsOpen && (
            <div className="sn-hre-goals">
              {[
                { label: 'Calories burned', hint: 'kcal / day', val: calGoal, set: setCalGoal, placeholder: '900' },
                { label: 'Active duration', hint: 'min / day',  val: durGoal, set: setDurGoal, placeholder: '60' },
                { label: 'Weekly sessions', hint: '× / week',   val: sessGoal, set: setSessGoal, placeholder: '5' },
              ].map(({ label, hint, val, set, placeholder }) => (
                <div key={label} className="sn-hre-goal-row">
                  <div>
                    <div className="sn-hre-label">{label}</div>
                  </div>
                  <div className="sn-hre-input-unit-wrap" style={{ width: 100 }}>
                    <input type="number" className="sn-hre-input sn-hre-input--sm" placeholder={placeholder}
                      min={0} value={val} onChange={(e) => set(e.target.value)} />
                    <span className="sn-hre-input-unit" style={{ fontSize: 10 }}>{hint}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2: Workout Items ── */}
        <section className="sn-hre-section">
          <div className="sn-hre-section-label">WORKOUT ITEMS</div>

          {workoutItems.map((item, idx) => (
            <WorkoutItemEditor
              key={idx}
              item={item}
              onChange={(updated) => updateWorkoutItem(idx, updated)}
              onRemove={() => removeWorkoutItem(idx)}
            />
          ))}

          <button type="button" className="sn-hre-add-btn" onClick={addWorkoutItem}>
            <Plus size={14} />
            Add workout item
          </button>
        </section>

        {/* ── Section 3: Task Items ── */}
        <section className="sn-hre-section">
          <div className="sn-hre-section-label">TASK ITEMS</div>

          {taskItems.map((task, idx) => (
            <div key={idx} className="sn-hre-task-item">
              <span className="sn-hre-task-name">{task}</span>
              <button type="button" className="sn-hre-remove-btn" onClick={() => removeTaskItem(idx)} aria-label="Remove">
                <X size={14} />
              </button>
            </div>
          ))}

          <div className="sn-hre-task-add-row">
            <input
              type="text"
              className="sn-hre-input"
              placeholder="Add task…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTaskItem(); }}
            />
            {newTask.trim() && (
              <button type="button" className="sn-hre-inline-add-btn" onClick={addTaskItem}>
                Add
              </button>
            )}
          </div>
        </section>

        {/* ── Save ── */}
        <button
          type="button"
          className="sn-hre-save-btn"
          disabled={!name.trim() || saving || activeDays.length === 0}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : isCreate ? 'Create Routine' : 'Save Routine'}
        </button>

      </div>
    </div>
  );
}
