import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  formatDate,
  formatCurrency,
  computeNextDueDate,
  computeDueStatus,
} from '../tracker/utils';
import type { FinanceReminder, PaymentActivity, Activity } from '../tracker/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Freeze time to a known Friday: 2026-05-22 noon UTC, so setHours(0,0,0,0) safely lands on May 22 in any TZ */
const TODAY = new Date('2026-05-22T12:00:00Z');

function ts(date: Date) {
  return Timestamp.fromDate(date);
}

function makeReminder(overrides: Partial<FinanceReminder> = {}): FinanceReminder {
  return {
    id: 'rem-1',
    type: 'finance',
    name: 'Test Bill',
    amount: 100,
    frequency: 'monthly',
    dueDay: 1,
    notes: '',
    active: true,
    createdAt: ts(new Date('2025-01-01')),
    updatedAt: ts(new Date('2025-01-01')),
    ...overrides,
  };
}

function makePayment(
  reminderId: string,
  date: string,
  status: 'paid' | 'skipped' = 'paid',
): Activity {
  const d = new Date(date + 'T12:00:00');
  return {
    type: 'payment',
    reminderId,
    amount: 100,
    status,
    date,
    notes: '',
    createdAt: ts(d),
    updatedAt: ts(d),
  } as PaymentActivity;
}

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a standard date to YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 4, 22))).toBe('2026-05-22');
  });

  it('pads single-digit month and day with zeros', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles December correctly', () => {
    expect(formatDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('prepends $ and uses en-US grouping', () => {
    expect(formatCurrency(1234, '$')).toBe('$1,234');
  });

  it('prepends ₹ and uses en-IN grouping', () => {
    // en-IN: groups differently above 1,00,000 but 1,234 is the same
    expect(formatCurrency(1234, '₹')).toBe('₹1,234');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, '$')).toBe('$0');
  });

  it('handles large amounts with £', () => {
    // £ falls through to en-US path
    expect(formatCurrency(10000, '£')).toBe('£10,000');
  });
});

// ─── computeNextDueDate ───────────────────────────────────────────────────────

describe('computeNextDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('monthly', () => {
    it('returns today when dueDay equals today (22nd)', () => {
      const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-05-22');
    });

    it('returns a future date this month when dueDay is ahead', () => {
      const item = makeReminder({ frequency: 'monthly', dueDay: 25 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-05-25');
    });

    it('rolls to next month when dueDay has already passed', () => {
      const item = makeReminder({ frequency: 'monthly', dueDay: 15 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-06-15');
    });
  });

  describe('weekly', () => {
    // Today = Friday = day 5
    it('returns today when dueDay is Friday (5)', () => {
      const item = makeReminder({ frequency: 'weekly', dueDay: 5 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-05-22');
    });

    it('returns tomorrow when dueDay is Saturday (6)', () => {
      const item = makeReminder({ frequency: 'weekly', dueDay: 6 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-05-23');
    });

    it('returns next Thursday when dueDay is Thursday (4)', () => {
      // Today is Friday; Thursday is 6 days away
      const item = makeReminder({ frequency: 'weekly', dueDay: 4 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-05-28');
    });
  });

  describe('yearly', () => {
    it('returns January of next year when current month is May', () => {
      // Jan 22 2026 < May 22 2026 → rolls to Jan 22 2027
      const item = makeReminder({ frequency: 'yearly', dueDay: 22 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2027-01-22');
    });
  });

  describe('quarterly', () => {
    it('returns the next quarter-start month that is still in the future', () => {
      // Quarter months: Jan, Apr, Jul, Oct
      // Jan 22 < May 22, Apr 22 < May 22, Jul 22 > May 22 → returns Jul 22 2026
      const item = makeReminder({ frequency: 'quarterly', dueDay: 22 });
      const next = computeNextDueDate(item);
      expect(formatDate(next)).toBe('2026-07-22');
    });
  });
});

// ─── computeDueStatus ─────────────────────────────────────────────────────────

describe('computeDueStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY); // Friday May 22, 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // — No payment scenarios —

  it('returns "due-today" when next due is today (monthly, dueDay=22)', () => {
    const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
    expect(computeDueStatus(item, [])).toBe('due-today');
  });

  it('returns "upcoming" when next due is 1 day away', () => {
    const item = makeReminder({ frequency: 'weekly', dueDay: 6 }); // Saturday
    expect(computeDueStatus(item, [])).toBe('upcoming');
  });

  it('returns "upcoming" when next due is 3 days away (monthly, dueDay=25)', () => {
    const item = makeReminder({ frequency: 'monthly', dueDay: 25 });
    expect(computeDueStatus(item, [])).toBe('upcoming');
  });

  it('returns "none" when next due is 6 days away (monthly, dueDay=28)', () => {
    const item = makeReminder({ frequency: 'monthly', dueDay: 28 });
    expect(computeDueStatus(item, [])).toBe('none');
  });

  it('returns "none" when next due is next month (monthly, dueDay=15)', () => {
    // May 15 has passed → next due = June 15 (24 days away)
    const item = makeReminder({ frequency: 'monthly', dueDay: 15 });
    expect(computeDueStatus(item, [])).toBe('none');
  });

  // — Payment within current billing cycle —

  it('returns "paid" when there is a paid payment within the current cycle', () => {
    // cycle: Apr 22 → May 22. Payment on May 20 is within cycle.
    const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
    const payments = [makePayment('rem-1', '2026-05-20', 'paid')];
    expect(computeDueStatus(item, payments)).toBe('paid');
  });

  it('returns "paid" when payment is on the same day as the due date', () => {
    const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
    const payments = [makePayment('rem-1', '2026-05-22', 'paid')];
    expect(computeDueStatus(item, payments)).toBe('paid');
  });

  it('returns "skipped" when the payment has status "skipped"', () => {
    const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
    const payments = [makePayment('rem-1', '2026-05-18', 'skipped')];
    expect(computeDueStatus(item, payments)).toBe('skipped');
  });

  // — Payment outside the current billing cycle —

  it('ignores a payment from the previous billing cycle', () => {
    // For monthly dueDay=22: current cycle starts Apr 22.
    // Payment on Apr 10 is BEFORE the cycle start → should not count.
    const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
    const payments = [makePayment('rem-1', '2026-04-10', 'paid')];
    // Still due today
    expect(computeDueStatus(item, payments)).toBe('due-today');
  });

  // — Wrong reminder ID —

  it('ignores a payment for a different reminder', () => {
    const item = makeReminder({ frequency: 'monthly', dueDay: 22 });
    const payments = [makePayment('other-rem', '2026-05-20', 'paid')];
    expect(computeDueStatus(item, payments)).toBe('due-today');
  });

  // — Weekly frequency payment check —

  it('returns "paid" for a weekly payment within current cycle (same day)', () => {
    // Weekly dueDay=5 (Friday) → nextDue=May22, prevDue=May15.
    // Payment on May 16 is within May15–May22 cycle.
    const item = makeReminder({ frequency: 'weekly', dueDay: 5 });
    const payments = [makePayment('rem-1', '2026-05-16', 'paid')];
    expect(computeDueStatus(item, payments)).toBe('paid');
  });
});
