import type { Timestamp } from 'firebase/firestore';

// ─── TODO Types ───────────────────────────────────────────────────────────────

export type TodoType = 'money-reminder' | 'shopping-item' | 'generic-task';
export type TodoStatus = 'pending' | 'done' | 'skipped' | 'deferred';

export interface TodoBase {
  id?: string;
  todoType: TodoType;
  title: string;
  notes?: string;
  status: TodoStatus;
  groupId?: string;
  groupPath?: string[];
  pinnedToday?: boolean;
  dueAt?: Timestamp;
  completedAt?: Timestamp;
  recurrence?: string;
  recurrenceId?: string;
  sourceLogId?: string;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MoneyReminderTodo extends TodoBase {
  todoType: 'money-reminder';
  amount?: number;
  category?: string;
  lastCycleStatus?: 'paid' | 'skipped' | null;
  lastCycleCompletedAt?: Timestamp;
}

export interface ShoppingItemTodo extends TodoBase {
  todoType: 'shopping-item';
  categoryTag?: string;
  quantity?: number;
  price?: number;
  lastKnownPrice?: number;
}

export interface GenericTaskTodo extends TodoBase {
  todoType: 'generic-task';
}

export type Todo = MoneyReminderTodo | ShoppingItemTodo | GenericTaskTodo;

// ─── Log Types ───────────────────────────────────────────────────────────────

export type LogType = 'expense' | 'income' | 'generic-note' | 'health-log';

export interface LogBase {
  id?: string;
  logType: LogType;
  title: string;
  notes?: string;
  occurredAt: Timestamp;
  sourceTodoId?: string;
  sourceGroupId?: string;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExpenseLog extends LogBase {
  logType: 'expense';
  amount: number;
  spentOn: string;
  category?: string;
}

export interface IncomeLog extends LogBase {
  logType: 'income';
  amount: number;
  source: string;
}

export interface GenericNoteLog extends LogBase {
  logType: 'generic-note';
  noteCategory: string;
}

export interface HealthLog extends LogBase {
  logType: 'health-log';
  workoutType?: string;
  mood?: number;
  weightKg?: number;
}

export type Log = ExpenseLog | IncomeLog | GenericNoteLog | HealthLog;

// ─── Group Types ──────────────────────────────────────────────────────────────

export type GroupKind = 'shopping-list' | 'project' | 'routine';

export interface GroupBase {
  id?: string;
  groupKind: GroupKind;
  name: string;
  description?: string;
  color?: string;
  glyph?: string;
  parentGroupId?: string;
  ancestorPath: string[];
  showProgress: boolean;
  showSumMoney: boolean;
  childCount: number;
  doneCount: number;
  completed: boolean;
  completedAt?: Timestamp;
  archivedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ShoppingListGroup extends GroupBase {
  groupKind: 'shopping-list';
  priceTrackingEnabled: boolean;
  totalSpent: number;
}

export interface ProjectGroup extends GroupBase {
  groupKind: 'project';
  deadline?: Timestamp;
}

export interface TemplateItem {
  title: string;
  todoType?: TodoType;
  scheduledTime?: string;
  estimatedDuration?: number;
}

export interface RoutineGroup extends GroupBase {
  groupKind: 'routine';
  recurrence: string;
  spawnTime: string;
  templateChildren: TemplateItem[];
  lastSpawnedAt?: Timestamp;
  streakCount: number;
}

export type Group = ShoppingListGroup | ProjectGroup | RoutineGroup;

// ─── UI Context ───────────────────────────────────────────────────────────────

export type ComposeMode = 'todo' | 'log';

export interface SandboxUIContextType {
  composeOpen: boolean;
  composeMode: ComposeMode;
  composeTodoType?: TodoType;
  composeLogType?: LogType;
  composeEntry?: Todo | Log;
  composeGroupId?: string;
  openComposeTodo: (todoType?: TodoType) => void;
  openComposeLog: (logType?: LogType) => void;
  openComposeForEdit: (entry: Todo | Log) => void;
  openComposeForGroup: (groupId: string, todoType?: TodoType) => void;
  closeCompose: () => void;
  deferOpen: boolean;
  deferTodoId?: string;
  openDefer: (todoId: string) => void;
  closeDefer: () => void;
}
