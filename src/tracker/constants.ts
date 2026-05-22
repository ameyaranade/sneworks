import type { FinanceCategory, PaymentFrequency, Mood, Currency, TrackerSettings } from './types';

export const FINANCE_CATEGORIES: { value: FinanceCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Fun' },
  { value: 'health', label: 'Health' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'education', label: 'Education' },
  { value: 'gifts', label: 'Gifts' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export const MOOD_OPTIONS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Awful' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export const CURRENCY_OPTIONS: { value: Currency; symbol: string; label: string }[] = [
  { value: 'INR', symbol: '₹', label: 'INR (₹)' },
  { value: 'USD', symbol: '$', label: 'USD ($)' },
];

export const ACTIVITY_PAGE_SIZE = 20;
export const ARCHIVE_PAGE_SIZE = 10;
export const UPCOMING_THRESHOLD_DAYS = 3;
export const MAX_DUE_DAY = 28;
export const RECENT_ACTIVITIES_DAYS = 365;

export const DEFAULT_SETTINGS: Omit<TrackerSettings, 'updatedAt'> = {
  currency: 'INR',
  currencySymbol: '₹',
  darkMode: false,
  notificationsEnabled: false,
};

export const ACTIVITY_TYPE_META = {
  finance:  { label: 'Finances',  emoji: '💰', color: '#2ecc71' },
  exercise: { label: 'Exercise',  emoji: '💪', color: '#3498db' },
  grocery:  { label: 'Groceries', emoji: '🛒', color: '#e67e22' },
  payment:  { label: 'Payments',  emoji: '💳', color: '#9b59b6' },
  generic:  { label: 'Other',     emoji: '📝', color: '#7f8c8d' },
} as const;

export const REMINDER_TYPE_META = {
  finance:  { label: 'Bills',      emoji: '💳', color: '#9b59b6' },
  exercise: { label: 'Exercise',   emoji: '💪', color: '#3498db' },
  grocery:  { label: 'Groceries',  emoji: '🛒', color: '#e67e22' },
  generic:  { label: 'Reminders',  emoji: '📌', color: '#7f8c8d' },
} as const;
