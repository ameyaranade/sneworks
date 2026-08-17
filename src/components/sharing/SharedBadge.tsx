import { Users } from 'lucide-react';
import './sharing.css';

interface SharedBadgeProps {
  memberCount: number;
  className?: string;
}

/** Persistent indicator shown wherever a project appears, whenever memberCount > 1 (spec §5.1). */
export default function SharedBadge({ memberCount, className = '' }: SharedBadgeProps) {
  if (memberCount <= 1) return null;

  const others = memberCount - 1;
  return (
    <span
      className={`sn-shared-badge ${className}`}
      title={`Shared with ${others} other${others === 1 ? '' : 's'}`}
    >
      <Users size={12} strokeWidth={2} aria-hidden="true" />
      <span className="sn-shared-badge-count">{memberCount}</span>
    </span>
  );
}
