import type { DueStatus, RecurringItem, PaymentEntry, TrackerEntry } from './types';

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekRange(d: Date): { start: string; end: string } {
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatDate(start), end: formatDate(end) };
}

export function formatCurrency(amount: number, symbol: string): string {
  if (symbol === '₹') {
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  }
  return `${symbol}${amount.toLocaleString('en-US')}`;
}

export function computeNextDueDate(item: RecurringItem): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (item.frequency) {
    case 'weekly': {
      const diff = (item.dueDay - today.getDay() + 7) % 7;
      const next = new Date(today);
      next.setDate(today.getDate() + (diff === 0 ? 0 : diff));
      return next;
    }
    case 'biweekly': {
      const created = item.createdAt?.toDate?.() ?? today;
      const weeksSince = Math.floor((today.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const isThisWeek = weeksSince % 2 === 0;
      const diff = (item.dueDay - today.getDay() + 7) % 7;
      const next = new Date(today);
      next.setDate(today.getDate() + diff + (isThisWeek ? 0 : 7));
      return next;
    }
    case 'monthly': {
      const next = new Date(today.getFullYear(), today.getMonth(), item.dueDay);
      if (next < today) next.setMonth(next.getMonth() + 1);
      return next;
    }
    case 'quarterly': {
      const quarterMonths = [0, 3, 6, 9];
      for (const m of quarterMonths) {
        const candidate = new Date(today.getFullYear(), m, item.dueDay);
        if (candidate >= today) return candidate;
      }
      return new Date(today.getFullYear() + 1, 0, item.dueDay);
    }
    case 'yearly': {
      const next = new Date(today.getFullYear(), 0, item.dueDay);
      if (next < today) next.setFullYear(next.getFullYear() + 1);
      return next;
    }
    default:
      return today;
  }
}

export function computeDueStatus(item: RecurringItem, paymentEntries: TrackerEntry[]): DueStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDue = computeNextDueDate(item);

  const relevantPayments = paymentEntries.filter(
    (e): e is PaymentEntry => e.type === 'payment' && e.recurringItemId === item.id,
  );

  if (relevantPayments.length > 0) {
    const latest = relevantPayments[0];
    const latestDate = new Date(latest.date);
    latestDate.setHours(0, 0, 0, 0);
    if (latestDate >= nextDue) {
      return latest.status === 'skipped' ? 'skipped' : 'paid';
    }
  }

  const diffDays = Math.floor((nextDue.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  if (diffDays <= 3) return 'upcoming';
  return 'none';
}
