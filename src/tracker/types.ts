import { Timestamp } from 'firebase/firestore';

// ─── Activity Types ───

export type ActivityType = 'finance' | 'exercise' | 'grocery' | 'payment';

export type FinanceCategory =
  | 'food'
  | 'transport'
  | 'rent'
  | 'utilities'
  | 'entertainment'
  | 'health'
  | 'shopping'
  | 'education'
  | 'gifts'
  | 'other';

export type FinanceDirection = 'expense' | 'income';

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type Mood = 1 | 2 | 3 | 4 | 5;

export type DueStatus = 'overdue' | 'due-today' | 'upcoming' | 'paid' | 'skipped' | 'none';

export type Currency = 'INR' | 'USD';

// ─── Entry Base ───

interface EntryBase {
  id?: string;
  type: ActivityType;
  date: string; // YYYY-MM-DD
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Entry Types ───

export interface FinanceEntry extends EntryBase {
  type: 'finance';
  amount: number;
  direction: FinanceDirection;
  category: FinanceCategory;
  target?: number;
}

export interface ExerciseEntry extends EntryBase {
  type: 'exercise';
  workout: {
    completed: boolean;
    durationMinutes?: number;
    workoutType?: string;
  };
  health?: {
    weightKg?: number;
    mood?: Mood;
  };
  target?: number;
}

export interface PaymentEntry extends EntryBase {
  type: 'payment';
  recurringItemId: string;
  amount: number;
  status: 'paid' | 'skipped';
  target?: number;
}

export type TrackerEntry = FinanceEntry | ExerciseEntry | PaymentEntry;

// ─── Grocery ───

export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  checkedAt?: Timestamp;
  addedAt: Timestamp;
  sortOrder: number;
}

export interface ActiveGroceryList {
  items: GroceryItem[];
  updatedAt: Timestamp;
}

export interface GroceryTrip {
  id?: string;
  name: string;
  items: GroceryItem[];
  tripMode: 'store' | 'online';
  completedAt: Timestamp;
  date: string; // YYYY-MM-DD
}

// ─── Recurring Items ───

export interface RecurringItem {
  id?: string;
  name: string;
  amount: number;
  frequency: PaymentFrequency;
  dueDay: number;
  notes: string;
  active: boolean;
  category?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reminderDate?: Timestamp;
  reminderSent?: boolean;
  target?: number;
}

export interface RecurringItemWithStatus extends RecurringItem {
  dueStatus: DueStatus;
  nextDueDate: Date;
  lastPaidDate?: Date;
}

// ─── Settings ───

export interface TrackerSettings {
  currency: Currency;
  currencySymbol: string;
  darkMode: boolean;
  notificationsEnabled: boolean;
  updatedAt: Timestamp;
}

// ─── Dashboard ───

export type DateRange = 'today' | 'week';
