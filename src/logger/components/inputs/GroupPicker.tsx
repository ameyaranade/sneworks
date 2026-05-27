import { useGroupsStore } from '../../stores/useGroupsStore';
import type { Group } from '../../types';
import './group-picker.css';

interface GroupPickerProps {
  selectedGroupId?: string;
  onSelect: (group: Group | null) => void;
}

function stripeColor(kind: string): string {
  if (kind === 'project') return 'var(--lg-gold)';
  if (kind === 'routine') return 'var(--lg-purple)';
  return 'var(--lg-accent)';
}

export default function GroupPicker({ selectedGroupId, onSelect }: GroupPickerProps) {
  const groups = useGroupsStore((s) => s.groups);

  if (groups.length === 0) return null;

  return (
    <div className="lg-group-picker">
      <span className="lg-group-picker-label">Group</span>
      <div className="lg-group-picker-chips">
        {/* "None" option */}
        <button
          type="button"
          className={`lg-group-chip${!selectedGroupId ? ' lg-group-chip--selected' : ''}`}
          onClick={() => onSelect(null)}
        >
          None
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`lg-group-chip${selectedGroupId === g.id ? ' lg-group-chip--selected' : ''}`}
            style={{ '--chip-color': stripeColor(g.kind) } as React.CSSProperties}
            onClick={() => onSelect(selectedGroupId === g.id ? null : g)}
          >
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}
