import { useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import { useGroupsStore } from '../../stores/useGroupsStore';
import type { GroupKind } from '../../types';
import BottomSheet from '../primitives/BottomSheet';
import './group-create-sheet.css';

interface GroupCreateSheetProps {
  onClose: () => void;
}

const KIND_OPTIONS: { value: GroupKind; label: string; desc: string }[] = [
  { value: 'list', label: 'List', desc: 'Shopping, errands, or any checklist' },
  { value: 'project', label: 'Project', desc: 'Finite goal with a deadline' },
  { value: 'routine', label: 'Routine', desc: 'Recurring set of habits or tasks' },
];

export default function GroupCreateSheet({ onClose }: GroupCreateSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addGroup = useGroupsStore((s) => s.addGroup);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('list');
  const [showProgress, setShowProgress] = useState(true);
  const [showSumMoney, setShowSumMoney] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await addGroup(user.uid, {
        name: name.trim(),
        kind,
        color: kind === 'project' ? 'gold' : kind === 'routine' ? 'purple' : 'accent',
        glyph: kind === 'list' ? 'CheckSquare' : kind === 'project' ? 'FolderOpen' : 'Repeat',
        ancestorPath: [],
        showProgress,
        showSumMoney,
        showBudget: false,
        showDeadline,
        showTime: false,
        showStreak: kind === 'routine',
        childCount: 0,
        doneCount: 0,
        totalSpent: 0,
      });
      showToast(`${name.trim()} created`, 'success');
      onClose();
    } catch {
      showToast('Failed to create group.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New group">
      <div className="lg-group-create">
        {/* Name */}
        <div className="lg-gc-field">
          <label className="lg-gc-label">Name</label>
          <input
            type="text"
            className="lg-gc-input"
            value={name}
            placeholder="e.g. Groceries, Diwali trip, Morning routine"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Kind */}
        <div className="lg-gc-field">
          <label className="lg-gc-label">Type</label>
          <div className="lg-gc-kind-grid">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`lg-gc-kind-btn${kind === opt.value ? ' lg-gc-kind-btn--active' : ''}`}
                onClick={() => setKind(opt.value)}
              >
                <span className="lg-gc-kind-name">{opt.label}</span>
                <span className="lg-gc-kind-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aggregation toggles */}
        <div className="lg-gc-field">
          <label className="lg-gc-label">Show</label>
          <div className="lg-gc-toggles">
            <ToggleRow label="Progress bar" value={showProgress} onChange={setShowProgress} />
            <ToggleRow label="Money total" value={showSumMoney} onChange={setShowSumMoney} />
            <ToggleRow label="Deadline" value={showDeadline} onChange={setShowDeadline} />
          </div>
        </div>

        <button
          type="button"
          className="lg-gc-save-btn"
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? 'Creating…' : `Create ${name.trim() || kind}`}
        </button>
      </div>
    </BottomSheet>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="lg-toggle-row">
      <span className="lg-toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`lg-switch${value ? ' lg-switch--on' : ''}`}
        onClick={() => onChange(!value)}
      >
        <span className="lg-switch-thumb" />
      </button>
    </div>
  );
}
