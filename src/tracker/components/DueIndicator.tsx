import type { DueStatus } from '../types';

interface Props {
  status: DueStatus;
}

const STATUS_CONFIG: Partial<Record<DueStatus, { label: string; color: string; bg: string }>> = {
  overdue:    { label: 'Overdue',   color: '#e74c3c', bg: '#fdedec' },
  'due-today': { label: 'Due Today', color: '#e67e22', bg: '#fef3e2' },
  upcoming:   { label: 'Due Soon',  color: '#f39c12', bg: '#fef9e7' },
  paid:       { label: 'Paid',      color: '#27ae60', bg: '#eafaf1' },
  skipped:    { label: 'Skipped',   color: '#95a5a6', bg: '#f4f4f4' },
};

export default function DueIndicator({ status }: Props) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        color: config.color,
        background: config.bg,
        letterSpacing: '0.2px',
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}
