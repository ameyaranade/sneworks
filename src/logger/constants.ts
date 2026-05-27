import { Timestamp } from 'firebase/firestore';
import type { TypeSchema } from './types';

// Placeholder timestamp used only for the seed payload shape.
// Actual values are replaced by serverTimestamp() when written to Firestore.
const NOW = Timestamp.now();

// ─── Default built-in type schemas ────────────────────────────────────────────

export const DEFAULT_TYPE_SCHEMAS: Omit<TypeSchema, 'id'>[] = [
  // 1. Expense
  {
    name: 'Expense',
    glyph: 'IndianRupee',
    color: 'danger',
    defaultKind: 'log',
    cardLayout: 'split',
    logFormat: '₹{amount} on {category}',
    fields: [
      { key: 'amount', type: 'currency', label: 'Amount', prefix: '₹', required: true, aggregatable: true },
      {
        key: 'category',
        type: 'enum',
        label: 'Category',
        options: ['Food', 'Transport', 'Health', 'Shopping', 'Bills', 'Entertainment', 'Other'],
        required: true,
      },
      { key: 'notes', type: 'text', label: 'Notes' },
    ],
    aggregations: [{ type: 'sum', field: 'amount', label: 'Total', unit: '₹' }],
    builtIn: true,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 2. Income
  {
    name: 'Income',
    glyph: 'TrendingUp',
    color: 'success',
    defaultKind: 'log',
    cardLayout: 'split',
    logFormat: '+₹{amount} — {source}',
    fields: [
      { key: 'amount', type: 'currency', label: 'Amount', prefix: '₹', required: true, aggregatable: true },
      {
        key: 'source',
        type: 'enum',
        label: 'Source',
        options: ['Salary', 'Freelance', 'Gift', 'Investment', 'Other'],
      },
      { key: 'notes', type: 'text', label: 'Notes' },
    ],
    aggregations: [{ type: 'sum', field: 'amount', label: 'Total', unit: '₹' }],
    builtIn: true,
    sortOrder: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 3. Water
  {
    name: 'Water',
    glyph: 'Droplets',
    color: 'accent',
    defaultKind: 'log',
    cardLayout: 'counter',
    logFormat: '{amount} {unit}',
    fields: [
      { key: 'amount', type: 'number', label: 'Amount', required: true, aggregatable: true },
      {
        key: 'unit',
        type: 'enum',
        label: 'Unit',
        options: ['ml', 'glass', 'L'],
        defaultValue: 'ml',
      },
    ],
    aggregations: [{ type: 'sum', field: 'amount', label: 'Total' }],
    builtIn: true,
    sortOrder: 2,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 4. Workout
  {
    name: 'Workout',
    glyph: 'Dumbbell',
    color: '#c5b4ff',
    defaultKind: 'log',
    cardLayout: 'latest',
    logFormat: '{type} for {duration} min',
    fields: [
      {
        key: 'type',
        type: 'enum',
        label: 'Type',
        options: ['Run', 'Walk', 'Gym', 'Swim', 'Cycle', 'Yoga', 'Other'],
        required: true,
      },
      { key: 'duration', type: 'duration', label: 'Duration', suffix: 'min', required: true },
      { key: 'distance', type: 'number', label: 'Distance', suffix: 'km' },
      { key: 'mood', type: 'rating', label: 'Mood' },
      { key: 'notes', type: 'text', label: 'Notes' },
    ],
    builtIn: true,
    sortOrder: 3,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 5. Habit
  {
    name: 'Habit',
    glyph: 'Repeat',
    color: 'success',
    defaultKind: 'todo',
    cardLayout: 'progress',
    logFormat: '{title} done',
    fields: [
      { key: 'notes', type: 'text', label: 'Notes' },
    ],
    aggregations: [{ type: 'streak', label: 'Streak' }],
    builtIn: true,
    sortOrder: 4,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 6. Shopping
  {
    name: 'Shopping',
    glyph: 'ShoppingCart',
    color: 'accent',
    defaultKind: 'todo',
    cardLayout: 'checklist',
    logFormat: 'Bought {title}',
    fields: [
      { key: 'quantity', type: 'number', label: 'Qty', defaultValue: 1 },
      { key: 'price', type: 'currency', label: 'Price', prefix: '₹', aggregatable: true },
      {
        key: 'category',
        type: 'enum',
        label: 'Category',
        options: ['Groceries', 'Household', 'Personal', 'Electronics', 'Other'],
      },
    ],
    completionBridge: {
      targetTypeId: 'expense',
      askFields: ['price'],
      defaultFields: { category: 'Shopping' },
    },
    aggregations: [
      { type: 'progress', label: 'Done' },
      { type: 'sum', field: 'price', label: 'Total', unit: '₹' },
    ],
    builtIn: true,
    sortOrder: 5,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 7. Note
  {
    name: 'Note',
    glyph: 'FileText',
    color: '#8a8fa3',
    defaultKind: 'log',
    cardLayout: 'latest',
    logFormat: '{notes}',
    fields: [
      { key: 'notes', type: 'text', label: 'Note', required: true },
      {
        key: 'tag',
        type: 'enum',
        label: 'Tag',
        options: ['Idea', 'Observation', 'Reminder', 'Quote', 'Other'],
      },
    ],
    builtIn: true,
    sortOrder: 6,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // 8. Task
  {
    name: 'Task',
    glyph: 'CheckSquare',
    color: 'accent',
    defaultKind: 'todo',
    cardLayout: 'latest',
    logFormat: '{title}',
    fields: [
      {
        key: 'priority',
        type: 'enum',
        label: 'Priority',
        options: ['Low', 'Medium', 'High'],
        defaultValue: 'Medium',
      },
      { key: 'notes', type: 'text', label: 'Notes' },
    ],
    builtIn: true,
    sortOrder: 7,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ─── Logger localStorage cache key helper ─────────────────────────────────────

export const loggerCacheKey = (uid: string, key: string) =>
  `sneworks_logger_${uid}_${key}`;
