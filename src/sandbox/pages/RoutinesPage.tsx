import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Repeat, ChevronRight, Flame } from 'lucide-react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { spawnDueRoutines, recurrenceLabel } from '../firebase/routineSpawner';
import BottomSheet from '../components/primitives/BottomSheet';
import type { Group, RoutineGroup, TemplateItem } from '../types';
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
      navigate(`/sandbox/routines/${groupId}`);
    } catch {
      showToast('Could not create routine. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New routine">
      <div className="sb-rtn-sheet-form">
        {/* Name */}
        <input
          type="text"
          className="sb-proj-sheet-input"
          placeholder="Routine name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={80}
        />

        {/* Recurrence type */}
        <div className="sb-rtn-field">
          <label className="sb-rtn-field-label">Repeat</label>
          <div className="sb-rtn-chips">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sb-rtn-chip${recurrenceType === opt.value ? ' sb-rtn-chip--active' : ''}`}
                onClick={() => setRecurrenceType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {recurrenceType === 'weekly' && (
            <div className="sb-rtn-chips sb-rtn-chips--days">
              {WEEK_DAYS.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  className={`sb-rtn-chip sb-rtn-chip--sm${weekDay === d.code ? ' sb-rtn-chip--active' : ''}`}
                  onClick={() => setWeekDay(d.code)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spawn time */}
        <div className="sb-rtn-field">
          <label className="sb-rtn-field-label">Spawns at</label>
          <input
            type="time"
            className="sb-rtn-time-input"
            value={spawnTime}
            onChange={(e) => setSpawnTime(e.target.value)}
          />
        </div>

        {/* Template items */}
        <div className="sb-rtn-field">
          <label className="sb-rtn-field-label">
            Template items
            {templateItems.length > 0 && (
              <span className="sb-rtn-field-count">{templateItems.length}</span>
            )}
          </label>
          <div className="sb-rtn-template-list">
            {templateItems.map((item, i) => (
              <div key={i} className="sb-rtn-template-item">
                <span className="sb-rtn-template-item__title">{item}</span>
                <button
                  type="button"
                  className="sb-rtn-template-item__remove"
                  onClick={() => removeTemplateItem(i)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="sb-rtn-template-add">
              <input
                type="text"
                className="sb-rtn-template-input"
                placeholder="Add item…"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTemplateItem(); }}
              />
              {newItem.trim() && (
                <button type="button" className="sb-proj-add-btn" onClick={addTemplateItem}>
                  Add
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sb-proj-sheet-actions">
          <button type="button" className="sb-compose-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sb-compose-save-btn"
            disabled={!name.trim() || saving}
            onClick={handleCreate}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
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

  return (
    <button
      type="button"
      className="sb-routines-card"
      onClick={() => navigate(`/sandbox/routines/${group.id}`)}
    >
      <div className="sb-routines-card__icon">
        <Repeat size={16} strokeWidth={2} />
      </div>
      <div className="sb-routines-card__body">
        <div className="sb-routines-card__top">
          <span className="sb-routines-card__name">{group.name}</span>
          <span className="sb-routines-card__badge">
            {recurrenceLabel(routine.recurrence)}
          </span>
        </div>
        {routine.childCount > 0 && (
          <>
            <span className="sb-routines-card__meta">
              {routine.doneCount}/{routine.childCount} today
            </span>
            <div className="sb-routines-card__progress-track">
              <div className="sb-routines-card__progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        {routine.childCount === 0 && (
          <span className="sb-routines-card__meta">No items in template</span>
        )}
      </div>
      {routine.streakCount > 0 && (
        <div className="sb-routines-card__streak">
          <Flame size={12} strokeWidth={2} />
          <span>{routine.streakCount}</span>
        </div>
      )}
      <ChevronRight size={14} strokeWidth={2} className="sb-routines-card__chevron" />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = useGroupsStore((s) => s.groups);
  const getActiveRoutines = useGroupsStore((s) => s.getActiveRoutines);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routines = useMemo(() => getActiveRoutines(), [groups]);

  return (
    <div className="sb-routines-page">
      <div className="sb-routines-header">
        <h1 className="sb-routines-title">Routines</h1>
        <button
          type="button"
          className="sb-routine-action-btn"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={14} strokeWidth={2.5} />
          New routine
        </button>
      </div>

      <div className="sb-routines-body">
        {routines.length === 0 ? (
          <div className="sb-routines-empty">
            <span className="sb-routines-empty__glyph">⟳</span>
            <p className="sb-routines-empty__title">No routines yet.</p>
            <p className="sb-routines-empty__sub">Build a daily habit — tap New routine.</p>
          </div>
        ) : (
          <div className="sb-routines-list">
            {routines.map((r) => (
              <RoutineCard key={r.id} group={r} />
            ))}
          </div>
        )}
      </div>

      {sheetOpen && <NewRoutineSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
