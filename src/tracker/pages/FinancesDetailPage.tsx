import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { useToast } from '../components/Toast';
import { useDrawer } from '../context/DrawerContext';
import {
  subscribeToActivitiesByType,
  deleteActivity,
  addActivity,
  deleteReminder,
} from '../firebase/trackerQueries';
import { FINANCE_CATEGORIES, INCOME_CATEGORIES, ACTIVITY_PAGE_SIZE } from '../constants';
import { formatCurrency, formatDate, computeDueStatus, computeNextDueDate } from '../utils';
import DueIndicator from '../components/DueIndicator';
import type { FinanceActivity, PaymentActivity, FinanceReminder, DueStatus } from '../types';
import './finances-detail-page.css';


const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatSchedule(item: FinanceReminder): string {
  switch (item.frequency) {
    case 'weekly':    return `Every ${DAYS_OF_WEEK[item.dueDay]}`;
    case 'biweekly':  return `Every other ${DAYS_OF_WEEK[item.dueDay]}`;
    case 'monthly':   return `Monthly on the ${ordinal(item.dueDay)}`;
    case 'quarterly': return `Quarterly on the ${ordinal(item.dueDay)}`;
    case 'yearly':    return `Yearly on day ${item.dueDay}`;
    default:          return '';
  }
}

function formatEntryDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

type ListRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'entry'; entry: FinanceActivity };

function buildRows(entries: FinanceActivity[]): ListRow[] {
  const rows: ListRow[] = [];
  let lastMonth = '';
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      rows.push({ kind: 'header', key: `hdr-${month}`, label: getMonthLabel(month) });
    }
    rows.push({ kind: 'entry', entry });
  }
  return rows;
}

const STATUS_PRIORITY: Record<DueStatus, number> = {
  overdue: 0, 'due-today': 1, upcoming: 2, none: 3, paid: 4, skipped: 5,
};

function FinancesSkeleton() {
  return (
    <div className="finances-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="finances-skeleton-row">
          <div className="skeleton-block skeleton-date" />
          <div className="skeleton-block skeleton-cat" style={{ maxWidth: `${100 + (i % 3) * 30}px` }} />
          <div className="skeleton-block skeleton-amount" />
        </div>
      ))}
    </div>
  );
}

