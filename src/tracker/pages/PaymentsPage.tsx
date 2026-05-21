import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { useDrawer } from '../TrackerShell';
import { useToast } from '../components/Toast';
import { addEntry, deleteRecurringItem } from '../firebase/trackerQueries';
import { computeDueStatus, computeNextDueDate, formatDate, formatCurrency } from '../utils';
import { ACTIVITY_TYPE_META } from '../constants';
import DueIndicator from '../components/DueIndicator';
import type { RecurringItem, DueStatus } from '../types';
import './payments-page.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatSchedule(item: RecurringItem): string {
  switch (item.frequency) {
    case 'weekly':    return `Every ${DAYS_OF_WEEK[item.dueDay]}`;
    case 'biweekly':  return `Every other ${DAYS_OF_WEEK[item.dueDay]}`;
    case 'monthly':   return `Monthly on the ${ordinal(item.dueDay)}`;
    case 'quarterly': return `Quarterly on the ${ordinal(item.dueDay)}`;
    case 'yearly':    return `Yearly on day ${item.dueDay}`;
    default:          return '';
  }
}

const STATUS_PRIORITY: Record<DueStatus, number> = {
  overdue: 0,
  'due-today': 1,
  upcoming: 2,
  none: 3,
  paid: 4,
  skipped: 5,
};

interface ItemWithStatus {
  item: RecurringItem;
  status: DueStatus;
  nextDue: Date;
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const { recurringItems, monthEntries, settings } = useTracker();
  const { openDrawer } = useDrawer();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  const itemsWithStatus = useMemo<ItemWithStatus[]>(() => {
    return recurringItems
      .map((item) => ({
        item,
        status: computeDueStatus(item, monthEntries),
        nextDue: computeNextDueDate(item),
      }))
      .sort((a, b) => {
        const pDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (pDiff !== 0) return pDiff;
        return a.nextDue.getTime() - b.nextDue.getTime();
      });
  }, [recurringItems, monthEntries]);

  const urgent = itemsWithStatus.filter(({ status }) => status === 'overdue' || status === 'due-today');
  const upcoming = itemsWithStatus.filter(({ status }) => status === 'upcoming');
  const rest = itemsWithStatus.filter(({ status }) => status !== 'overdue' && status !== 'due-today' && status !== 'upcoming');

  const handleAction = async (item: RecurringItem, action: 'paid' | 'skipped') => {
    if (!user || !item.id) return;
    setActionLoading((prev) => new Set(prev).add(item.id!));
    try {
      await addEntry(user.uid, {
        type: 'payment',
        recurringItemId: item.id,
        amount: item.amount,
        status: action,
        date: formatDate(new Date()),
        notes: item.name,
      });
    } catch (e) {
      console.error('Record payment failed:', e);
      showToast('Failed to record payment');
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(item.id!);
        return next;
      });
    }
  };

  const handleDelete = async (item: RecurringItem) => {
    if (!user || !item.id) return;
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteRecurringItem(user.uid, item.id);
    } catch (e) {
      console.error('Delete recurring item failed:', e);
      showToast('Failed to delete payment');
    }
  };

  const formatNextDue = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const renderCard = ({ item, status, nextDue }: ItemWithStatus) => {
    const loading = actionLoading.has(item.id!);
    const isDone = status === 'paid' || status === 'skipped';
    return (
      <div key={item.id} className={`payment-card payment-card--${status}`}>
        <div className="payment-card-top">
          <div className="payment-card-info">
            <span className="payment-card-name">{item.name}</span>
            <DueIndicator status={status} />
          </div>
          <button
            className="payment-card-delete"
            onClick={() => handleDelete(item)}
            title="Delete"
            aria-label="Delete recurring payment"
          >
            &times;
          </button>
        </div>
        <div className="payment-card-meta">
          <span className="payment-amount">{formatCurrency(item.amount, settings.currencySymbol)}</span>
          <span className="payment-schedule">{formatSchedule(item)}</span>
          {!isDone && (
            <span className="payment-next-due">Next: {formatNextDue(nextDue)}</span>
          )}
        </div>
        {!isDone && (
          <div className="payment-card-actions">
            <button
              className="payment-action-btn payment-action-btn--paid"
              onClick={() => handleAction(item, 'paid')}
              disabled={loading}
            >
              {loading ? '...' : '✓ Mark Paid'}
            </button>
            <button
              className="payment-action-btn payment-action-btn--skip"
              onClick={() => handleAction(item, 'skipped')}
              disabled={loading}
            >
              Skip
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="payments-page">
      <div className="payments-header">
        <h2 className="page-title">
          {ACTIVITY_TYPE_META.payment.emoji} Payments
        </h2>
        <button className="payments-add-btn" onClick={openDrawer}>
          + Add
        </button>
      </div>

      {recurringItems.length === 0 ? (
        <div className="payments-empty">
          <p className="empty-text">No recurring payments set up yet.</p>
          <p className="empty-hint">Tap + Add to create your first one.</p>
        </div>
      ) : (
        <>
          {urgent.length > 0 && (
            <section className="payments-section">
              <h3 className="payments-section-title">Needs Attention</h3>
              {urgent.map(renderCard)}
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="payments-section">
              <h3 className="payments-section-title">Due Soon</h3>
              {upcoming.map(renderCard)}
            </section>
          )}

          {rest.length > 0 && (
            <section className="payments-section">
              <h3 className="payments-section-title">All Payments</h3>
              {rest.map(renderCard)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
