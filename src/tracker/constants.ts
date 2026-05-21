import type { FinanceCategory, PaymentFrequency, Mood, Currency, TrackerSettings } from './types';

export const FINANCE_CATEGORIES: { value: FinanceCategory; label: string; emoji: string }[] = [
  { value: 'food', label: 'Food', emoji: '🍔' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'rent', label: 'Rent', emoji: '🏠' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'entertainment', label: 'Fun', emoji: '🎬' },
  { value: 'health', label: 'Health', emoji: '💊' },
  { value: 'shopping', label: 'Shopping', emoji: '🛒' },
  { value: 'education', label: 'Education', emoji: '📚' },
  { value: 'gifts', label: 'Gifts', emoji: '🎁' },
  { value: 'other', label: 'Other', emoji: '📦' },
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

export const DEFAULT_SETTINGS: Omit<TrackerSettings, 'updatedAt'> = {
  currency: 'INR',
  currencySymbol: '₹',
  darkMode: false,
  notificationsEnabled: false,
};

export const ACTIVITY_TYPE_META = {
  finance: { label: 'Finances', emoji: '💰', color: '#2ecc71' },
  exercise: { label: 'Exercise', emoji: '💪', color: '#3498db' },
  grocery: { label: 'Groceries', emoji: '🛒', color: '#e67e22' },
  payment: { label: 'Payments', emoji: '💳', color: '#9b59b6' },
} as const;