export default function FinancesDetailPage() {
  const { user } = useAuth();
  const { settings, reminders, monthActivities } = useTracker();
  const { showToast } = useToast();
  const { openDrawerWithActivity, openDrawerWithType } = useDrawer();
  const location = useLocation();

  useEffect(() => {
    const { openAdd } = (location.state ?? {}) as { openAdd?: boolean };
    if (openAdd) {
      openDrawerWithType('finance');
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [allEntries, setAllEntries] = useState<FinanceActivity[]>([]);
  const [visibleCount, setVisibleCount] = useState(ACTIVITY_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [billsExpanded, setBillsExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeToActivitiesByType<FinanceActivity>(user.uid, 'finance', (entries) => {
      setAllEntries(entries);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (loading || !sentinelRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((c) => c + ACTIVITY_PAGE_SIZE);
      },
      { threshold: 0.1 },
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, allEntries.length]);

  const financeReminders = useMemo(
    () => reminders.filter((r): r is FinanceReminder => r.type === 'finance'),
    [reminders],
  );

  const billsWithStatus = useMemo(() => {
    const paymentActivities = monthActivities.filter(
      (a): a is PaymentActivity => a.type === 'payment',
    );
    return financeReminders
      .map((item) => ({
        item,
        status: computeDueStatus(item, paymentActivities),
        nextDue: computeNextDueDate(item),
      }))
      .sort((a, b) => {
        const pDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (pDiff !== 0) return pDiff;
        return a.nextDue.getTime() - b.nextDue.getTime();
      });
  }, [financeReminders, monthActivities]);

  const handleDeleteActivity = async (activityId: string) => {
    if (!user) return;
    try {
      await deleteActivity(user.uid, activityId);
    } catch (e) {
      console.error('Delete finance activity failed:', e);
      showToast('Failed to delete entry');
    }
  };

  const handleBillAction = async (item: FinanceReminder, action: 'paid' | 'skipped') => {
    if (!user || !item.id) return;
    setActionLoading((prev) => new Set(prev).add(item.id!));
    try {
      await addActivity(user.uid, {
        type: 'payment',
        reminderId: item.id,
        amount: item.amount,
        status: action,
        date: formatDate(new Date()),
        notes: item.name,
      });
    } catch (e) {
      console.error('Record payment failed:', e);
      showToast('Failed to record payment');
    } finally {
      setActionLoading((prev) => { const next = new Set(prev); next.delete(item.id!); return next; });
    }
  };

  const handleDeleteBill = async (item: FinanceReminder) => {
    if (!user || !item.id) return;
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteReminder(user.uid, item.id);
    } catch (e) {
      console.error('Delete bill failed:', e);
      showToast('Failed to delete bill');
    }
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthEntries = allEntries.filter((e) => e.date.startsWith(currentMonth));
  const totalSpent = monthEntries.filter((e) => e.direction === 'expense').reduce((s, e) => s + e.amount, 0);
  const totalEarned = monthEntries.filter((e) => e.direction === 'income').reduce((s, e) => s + e.amount, 0);

  const visibleEntries = allEntries.slice(0, visibleCount);
  const hasMore = visibleCount < allEntries.length;
  const rows = buildRows(visibleEntries);
  const getCat = (val: string) => [...FINANCE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.value === val);

  const formatNextDue = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="finances-page">
      <div className="finances-header">
        <h2 className="page-title">Money</h2>
        <button className="page-add-btn" onClick={() => openDrawerWithType('finance')}>+ Add</button>
      </div>

      {/* Recurring Bills section — hidden when no bills exist */}
      {financeReminders.length > 0 && <div className="finances-bills-section">
        <button
          className="finances-bills-toggle"
          onClick={() => setBillsExpanded((v) => !v)}
        >
          <span>Recurring Bills</span>
          <span className="finances-bills-toggle-arrow">{billsExpanded ? '▾' : '▸'}</span>
          {financeReminders.length > 0 && (
            <span className="finances-bills-count">{financeReminders.length}</span>
          )}
        </button>

        {billsExpanded && (
          <div className="finances-bills-list">
            {financeReminders.length === 0 ? (
              <p className="finances-bills-empty">No recurring bills. Tap + → Payments to add one.</p>
            ) : (
              billsWithStatus.map(({ item, status, nextDue }) => {
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
                        onClick={() => handleDeleteBill(item)}
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
                          onClick={() => handleBillAction(item, 'paid')}
                          disabled={loading}
                        >
                          {loading ? '...' : '✓ Mark Paid'}
                        </button>
                        <button
                          className="payment-action-btn payment-action-btn--skip"
                          onClick={() => handleBillAction(item, 'skipped')}
                          disabled={loading}
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>}

      {/* Monthly summary */}
      {!loading && monthEntries.length > 0 && (
        <div className="finances-summary-card">
          <span className="finances-summary-month">
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <div className="finances-summary-stats">
            {totalSpent > 0 && (
              <div className="finances-stat expense">
                <span className="finances-stat-label">Spent</span>
                <span className="finances-stat-value">{formatCurrency(totalSpent, settings.currencySymbol)}</span>
              </div>
            )}
            {totalEarned > 0 && (
              <div className="finances-stat income">
                <span className="finances-stat-label">Earned</span>
                <span className="finances-stat-value">{formatCurrency(totalEarned, settings.currencySymbol)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finance history */}
      {loading ? (
        <FinancesSkeleton />
      ) : allEntries.length === 0 ? (
        <div className="finances-empty">
          <p className="empty-text">No finance entries yet.</p>
          <p className="empty-hint">Tap + to add your first entry.</p>
        </div>
      ) : (
        <div className="finances-list">
          <p className="finances-total-count">{allEntries.length} {allEntries.length === 1 ? 'entry' : 'entries'} total</p>
          {rows.map((row) => {
            if (row.kind === 'header') {
              return <div key={row.key} className="finances-month-header">{row.label}</div>;
            }
            const { entry } = row;
            const cat = getCat(entry.category);
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className={`finance-entry-row ${isExpanded ? 'expanded' : ''}`}>
                <button
                  className="finance-entry-main-btn"
                  onClick={() => setExpandedId(isExpanded ? null : (entry.id ?? null))}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} entry`}
                >
                  <div className="finance-entry-date">{formatEntryDate(entry.date)}</div>
                  <div className="finance-entry-body">
                    <span className="finance-entry-cat">{cat?.label}</span>
                    {entry.notes && <span className="finance-entry-notes">{entry.notes}</span>}
                  </div>
                  <div className={`finance-entry-amount ${entry.direction}`}>
                    {entry.direction === 'expense' ? '-' : '+'}
                    {formatCurrency(entry.amount, settings.currencySymbol)}
                  </div>
                  <span className={`finance-entry-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                </button>
                {isExpanded && (
                  <div className="finance-entry-actions-row">
                    <button
                      className="finance-entry-edit"
                      onClick={() => entry.id && openDrawerWithActivity(entry)}
                    >
                      Edit
                    </button>
                    <button
                      className="finance-entry-delete"
                      onClick={() => entry.id && handleDeleteActivity(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {hasMore && <div ref={sentinelRef} className="finances-load-sentinel" />}
          {!hasMore && allEntries.length > ACTIVITY_PAGE_SIZE && (
            <p className="finances-end-label">All {allEntries.length} entries loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
