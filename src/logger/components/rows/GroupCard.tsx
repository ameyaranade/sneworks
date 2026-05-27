import { useNavigate } from 'react-router-dom';
import type { Group } from '../../types';
import './group-card.css';

interface GroupCardProps {
  group: Group;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="lg-group-progress-track">
      <div className="lg-group-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();

  const stripeColor =
    group.kind === 'project'
      ? 'var(--lg-gold)'
      : group.kind === 'routine'
      ? 'var(--lg-purple)'
      : 'var(--lg-accent)';

  const hasItems = group.childCount > 0;

  return (
    <button
      type="button"
      className="lg-group-card"
      style={{ '--stripe-color': stripeColor } as React.CSSProperties}
      onClick={() => navigate(`/logger/groups/${group.id}`)}
    >
      {/* Header */}
      <div className="lg-group-card-header">
        <span className="lg-group-name">{group.name}</span>
        <span className="lg-group-kind">{group.kind}</span>
      </div>

      {/* Aggregation strip */}
      {hasItems && (
        <div className="lg-group-agg-strip">
          {group.showProgress && (
            <>
              <span className="lg-agg-cell">
                <span className="lg-agg-value">{group.doneCount}</span>
                <span className="lg-agg-label">/{group.childCount}</span>
              </span>
              <ProgressBar done={group.doneCount} total={group.childCount} />
            </>
          )}
          {group.showSumMoney && group.totalSpent > 0 && (
            <span className="lg-agg-cell">
              <span className="lg-agg-label">₹</span>
              <span className="lg-agg-value">{group.totalSpent.toLocaleString('en-IN')}</span>
            </span>
          )}
          {group.showDeadline && group.deadline && (
            <span className="lg-agg-cell">
              <span className="lg-agg-label">Due</span>
              <span className="lg-agg-value">
                {group.deadline.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </span>
          )}
        </div>
      )}
    </button>
  );
}
