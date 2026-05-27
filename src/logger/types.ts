import type { Timestamp } from 'firebase/firestore';

// ─── Schema field types ───────────────────────────────────────────────────────

export type SchemaFieldType =
  | 'number'
  | 'text'
  | 'enum'
  | 'date'
  | 'duration'
  | 'currency'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'time'
  | 'rating'
  | 'url';

export interface SchemaField {
  key: string;
  type: SchemaFieldType;
  label: string;
  prefix?: string;       // "₹" for currency
  suffix?: string;       // "ml" for water, "min" for duration
  options?: string[];    // for enum/select/multi-select
  required?: boolean;
  defaultValue?: unknown;
  aggregatable?: boolean; // can be summed across entries
}

// ─── Aggregation & completion bridge ─────────────────────────────────────────

export type AggregationType = 'sum' | 'count' | 'average' | 'streak' | 'progress';

export interface AggregationConfig {
  type: AggregationType;
  field?: string;   // which SchemaField to aggregate
  label?: string;   // display label
  unit?: string;    // display unit
}

export interface CompletionBridge {
  targetTypeId: string;        // e.g., "expense"
  askFields: string[];         // fields to prompt for on completion
  defaultFields: Record<string, unknown>; // pre-filled values
}

// ─── TypeSchema ───────────────────────────────────────────────────────────────

export type CardLayout = 'split' | 'latest' | 'progress' | 'counter' | 'checklist';

export interface TypeSchema {
  id?: string;
  name: string;
  glyph: string;           // lucide icon name
  color: string;           // 'gold' | 'accent' | 'success' | '#hex'
  fields: SchemaField[];
  defaultKind: 'log' | 'todo';
  cardLayout: CardLayout;
  logFormat?: string;      // "{amount} spent on {category}"
  aggregations?: AggregationConfig[];
  completionBridge?: CompletionBridge;
  builtIn?: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Entry (unified Log + Todo) ───────────────────────────────────────────────

export type EntryStatus = 'pending' | 'done' | 'skipped' | 'deferred';
export type EntrySource = 'manual' | 'quick-add' | 'parsed' | 'recurring';

export interface Entry {
  id?: string;
  kind: 'log' | 'todo';
  typeId: string;               // → logger_types/{typeId}
  title: string;
  notes?: string;
  data: Record<string, unknown>; // schema-driven field values
  occurredAt?: Timestamp;       // logs: when it happened
  dueAt?: Timestamp;            // todos: when due
  completedAt?: Timestamp;
  status?: EntryStatus;
  groupId?: string;
  groupPath?: string[];         // breadcrumb chain ["Diwali", "Gifts"]
  pinnedToday?: boolean;
  recurrenceId?: string;
  instanceOf?: string;          // spawned from routine template
  sortOrder: number;
  source: EntrySource;
  confidence?: Record<string, number>; // for parsed fields
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Group ────────────────────────────────────────────────────────────────────

export type GroupKind = 'project' | 'list' | 'routine';

export interface Group {
  id?: string;
  name: string;
  kind: GroupKind;
  color: string;
  glyph: string;
  parentGroupId?: string;
  ancestorPath: string[];
  // Project-specific
  deadline?: Timestamp;
  budget?: number;
  // Routine-specific
  routineId?: string;
  instanceDate?: string;   // "2026-05-22"
  // List-specific
  autoMerge?: boolean;
  // Aggregation flags
  showProgress: boolean;
  showSumMoney: boolean;
  showBudget: boolean;
  showDeadline: boolean;
  showTime: boolean;
  showStreak: boolean;
  // Denormalized counts (recomputed on entry write)
  childCount: number;
  doneCount: number;
  totalSpent: number;
  archivedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Routine (recurrence template) ───────────────────────────────────────────

export interface TemplateItem {
  title: string;
  typeId?: string;
  scheduledTime?: string;       // "06:15"
  estimatedDuration?: number;   // minutes
}

export interface Routine {
  id?: string;
  name: string;
  recurrence: string;           // RRule string e.g. "FREQ=DAILY"
  spawnTime: string;            // "06:00"
  templateChildren: TemplateItem[];
  aggregations: ('progress' | 'streak')[];
  lastSpawnedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Insight / suggestion ─────────────────────────────────────────────────────

export type InsightKind = 'goal-suggestion' | 'pattern-detected' | 'completion-bridge';
export type InsightStatus = 'pending' | 'accepted' | 'dismissed' | 'expired';

export interface Insight {
  id?: string;
  kind: InsightKind;
  status: InsightStatus;
  triggeredBy: string;   // entry ID or pattern name
  payload: unknown;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  resolvedAt?: Timestamp;
}

// ─── Logger UI context types ───────────────────────────────────────────────────

export interface LoggerUIContextType {
  composeOpen: boolean;
  composeEntry?: Entry;          // set when editing existing entry
  composeTypeId?: string;        // set when pre-selecting a type
  composeDate?: Date;            // set when composing for a specific date
  composeGroupId?: string;       // set when opening from a group detail page
  openCompose: () => void;
  openComposeWithType: (typeId: string) => void;
  openComposeForEdit: (entry: Entry) => void;
  openComposeForDate: (date: Date) => void;
  openComposeForGroup: (groupId: string) => void;
  closeCompose: () => void;
  deferOpen: boolean;
  deferEntryId?: string;
  openDefer: (entryId: string) => void;
  closeDefer: () => void;
}
