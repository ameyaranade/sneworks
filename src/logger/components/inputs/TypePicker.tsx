import * as LucideIcons from 'lucide-react';
import { useTypesStore } from '../../stores/useTypesStore';
import type { TypeSchema } from '../../types';
import './type-picker.css';

// Resolve color token to actual CSS value
function resolveColor(color: string): string {
  const map: Record<string, string> = {
    accent: 'var(--lg-accent)',
    success: 'var(--lg-success)',
    danger: 'var(--lg-danger)',
    gold: 'var(--lg-gold)',
    warn: 'var(--lg-warn)',
  };
  return map[color] ?? color;
}

// Dynamically render a lucide icon by name
function TypeIcon({ name, size = 20 }: { name: string; size?: number }) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>;
  const Icon = icons[name];
  if (!Icon) return <span style={{ width: size, height: size }} />;
  return <Icon size={size} strokeWidth={1.8} />;
}

interface TypePickerProps {
  selectedTypeId?: string;
  onSelect: (type: TypeSchema) => void;
}

export default function TypePicker({ selectedTypeId, onSelect }: TypePickerProps) {
  const types = useTypesStore((s) => s.types);

  return (
    <div className="lg-type-picker">
      {types.map((type) => {
        const color = resolveColor(type.color);
        const isSelected = type.id === selectedTypeId;
        return (
          <button
            key={type.id}
            type="button"
            className={`lg-type-card${isSelected ? ' lg-type-card--selected' : ''}`}
            style={{ '--type-color': color } as React.CSSProperties}
            onClick={() => onSelect(type)}
          >
            <div className="lg-type-card-icon">
              <TypeIcon name={type.glyph} size={22} />
            </div>
            <span className="lg-type-card-name">{type.name}</span>
          </button>
        );
      })}
    </div>
  );
}
