import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Repeat, ChevronRight, Flame, RotateCcw, IndianRupee, CheckSquare, Trash2, Pencil } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { spawnDueRoutines, recurrenceLabel } from '../firebase/routineSpawner';
import BottomSheet from '../components/primitives/BottomSheet';
import EditRecurringSheet from '../components/sheets/EditRecurringSheet';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import EmptyState from '../components/primitives/EmptyState';
import CollapsibleSection from '../components/primitives/CollapsibleSection';
import ProgressBar from '../components/primitives/ProgressBar';
import SheetFormActions from '../components/primitives/SheetFormActions';
import type { Group, RoutineGroup, RecurringTodoGroup, TemplateItem } from '../types';
import './routines-page.css';

// ─── Recurrence options ───────────────────────────────────────────────────────

const RECURRENCE_OPTIONS = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly',   label: 'Weekly' },
] as const;

const WEEK_DAYS = [
  { code: 'MON', label: 'Mon' },
  { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' },
  { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' },
  { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
] as const;

// ─── New Routine Sheet ────────────────────────────────────────────────────────

interface NewRoutineSheetProps {
  onClose: () => void;
}

function NewRoutineSheet({ onClose }: NewRoutineSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addGroup = useGroupsStore((s) => s.addGroup);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [weekDay, setWeekDay] = useState<string>('MON');
  const [spawnTime, setSpawnTime] = useState('06:00');
  const [templateItems, setTemplateItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  const uid = user?.uid ?? getCachedUid();

  const recurrenceValue =
    recurrenceType === 'weekly' ? `weekly:${weekDay}` : recurrenceType;

  const addTemplateItem = useCallback(() => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setTemplateItems((prev) => [...prev, trimmed]);
    setNewItem('');
  }, [newItem]);

  const removeTemplateItem = useCallback((idx: number) => {
    setTemplateItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCreate = async () => {
    if (!uid || !name.trim()) return;
    setSaving(true);
    try {
      const template: TemplateItem[] = templateItems.map((title) => ({
        title,
        todoType: 'generic-task',
      }));
      const groupId = await addGroup(uid, {
        groupKind: 'routine',
        name: name.trim(),
        recurrence: recurrenceValue,
        spawnTime,
        templateChildren: template,
        streakCount: 0,
        ancestorPath: [],
        showProgress: true,
        showSumMoney: false,
        childCount: 0,
        doneCount: 0,
        completed: false,
      } as Parameters<typeof addGroup>[1]);
      showToast('Routine created', 'success');
      onClose();
      // Spawn today's instance immediately if due
      spawnDueRoutines(uid).catch(console.error);
      navigate(`/routines/${groupId}`);
    } catch {
      showToast('Could not create routine. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New routine">
      <div className="sn-rtn-sheet-form">
        {/* Name */}
        <input
          type="text"
          className="sn-sheet-title-input"
          placeholder="Routine name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={80}
        />

        {/* Recurrence type */}
        <div className="sn-rtn-field">
          <label className="sn-rtn-field-label">Repeat</label>
          <div className="sn-rtn-chips">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sn-rtn-chip${recurrenceType === opt.value ? ' sn-rtn-chip--active' : ''}`}
                onClick={() => setRecurrenceType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {recurrenceType === 'weekly' && (
            <div className="sn-rtn-chips sn-rtn-chips--days">
              {WEEK_DAYS.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  className={`sn-rtn-chip sn-rtn-chip--sm${weekDay === d.code ? ' sn-rtn-chip--active' : ''}`}
                  onClick={() => setWeekDay(d.code)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spawn time */}
        <div className="sn-rtn-field">
          <label className="sn-rtn-field-label">Spawns at</label>
          <input
            type="time"
            className="sn-rtn-time-input"
            value={spawnTime}
            onChange={(e) => setSpawnTime(e.target.value)}
          />
        </div>

        {/* Template items */}
        <div className="sn-rtn-field">
          <label className="sn-rtn-field-label">
            Template items
            {templateItems.length > 0 && (
              <span className="sn-rtn-field-count">{templateItems.length}</span>
            )}
          </label>
          <div className="sn-rtn-template-list">
            {templateItems.map((item, i) => (
              <div key={i} className="sn-rtn-template-item">
                <span className="sn-rtn-template-item__title">{item}</span>
                <button
                  type="button"
                  className="sn-rtn-template-item__remove"
                  onClick={() => removeTemplateItem(i)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="sn-rtn-template-add">
              <input
                type="text"
                className="sn-rtn-template-input"
                placeholder="Add item…"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTemplateItem(); }}
              />
              {newItem.trim() && (
                <button type="button" className="sn-inline-add-btn" onClick={addTemplateItem}>
                  Add
                </button>
              )}
            </div>
          </div>
        </div>

        <SheetFormActions
          onCancel={onClose}
          onSave={handleCreate}
          saveLabel="Create"
          saving={saving}
          disabled={!name.trim()}
        />
      </div>
    </BottomSheet>
  );
}

// ─── Routine card ─────────────────────────────────────────────────────────────

interface RoutineCardProps {
  group: Group;
}

function RoutineCard({ group }: RoutineCardProps) {
  const navigate = useNavigate();
  const routine = group as RoutineGroup;
  const pct = routine.childCount > 0
    ? Math.round((routine.doneCount / routine.childCount) * 100)
    : 0;
  const isDeferred = !!(routine.deferUntil && routine.deferUntil.toDate() > new Date());
  const deferLabel = isDeferred
    ? routine.deferUntil!.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <button
      type="button"
      className="sn-routines-card"
      onClick={() => navigate(`/routines/${group.id}`)}
    >
      <div className="sn-routines-card__icon">
        <Repeat size={16} strokeWidth={2} />
      </div>
      <div className="sn-routines-card__body">
        <div className="sn-routines-card__top">
          <span className="sn-routines-card__name">{group.name}</span>
          {isDeferred ? (
            <span className="sn-routines-card__deferred">Paused until {deferLabel}</span>
          ) : (
            <span className="sn-routines-card__badge">
              {recurrenceLabel(routine.recurrence)}
            </span>
          )}
        </div>
        {!isDeferred && routine.childCount > 0 && (
          <>
            <span className="sn-routines-card__meta">
              {routine.doneCount}/{routine.childCount} today
            </span>
            <ProgressBar pct={pct} color="purple" />
          </>
        )}
        {!isDeferred && routine.childCount === 0 && (
          <span className="sn-routines-card__meta">No items in template</span>
        )}
      </div>
      {routine.streakCount > 0 && !isDeferred && (
        <div className="sn-routines-card__streak">
          <Flame size={12} strokeWidth={2} />
          <span>{routine.streakCount}</span>
        </div>
      )}
      <ChevronRight size={14} strokeWidth={2} className="sn-routines-card__chevron" />
    </button>
  );
}

// ─── Archived routine row ─────────────────────────────────────────────────────

interface ArchivedRoutineRowProps {
  group: Group;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

function ArchivedRoutineRow({ group, onRestore, onDelete }: ArchivedRoutineRowProps) {
  const routine = group as RoutineGroup;
  return (
    <div className="sn-routines-archived-row">
      <div className="sn-routines-archived-row__icon">
        <Repeat size={14} strokeWidth={2} />
      </div>
      <span className="sn-routines-archived-row__name">{routine.name}</span>
      <span className="sn-routines-archived-row__badge">
        {recurrenceLabel(routine.recurrence)}
      </span>
      <button
        type="button"
        className="sn-routines-archived-row__restore"
        onClick={() => onRestore(group.id!)}
        aria-label="Restore routine"
        title="Restore"
      >
        <RotateCcw size={13} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="sn-routines-archived-row__delete"
        onClick={() => onDelete(group.id!)}
        aria-label="Delete routine"
        title="Delete"
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── EditRecurringSheet is imported from shared component ────────────────────

// ─── Recurring single-todo card ───────────────────────────────────────────────

interface RecurringTodoCardProps {
  group: RecurringTodoGroup;
  onDelete: (id: string) => void;
  onEdit: (group: RecurringTodoGroup) => void;
}

function RecurringTodoCard({ group, onDelete, onEdit }: RecurringTodoCardProps) {
  const isPayment = group.recurTodoType === 'money-reminder';
  return (
    <div className="sn-routines-recurring-card">
      <div className={`sn-routines-recurring-card__icon${isPayment ? ' sn-routines-recurring-card__icon--payment' : ''}`}>
        {isPayment
          ? <IndianRupee size={14} strokeWidth={2} />
          : <CheckSquare size={14} strokeWidth={2} />}
      </div>
      <div className="sn-routines-recurring-card__body">
        <span className="sn-routines-recurring-card__name">{group.name}</span>
        <span className="sn-routines-recurring-card__meta">
          {recurrenceLabel(group.recurrence)}
          {isPayment && group.amount != null ? ` · ₹${group.amount}` : ''}
        </span>
      </div>
      <div className="sn-routines-recurring-card__btns">
        <button
          type="button"
          className="sn-routines-recurring-card__edit"
          onClick={() => onEdit(group)}
          aria-label="Edit"
          title="Edit"
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="sn-routines-recurring-card__delete"
          onClick={() => onDelete(group.id!)}
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RecurringTodoGroup | null>(null);
  const [confirmDeleteArchivedId, setConfirmDeleteArchivedId] = useState<string | null>(null);
  const { user } = useAuth();
  const { showToast } = useToast();

  const groups = useGroupsStore((s) => s.groups);
  const getActiveRoutines = useGroupsStore((s) => s.getActiveRoutines);
  const getArchivedRoutines = useGroupsStore((s) => s.getArchivedRoutines);
  const getActiveRecurringTodos = useGroupsStore((s) => s.getActiveRecurringTodos);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);

  const uid = user?.uid ?? getCachedUid();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routines = useMemo(() => getActiveRoutines(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const archivedRoutines = useMemo(() => getArchivedRoutines(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recurringTodos = useMemo(() => getActiveRecurringTodos(), [groups]);

  const handleRestore = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      await updateGroup(uid, id, { archivedAt: undefined });
      showToast('Routine restored', 'success');
    } catch {
      showToast('Could not restore routine', 'error');
    }
  }, [uid, updateGroup, showToast]);

  const handleDeleteRecurring = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      await deleteGroup(uid, id);
      showToast('Deleted', 'success');
    } catch {
      showToast('Could not delete', 'error');
    }
  }, [uid, deleteGroup, showToast]);

  const handleDeleteArchivedConfirmed = useCallback(async () => {
    const id = confirmDeleteArchivedId;
    setConfirmDeleteArchivedId(null);
    if (!id || !uid) return;
    try {
      await deleteGroup(uid, id);
      showToast('Routine deleted', 'success');
    } catch {
      showToast('Could not delete', 'error');
    }
  }, [confirmDeleteArchivedId, uid, deleteGroup, showToast]);

  return (
    <>
    {confirmDeleteArchivedId && (
      <ConfirmSheet
        title="Delete routine?"
        message="This archived routine will be permanently deleted."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteArchivedConfirmed}
        onCancel={() => setConfirmDeleteArchivedId(null)}
      />
    )}
    <div className="sn-routines-page">
      <div className="sn-routines-header">
        <h1 className="sn-routines-title">Routines</h1>
        <button
          type="button"
          className="sn-action-chip"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={14} strokeWidth={2.5} />
          New routine
        </button>
      </div>

      <div className="sn-routines-body">
        {routines.length === 0 ? (
          <EmptyState
            glyph="⟳"
            title="No routines yet."
            sub="Build a daily habit — tap New routine."
          />
        ) : (
          <div className="sn-routines-list">
            {routines.map((r) => (
              <RoutineCard key={r.id} group={r} />
            ))}
          </div>
        )}

        {recurringTodos.length > 0 && (
          <div className="sn-routines-recurring-section">
            <div className="sn-routines-recurring-section__header">
              <span className="sn-routines-recurring-section__title">Recurring</span>
              <span className="sn-routines-recurring-section__sub">Spawns a task each cycle</span>
            </div>
            <div className="sn-routines-recurring-list">
              {recurringTodos.map((r) => (
                <RecurringTodoCard key={r.id} group={r} onDelete={handleDeleteRecurring} onEdit={setEditingGroup} />
              ))}
            </div>
          </div>
        )}

        {archivedRoutines.length > 0 && (
          <CollapsibleSection
            label="Archived"
            count={archivedRoutines.length}
            className="sn-routines-archived"
          >
            <div className="sn-routines-archived-list">
              {archivedRoutines.map((r) => (
                <ArchivedRoutineRow key={r.id} group={r} onRestore={handleRestore} onDelete={setConfirmDeleteArchivedId} />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {sheetOpen && <NewRoutineSheet onClose={() => setSheetOpen(false)} />}
      {editingGroup && (
        <EditRecurringSheet group={editingGroup} onClose={() => setEditingGroup(null)} />
      )}
    </div>
    </>
  );
}
