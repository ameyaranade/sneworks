import { Timestamp } from 'firebase/firestore';

// ─── Shared Enums ───

export type ActivityType = 'finance' | 'exercise' | 'grocery' | 'payment' | 'generic';
export type ReminderType = 'finance' | 'exercise' | 'grocery' | 'generic';

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
export type DateRange = 'today' | 'week';

// ─── Activity Types (discriminated union on `type`) ───

interface ActivityBase {
  id?: string;
  type: ActivityType;
  date: string; // YYYY-MM-DD
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinanceActivity extends ActivityBase {
  type: 'finance';
  amount: number;
  direction: FinanceDirection;
  category: FinanceCategory;
}

export interface ExerciseActivity extends ActivityBase {
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
}

export interface PaymentActivity extends ActivityBase {
  type: 'payment';
  reminderId: string;
  amount: number;
  status: 'paid' | 'skipped';
}

export interface GroceryTripItem {
  id: string;
  name: string;
  checked: boolean;
  checkedAt?: Timestamp;
}

export interface GroceryActivity extends ActivityBase {
  type: 'grocery';
  tripName: string;
  tripMode: 'store' | 'online';
  tripItems: GroceryTripItem[];
}

export interface GenericActivity extends ActivityBase {
  type: 'generic';
}

export type Activity =
  | FinanceActivity
  | ExerciseActivity
  | PaymentActivity
  | GroceryActivity
  | GenericActivity;

// ─── Reminder Types (discriminated union on `type`) ───

interface ReminderBase {
  id?: string;
  type: ReminderType;
  name: string;
  notes: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinanceReminder extends ReminderBase {
  type: 'finance';
  amount: number;
  frequency: PaymentFrequency;
  dueDay: number;
  category?: string;
}

export interface ExerciseReminder extends ReminderBase {
  type: 'exercise';
  dueDate?: string; // YYYY-MM-DD
}

export interface GroceryReminder extends ReminderBase {
  type: 'grocery';
  checked: boolean;
  checkedAt?: Timestamp;
  sortOrder: number;
}

export interface GenericReminder extends ReminderBase {
  type: 'generic';
  dueDate?: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: Timestamp;
}

export type Reminder =
  | FinanceReminder
  | ExerciseReminder
  | GroceryReminder
  | GenericReminder;

export interface FinanceReminderWithStatus extends FinanceReminder {
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

