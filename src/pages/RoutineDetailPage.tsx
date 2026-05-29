import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Archive, Flame, Pencil, Check, X, Plus, PauseCircle, Edit2 } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { recurrenceLabel } from '../firebase/routineSpawner';
import { Timestamp } from 'firebase/firestore';
import TodoRow from '../components/rows/TodoRow';
import BottomSheet from '../components/primitives/BottomSheet';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import SheetFormActions from '../components/primitives/SheetFormActions';
import type { RoutineGroup, TemplateItem } from '../types';
import './routine-detail-page.css';

// ── Recurrence options (shared with RoutinesPage) ─────────────────────────────

const RECURRENCE_OPTIONS = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly',   label: 'Weekly' },
] as const;

const WEEK_DAYS = [
  { code: 'MON', label: 'Mon' }, { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' }, { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' }, { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
] as const;

const DEFER_OPTIONS = [
  { days: 1,  label: 'Tomorrow' },
  { days: 3,  label: '3 days' },
  { days: 5,  label: '5 days' },
  { days: 7,  label: '1 week' },
  { days: 14, label: '2 weeks' },
];

// ── Edit Routine Sheet ────────────────────────────────────────────────────────

interface EditRoutineSheetProps {
  routine: RoutineGroup;
  onClose: () => void;
}

function EditRoutineSheet({ routine, onClose }: EditRoutineSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const uid = user?.uid ?? getCachedUid();

  const initRecurrenceType = (): 'daily' | 'weekdays' | 'weekly' => {
    if (routine.recurrence === 'daily') return 'daily';
    if (routine.recurrence === 'weekdays') return 'weekdays';
    return 'weekly';
  };
  const initWeekDay = (): string => {
    const m = routine.recurrence.match(/^weekly:([A-Z]+)$/);
    return m ? m[1] : 'MON';
  };

  const [name, setName] = useState(routine.name);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekdays' | 'weekly'>(initRecurrenceType);
  const [weekDay, setWeekDay] = useState(initWeekDay);
  const [spawnTime, setSpawnTime] = useState(routine.spawnTime);
  const [saving, setSaving] = useState(false);

  const recurrenceValue = recurrenceType === 'weekly' ? `weekly:${weekDay}` : recurrenceType;

  const handleSave = async () => {
    if (!uid || !name.trim()) return;
    setSaving(true);
    try {
      await updateGroup(uid, routine.id!, {
        name: name.trim(),
        recurrence: recurrenceValue,
        spawnTime,
        updatedAt: Timestamp.now(),
      } as Parameters<typeof updateGroup>[2]);
      showToast('Routine updated', 'success');
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Edit routine">
      <div className="sn-rtn-sheet-form">
        <input
          type="text"
          className="sn-sheet-title-input"
          placeholder="Routine name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={80}
        />
        <div className="sn-rtn-field">
          <label className="sn-rtn-field-label">Repeat</label>
          <div className="sn-rtn-chips">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                className={`sn-rtn-chip${recurrenceType === opt.value ? ' sn-rtn-chip--active' : ''}`}
                onClick={() => setRecurrenceType(opt.value)}>{opt.label}</button>
            ))}
          </div>
          {recurrenceType === 'weekly' && (
            <div className="sn-rtn-chips sn-rtn-chips--days">
              {WEEK_DAYS.map((d) => (
                <button key={d.code} type="button"
                  className={`sn-rtn-chip sn-rtn-chip--sm${weekDay === d.code ? ' sn-rtn-chip--active' : ''}`}
                  onClick={() => setWeekDay(d.code)}>{d.label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="sn-rtn-field">
          <label className="sn-rtn-field-label">Spawns at</label>
          <input type="time" className="sn-rtn-time-input" value={spawnTime}
            onChange={(e) => setSpawnTime(e.target.value)} />
        </div>
        <SheetFormActions
          onCancel={onClose}
          onSave={handleSave}
          saving={saving}
          disabled={!name.trim()}
        />
      </div>
    </BottomSheet>
  );
}

// ── Defer Routine Sheet ───────────────────────────────────────────────────────

interface DeferRoutineSheetProps {
  routine: RoutineGroup;
  onClose: () => void;
}

function DeferRoutineSheet({ routine, onClose }: DeferRoutineSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const uid = user?.uid ?? getCachedUid();
  const [saving, setSaving] = useState(false);

  const isCurrentlyDeferred =
    routine.deferUntil && routine.deferUntil.toDate() > new Date();

  const handleDefer = async (days: number) => {
    if (!uid) return;
    setSaving(true);
    try {
      const until = new Date();
      until.setDate(until.getDate() + days);
      until.setHours(0, 0, 0, 0);
      await updateGroup(uid, routine.id!, {
        deferUntil: Timestamp.fromDate(until),
        updatedAt: Timestamp.now(),
      } as Parameters<typeof updateGroup>[2]);
      showToast(`Routine paused for ${days} day${days !== 1 ? 's' : ''}`, 'success');
      onClose();
    } catch {
      showToast('Could not defer. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await updateGroup(uid, routine.id!, {
        deferUntil: null,
        updatedAt: Timestamp.now(),
      } as Parameters<typeof updateGroup>[2]);
      showToast('Routine resumed', 'success');
      onClose();
    } catch {
      showToast('Could not resume. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deferUntilLabel = isCurrentlyDeferred
    ? routine.deferUntil!.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <BottomSheet onClose={onClose} title="Defer routine">
      <div className="sn-rtn-defer-sheet">
        {isCurrentlyDeferred && (
          <div className="sn-rtn-defer-current">
            <span className="sn-rtn-defer-current__label">
              Currently paused until {deferUntilLabel}
            </span>
            <button type="button" className="sn-compose-save-btn" onClick={handleResume} disabled={saving}>
              Resume now
            </button>
          </div>
        )}
        <p className="sn-rtn-defer-hint">Pause this routine for:</p>
        <div className="sn-rtn-chips">
          {DEFER_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              className="sn-rtn-chip"
              onClick={() => handleDefer(opt.days)}
              disabled={saving}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}

export default function RoutineDetailPage() {
  const { routineId } = useParams<{ routineId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const uid = user?.uid ?? getCachedUid();

  // ── Store subscriptions ────────────────────────────────────────────────────

  const groups = useGroupsStore((s) => s.groups);
  const updateGroup = useGroupsStore((s) => s.updateGroup);

  const todos = useTodosStore((s) => s.todos);
  const addTodo = useTodosStore((s) => s.addTodo);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayTasks = useMemo(() => getTodosForGroup(routineId ?? ''), [todos, routineId]);

  const routine = useMemo(
    () => groups.find((g) => g.id === routineId) as RoutineGroup | undefined,
    [groups, routineId],
  );

  // ── Today quick-add ────────────────────────────────────────────────────────

  const [quickAdd, setQuickAdd] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const handleQuickAdd = useCallback(async () => {
    const trimmed = quickAdd.trim();
    if (!trimmed || !uid || !routineId) return;
    setAddingTask(true);
    try {
      await addTodo(uid, {
        todoType: 'generic-task',
        title: trimmed,
        groupId: routineId,
        status: 'pending',
        sortOrder: todayTasks.length,
      });
      setQuickAdd('');
      recomputeGroupCounts(uid, routineId).catch(console.error);
    } catch {
      showToast('Could not add task', 'error');
    } finally {
      setAddingTask(false);
    }
  }, [quickAdd, uid, routineId, todayTasks.length, addTodo, showToast]);

  // ── Edit / Defer / Archive sheet state ────────────────────────────────────

  const [editOpen, setEditOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // ── Template editing ───────────────────────────────────────────────────────

  const [editingTemplate, setEditingTemplate] = useState(false);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [newTemplateItem, setNewTemplateItem] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const startEditTemplate = useCallback(() => {
    setDraftItems((routine?.templateChildren ?? []).map((i) => i.title));
    setNewTemplateItem('');
    setEditingTemplate(true);
  }, [routine]);

  const cancelEditTemplate = useCallback(() => {
    setEditingTemplate(false);
    setDraftItems([]);
    setNewTemplateItem('');
  }, []);

  const addDraftItem = useCallback(() => {
    const trimmed = newTemplateItem.trim();
    if (!trimmed) return;
    setDraftItems((prev) => [...prev, trimmed]);
    setNewTemplateItem('');
  }, [newTemplateItem]);

  const removeDraftItem = useCallback((idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const saveTemplate = useCallback(async () => {
    if (!uid || !routineId) return;
    setSavingTemplate(true);
    try {
      const templateChildren: TemplateItem[] = draftItems.map((title) => ({
        title,
        todoType: 'generic-task',
      }));
      await updateGroup(uid, routineId, {
        templateChildren,
        updatedAt: Timestamp.now(),
      } as Parameters<typeof updateGroup>[2]);
      showToast('Template saved', 'success');
      setEditingTemplate(false);
    } catch {
      showToast('Could not save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  }, [uid, routineId, draftItems, updateGroup, showToast]);

  // ── Archive ────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !routineId) return;
    try {
      await updateGroup(uid, routineId, {
        archivedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      showToast('Routine archived', 'success');
      navigate('/routines');
    } catch {
      showToast('Could not archive', 'error');
    }
  }, [uid, routineId, updateGroup, showToast, navigate]);

  // ── Defer status ───────────────────────────────────────────────────────────

  const isDeferred = routine
    ? !!(routine.deferUntil && routine.deferUntil.toDate() > new Date())
    : false;

  // ── Derived ────────────────────────────────────────────────────────────────

  const sortedTasks = useMemo(
    () => [...todayTasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [todayTasks],
  );

  const pct = routine && routine.childCount > 0
    ? Math.round((routine.doneCount / routine.childCount) * 100)
    : 0;

  const allDone = routine ? routine.childCount > 0 && routine.doneCount >= routine.childCount : false;

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!routine) {
    return (
      <div className="sn-rtn-detail-page">
        <DetailPageHeader
          onBack={() => {
            const from = (location.state as { from?: string } | null)?.from;
            navigate(from ?? '/routines');
          }}
          title=""
        />
        <div className="sn-rtn-detail-notfound">Routine not found.</div>
      </div>
    );
  }

  return (
    <>
    {editOpen && <EditRoutineSheet routine={routine} onClose={() => setEditOpen(false)} />}
    {deferOpen && <DeferRoutineSheet routine={routine} onClose={() => setDeferOpen(false)} />}
    {confirmArchive && (
      <ConfirmSheet
        title="Archive routine?"
        message={`"${routine.name}" will be archived. You can find it in the archived section.`}
        confirmLabel="Archive"
        danger={false}
        onConfirm={() => { setConfirmArchive(false); handleArchive(); }}
        onCancel={() => setConfirmArchive(false)}
      />
    )}
    <div className="sn-rtn-detail-page">

      {/* ── Header ── */}
      <DetailPageHeader
        onBack={() => navigate('/routines')}
        title={routine.name}
        subtitle={
          <>
            {recurrenceLabel(routine.recurrence)} · {routine.spawnTime}
            {isDeferred && (
              <span className="sn-rtn-detail-deferred-badge">
                {' · Paused until '}
                {routine.deferUntil!.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </>
        }
        rightSlot={
          <>
            {routine.streakCount > 0 && !isDeferred && (
              <div className="sn-rtn-detail-streak">
                <Flame size={14} strokeWidth={2} />
                <span>{routine.streakCount}</span>
              </div>
            )}
            <button
              type="button"
              className="sn-rtn-detail-archive-btn"
              onClick={() => setDeferOpen(true)}
              title="Defer routine"
            >
              <PauseCircle size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="sn-rtn-detail-archive-btn"
              onClick={() => setEditOpen(true)}
              title="Edit routine"
            >
              <Edit2 size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="sn-rtn-detail-archive-btn"
              onClick={() => setConfirmArchive(true)}
              title="Archive routine"
            >
              <Archive size={15} strokeWidth={2} />
            </button>
          </>
        }
      />

      {/* ── Progress bar ── */}
      {routine.childCount > 0 && (
        <div className="sn-rtn-detail-progress-wrap">
          <div className="sn-rtn-detail-progress-track">
            <div
              className={`sn-rtn-detail-progress-fill${allDone ? ' sn-rtn-detail-progress-fill--done' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="sn-rtn-detail-progress-label">
            {routine.doneCount}/{routine.childCount} done
          </span>
        </div>
      )}

      {/* ── Completion banner ── */}
      {allDone && (
        <div className="sn-rtn-detail-done-banner">
          <Check size={14} strokeWidth={2.5} />
          <span>All done for today!</span>
        </div>
      )}

      {/* ── Today section ── */}
      <div className="sn-rtn-detail-section">
        <div className="sn-rtn-detail-section-header">
          <span className="sn-rtn-detail-section-label">TODAY</span>
        </div>

        {sortedTasks.length === 0 ? (
          <p className="sn-rtn-detail-empty-meta">
            {routine.lastSpawnedAt ? 'No tasks for today.' : 'Routine hasn\'t spawned yet today.'}
          </p>
        ) : (
          <div className="sn-rtn-detail-task-list">
            {sortedTasks.map((todo) => (
              <TodoRow key={todo.id} todo={todo} />
            ))}
          </div>
        )}

        {/* Quick-add for today */}
        <div className="sn-rtn-detail-quick-add">
          <input
            type="text"
            className="sn-rtn-detail-quick-input"
            placeholder="Add task for today…"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
            disabled={addingTask}
          />
          {quickAdd.trim() && (
            <button
              type="button"
              className="sn-inline-add-btn"
              onClick={handleQuickAdd}
              disabled={addingTask}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Template section ── */}
      <div className="sn-rtn-detail-section">
        <div className="sn-rtn-detail-section-header">
          <span className="sn-rtn-detail-section-label">TEMPLATE</span>
          {!editingTemplate && (
            <button
              type="button"
              className="sn-rtn-detail-edit-btn"
              onClick={startEditTemplate}
            >
              <Pencil size={12} strokeWidth={2} />
              Edit
            </button>
          )}
        </div>

        {!editingTemplate ? (
          /* View mode */
          routine.templateChildren.length === 0 ? (
            <p className="sn-rtn-detail-empty-meta">No template items. Tap Edit to add some.</p>
          ) : (
            <div className="sn-rtn-detail-tmpl-list">
              {routine.templateChildren.map((item, i) => (
                <div key={i} className="sn-rtn-detail-tmpl-item">
                  <span className="sn-rtn-detail-tmpl-dot" />
                  <span className="sn-rtn-detail-tmpl-title">{item.title}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Edit mode */
          <div className="sn-rtn-detail-tmpl-edit">
            {draftItems.map((item, i) => (
              <div key={i} className="sn-rtn-detail-tmpl-edit-row">
                <span className="sn-rtn-detail-tmpl-edit-title">{item}</span>
                <button
                  type="button"
                  className="sn-rtn-detail-tmpl-remove"
                  onClick={() => removeDraftItem(i)}
                  aria-label="Remove"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}

            <div className="sn-rtn-detail-tmpl-add-row">
              <input
                type="text"
                className="sn-rtn-template-input"
                placeholder="New item…"
                value={newTemplateItem}
                onChange={(e) => setNewTemplateItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addDraftItem(); }}
                autoFocus
              />
              {newTemplateItem.trim() && (
                <button type="button" className="sn-inline-add-btn" onClick={addDraftItem}>
                  Add
                </button>
              )}
            </div>

            <SheetFormActions
              onCancel={cancelEditTemplate}
              onSave={saveTemplate}
              saveLabel="Save template"
              saving={savingTemplate}
            />
          </div>
        )}
      </div>
    </div>
    </>
  );
}
