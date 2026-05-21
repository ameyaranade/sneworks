import type { DueStatus, FinanceReminder, PaymentActivity, Activity } from './types';

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

export function computeNextDueDate(item: FinanceReminder): Date {
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

function computePreviousDueDate(item: FinanceReminder, nextDue: Date): Date {
  const prev = new Date(nextDue);
  switch (item.frequency) {
    case 'weekly':    prev.setDate(prev.getDate() - 7); break;
    case 'biweekly':  prev.setDate(prev.getDate() - 14); break;
    case 'monthly':   prev.setMonth(prev.getMonth() - 1); break;
    case 'quarterly': prev.setMonth(prev.getMonth() - 3); break;
    case 'yearly':    prev.setFullYear(prev.getFullYear() - 1); break;
  }
  return prev;
}

export function computeDueStatus(item: FinanceReminder, paymentActivities: Activity[]): DueStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDue = computeNextDueDate(item);

  const relevantPayments = paymentActivities.filter(
    (e): e is PaymentActivity => e.type === 'payment' && e.reminderId === item.id,
  );

  if (relevantPayments.length > 0) {
    const latest = relevantPayments[0];
    const latestDate = new Date(latest.date);
    latestDate.setHours(0, 0, 0, 0);
    // Payment on or after the start of the current billing cycle counts as paid
    const prevDue = computePreviousDueDate(item, nextDue);
    if (latestDate >= prevDue) {
      return latest.status === 'skipped' ? 'skipped' : 'paid';
    }
  }

  const diffDays = Math.floor((nextDue.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  if (diffDays <= 3) return 'upcoming';
  return 'none';
}
