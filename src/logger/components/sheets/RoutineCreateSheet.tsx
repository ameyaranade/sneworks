import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import { useRoutinesStore } from '../../stores/useRoutinesStore';
import { useTypesStore } from '../../stores/useTypesStore';
import type { TemplateItem } from '../../types';
import BottomSheet from '../primitives/BottomSheet';
import './routine-create-sheet.css';

interface RoutineCreateSheetProps {
  onClose: () => void;
}

const RECURRENCE_OPTIONS = [
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekdays', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
];

export default function RoutineCreateSheet({ onClose }: RoutineCreateSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addRoutine = useRoutinesStore((s) => s.addRoutine);
  const types = useTypesStore((s) => s.types);

  const [name, setName] = useState('');
  const [recurrence, setRecurrence] = useState('FREQ=DAILY');
  const [spawnTime, setSpawnTime] = useState('06:00');
  const [items, setItems] = useState<TemplateItem[]>([{ title: '' }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((prev) => [...prev, { title: '' }]);

  const updateItem = (idx: number, partial: Partial<TemplateItem>) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...partial } : item)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    const validItems = items.filter((i) => i.title.trim());
    if (validItems.length === 0) {
      showToast('Add at least one item.', 'error');
      return;
    }
    setSaving(true);
    try {
      await addRoutine(user.uid, {
        name: name.trim(),
        recurrence,
        spawnTime,
        templateChildren: validItems.map((i) => ({ ...i, title: i.title.trim() })),
        aggregations: ['progress', 'streak'],
      });
      showToast(`${name.trim()} routine created`, 'success');
      onClose();
    } catch {
      showToast('Failed to create routine.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New Routine">
      <div className="lg-rc-form">
        {/* Name */}
        <div className="lg-rc-field">
          <label className="lg-rc-label">Name</label>
          <input
            type="text"
            className="lg-rc-input"
            value={name}
            placeholder="e.g. Morning, Evening Wind-down"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Recurrence */}
        <div className="lg-rc-field">
          <label className="lg-rc-label">Repeats</label>
          <div className="lg-rc-chips">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`lg-rc-chip${recurrence === opt.value ? ' lg-rc-chip--active' : ''}`}
                onClick={() => setRecurrence(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spawn time */}
        <div className="lg-rc-field">
          <label className="lg-rc-label">Spawn time</label>
          <input
            type="time"
            className="lg-rc-input lg-rc-input--time"
            value={spawnTime}
            onChange={(e) => setSpawnTime(e.target.value)}
          />
        </div>

        {/* Template items */}
        <div className="lg-rc-field">
          <label className="lg-rc-label">Items</label>
          <div className="lg-rc-items">
            {items.map((item, idx) => (
              <div key={idx} className="lg-rc-item-row">
                <input
                  type="text"
                  className="lg-rc-input lg-rc-input--item"
                  placeholder={`Item ${idx + 1}`}
                  value={item.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                />
                {types.length > 0 && (
                  <select
                    className="lg-rc-type-select"
                    value={item.typeId ?? ''}
                    onChange={(e) => updateItem(idx, { typeId: e.target.value || undefined })}
                  >
                    <option value="">Type…</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
                {items.length > 1 && (
                  <button
                    type="button"
                    className="lg-rc-remove-btn"
                    onClick={() => removeItem(idx)}
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="lg-rc-add-item-btn"
              onClick={addItem}
            >
              <Plus size={14} strokeWidth={2.5} />
              Add item
            </button>
          </div>
        </div>

        <button
          type="button"
          className="lg-rc-save-btn"
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? 'Creating…' : `Create routine`}
        </button>
      </div>
    </BottomSheet>
  );
}
