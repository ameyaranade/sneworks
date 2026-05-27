import * as LucideIcons from 'lucide-react';
import { useTypesStore } from '../../stores/useTypesStore';
import type { Entry } from '../../types';
import { formatLogTitle, formatTime } from '../../utils';
import StatusDot from '../primitives/StatusDot';
import type { DotVariant } from '../primitives/StatusDot';
import './entry-row.css';

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

function TypeIcon({ name, size = 16 }: { name: string; size?: number }) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>;
  const Icon = icons[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.8} />;
}

function getDotVariant(entry: Entry): DotVariant {
  if (entry.kind === 'log') return 'log';
  if (entry.recurrenceId) return 'recurring';
  return (entry.status as DotVariant) ?? 'pending';
}

interface EntryRowProps {
  entry: Entry;
  onTap?: () => void;
  onComplete?: () => void;
  showTime?: boolean;
}

export default function EntryRow({ entry, onTap, onComplete, showTime = false }: EntryRowProps) {
  const typesMap = useTypesStore((s) => s.typesMap);
  const schema = typesMap.get(entry.typeId);

  // Merge entry.title so logFormat tokens like {title} resolve correctly
  const displayTitle = schema?.logFormat
    ? formatLogTitle(schema.logFormat, { title: entry.title, ...entry.data }) || entry.title
    : entry.title;

  const color = schema ? resolveColor(schema.color) : 'var(--lg-accent)';
  const dotVariant = getDotVariant(entry);

  const isTodo = entry.kind === 'todo';
  const isDone = entry.status === 'done';
  const isOverdue =
    isTodo &&
    entry.status === 'pending' &&
    entry.dueAt &&
    entry.dueAt.toMillis() < Date.now();

  const timeLabel =
    showTime && (entry.occurredAt ?? entry.dueAt)
      ? formatTime((entry.occurredAt ?? entry.dueAt)!)
      : null;

  return (
    <div
      className={`lg-entry-row${isDone ? ' lg-entry-row--done' : ''}${isOverdue ? ' lg-entry-row--overdue' : ''}`}
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
    >
      {/* Left: checkbox (todos) or dot (logs) */}
      <div className="lg-entry-left">
        {isTodo ? (
          <button
            type="button"
            className={`lg-entry-checkbox${isDone ? ' lg-entry-checkbox--done' : ''}`}
            style={{ borderColor: color }}
            onClick={(e) => { e.stopPropagation(); onComplete?.(); }}
            aria-label={isDone ? 'Mark pending' : 'Mark done'}
          >
            {isDone && (
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : (
          <StatusDot variant={dotVariant} size={8} />
        )}
      </div>

      {/* Body */}
      <div className="lg-entry-body">
        <span className={`lg-entry-title${isDone ? ' lg-entry-title--done' : ''}`}>
          {displayTitle || entry.title}
        </span>
        {entry.notes && (
          <span className="lg-entry-notes">{entry.notes}</span>
        )}
      </div>

      {/* Right: type badge + time */}
      <div className="lg-entry-right">
        {timeLabel && <span className="lg-entry-time">{timeLabel}</span>}
        {schema && (
          <span className="lg-entry-type-badge" style={{ color }}>
            <TypeIcon name={schema.glyph} size={14} />
          </span>
        )}
      </div>
    </div>
  );
}
