import type { Activity, GroceryActivity } from '../types';
import { ACTIVITY_TYPE_META } from '../constants';
import { formatCurrency } from '../utils';

interface ActivityEntryRowProps {
  activity: Activity;
  currencySymbol: string;
  onEdit?: (activity: Activity) => void;
  onDelete: (id: string) => void;
  /** Used by the today-log for inline payment note editing */
  paymentLabel?: React.ReactNode;
  /** Show a date chip after the entry details (today-log, offset !== 0) */
  dateLabel?: string;
  /** CSS class prefix: 'cal' → cal-entry-*, 'log' → entry-* */
  variant?: 'cal' | 'log';
}

export default function ActivityEntryRow({
  activity: entry,
  currencySymbol,
  onEdit,
  onDelete,
  paymentLabel,
  dateLabel,
  variant = 'log',
}: ActivityEntryRowProps) {
  const isCal = variant === 'cal';
  const rowClass    = isCal ? 'cal-entry-row' : 'entry-row';
  const infoClass   = isCal ? 'cal-entry-info' : 'entry-details';
  const actionsClass = isCal ? 'cal-entry-actions' : 'entry-actions';
  const primaryClass = isCal ? 'cal-entry-primary' : 'entry-primary';
  const metaClass   = isCal ? 'cal-entry-meta' : 'entry-meta';

  const stopAndRun = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className={rowClass}>
      {isCal && (
        <span className="cal-entry-type-label">{ACTIVITY_TYPE_META[entry.type].label}</span>
      )}

      <div className={infoClass}>
        {entry.type === 'finance' && (
          <>
            <span className={`${isCal ? 'cal-entry-primary' : 'entry-amount'} ${entry.direction}`}>
              {entry.direction === 'expense' ? (isCal ? '−' : '-') : '+'}
              {formatCurrency(entry.amount, currencySymbol)}
            </span>
            {isCal
              ? entry.notes && <span className={metaClass}>{entry.notes}</span>
              : <span className={metaClass}>{entry.notes || ''}</span>
            }
          </>
        )}

        {entry.type === 'exercise' && (
          <>
            <span className={primaryClass}>
              {entry.workout.completed
                ? `Workout${entry.workout.durationMinutes ? ` — ${entry.workout.durationMinutes}min` : ''}`
                : 'Rest day'}
            </span>
            {isCal
              ? entry.notes && <span className={metaClass}>{entry.notes}</span>
              : (
                <span className={metaClass}>
                  {[
                    entry.workout.workoutType,
                    entry.health?.mood && `Mood: ${['', 'Awful', 'Bad', 'Okay', 'Good', 'Great'][entry.health.mood]}`,
                    entry.health?.weightKg && `${entry.health.weightKg}kg`,
                  ].filter(Boolean).join(' · ') || entry.notes || ''}
                </span>
              )
            }
          </>
        )}

        {entry.type === 'payment' && (
          <>
            {paymentLabel ?? (
              <span className={primaryClass}>{entry.notes || 'Payment'}</span>
            )}
            <span className={metaClass}>
              {entry.status === 'paid' ? '✓ Paid' : '⟳ Skipped'}
              {' · '}{formatCurrency(entry.amount, currencySymbol)}
            </span>
          </>
        )}

        {entry.type === 'grocery' && (
          <>
            <span className={primaryClass}>{(entry as GroceryActivity).tripName || 'Grocery trip'}</span>
            <span className={metaClass}>
              {(entry as GroceryActivity).tripMode === 'store' ? 'Store' : 'Online'}
              {(entry as GroceryActivity).tripItems?.length
                ? ` · ${(entry as GroceryActivity).tripItems.length} items`
                : ''}
            </span>
          </>
        )}

        {entry.type === 'generic' && (
          <span className={primaryClass}>{entry.notes || 'Note'}</span>
        )}

        {dateLabel && <span className="entry-date-label">{dateLabel}</span>}
      </div>

      <div className={actionsClass}>
        {(entry.type === 'finance' || entry.type === 'exercise') && onEdit && (
          <button
            className="entry-edit"
            onClick={stopAndRun(() => entry.id && onEdit(entry))}
            title="Edit"
          >
            Edit
          </button>
        )}
        {entry.type === 'payment' && (
          <button
            className="entry-unmark"
            onClick={stopAndRun(() => entry.id && onDelete(entry.id))}
            title="Unmark payment"
          >
            Unmark
          </button>
        )}
        <button
          className="entry-delete"
          onClick={stopAndRun(() => entry.id && onDelete(entry.id))}
          title="Delete"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
