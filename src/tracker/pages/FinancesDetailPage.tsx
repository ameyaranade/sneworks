import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { useToast } from '../components/Toast';
import { useDrawer } from '../TrackerShell';
import { subscribeToEntriesByType, deleteEntry } from '../firebase/trackerQueries';
import { FINANCE_CATEGORIES } from '../constants';
import { formatCurrency } from '../utils';
import type { FinanceEntry } from '../types';
import './finances-detail-page.css';

const PAGE_SIZE = 20;

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
  | { kind: 'entry'; entry: FinanceEntry };

function buildRows(entries: FinanceEntry[]): ListRow[] {
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
  const { settings } = useTracker();
  const { showToast } = useToast();
  const { openDrawerWithEntry } = useDrawer();
  const [allEntries, setAllEntries] = useState<FinanceEntry[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeToEntriesByType<FinanceEntry>(user.uid, 'finance', (entries) => {
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
        if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { threshold: 0.1 },
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, allEntries.length]);

  const handleDelete = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteEntry(user.uid, entryId);
    } catch (e) {
      console.error('Delete finance entry failed:', e);
      showToast('Failed to delete entry');
    }
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthEntries = allEntries.filter((e) => e.date.startsWith(currentMonth));
  const totalSpent = monthEntries
    .filter((e) => e.direction === 'expense')
    .reduce((s, e) => s + e.amount, 0);
  const totalEarned = monthEntries
    .filter((e) => e.direction === 'income')
    .reduce((s, e) => s + e.amount, 0);

  const visibleEntries = allEntries.slice(0, visibleCount);
  const hasMore = visibleCount < allEntries.length;
  const rows = buildRows(visibleEntries);

  const getCat = (val: string) => FINANCE_CATEGORIES.find((c) => c.value === val);

  return (
    <div className="finances-page">
      <div className="finances-header">
        <h2 className="page-title">💰 Finances</h2>
      </div>

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
            return (
              <div key={entry.id} className="finance-entry-row">
                <div className="finance-entry-date">{formatEntryDate(entry.date)}</div>
                <div className="finance-entry-body">
                  <span className="finance-entry-cat">{cat?.emoji} {cat?.label}</span>
                  {entry.notes && <span className="finance-entry-notes">{entry.notes}</span>}
                </div>
                <div className={`finance-entry-amount ${entry.direction}`}>
                  {entry.direction === 'expense' ? '-' : '+'}
                  {formatCurrency(entry.amount, settings.currencySymbol)}
                </div>
                <button
                  className="finance-entry-edit"
                  onClick={() => entry.id && openDrawerWithEntry(entry)}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  className="finance-entry-delete"
                  onClick={() => entry.id && handleDelete(entry.id)}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            );
          })}
          {hasMore && <div ref={sentinelRef} className="finances-load-sentinel" />}
          {!hasMore && allEntries.length > PAGE_SIZE && (
            <p className="finances-end-label">All {allEntries.length} entries loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
