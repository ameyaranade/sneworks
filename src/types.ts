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
  // AI-assist (functions/src/ai/processAiTask.ts): client sets aiAssist; the
  // rest are server-written outcomes (see firestore.rules).
  aiAssist?: boolean;
  aiProcessedAt?: Timestamp;
  aiResult?: { id?: string; htmlLink?: string };
  aiError?: string;
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

// ─── Health Enums ────────────────────────────────────────────────────────────

export type WorkoutType = 'Run' | 'Walk' | 'Cycle' | 'Gym' | 'Yoga' | 'Swim' | 'Other';
export type IntensityLevel = 'Low' | 'Moderate' | 'High' | 'Max';

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
  workoutType?: WorkoutType;
  mood?: number;
  weightKg?: number;
  durationMin?: number;
  durationSec?: number;
  intensity?: IntensityLevel;
  caloriesBurned?: number;
  caloriesEstimated?: boolean;
  distanceValue?: number;
  distanceUnit?: 'km' | 'm';
  sets?: number;
  reps?: number;
  sourceRoutineId?: string;
  sourceTemplateIdx?: number;
}

export type Log = ExpenseLog | IncomeLog | GenericNoteLog | HealthLog;

// ─── Group Types ──────────────────────────────────────────────────────────────

export type GroupKind = 'shopping-list' | 'project' | 'routine' | 'recurring-todo';

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

// ─── Sharing (projects + shopping lists, docs/SHAREABLE_PROJECTS_SPEC.md §8) ──

/** Undefined/'personal' = lives under users/{uid}/groups. 'shared' = top-level sharedProjects/{gid}. */
export type GroupLocation = 'personal' | 'shared';

export interface MemberInfo {
  name: string;
  email: string;
}

export interface SharedFields {
  location: 'shared';
  /** Doc id === group id when this is the shared root; matches parent's for sub-projects. */
  rootSharedId: string;
  ownerUid: string;
  /** ACL — ties to the doc id in top-level sharedProjects/{gid}. Mutated only by Cloud Functions. */
  members: Record<string, true>;
  /** Denormalized display info per member uid, kept in sync by the same functions as `members`. */
  memberNames: Record<string, MemberInfo>;
  /** Denormalized Object.keys(members).length — drives the persistent shared badge (>1). */
  memberCount: number;
}

export interface ShoppingListGroup extends GroupBase {
  groupKind: 'shopping-list';
  priceTrackingEnabled: boolean;
  totalSpent: number;
  // Sharing — present only when location === 'shared'.
  location?: GroupLocation;
  rootSharedId?: string;
  ownerUid?: string;
  members?: Record<string, true>;
  memberNames?: Record<string, MemberInfo>;
  memberCount?: number;
}

/** A ShoppingListGroup that has been shared — lives in top-level sharedProjects/{gid}. */
export type SharedShoppingListGroup = ShoppingListGroup & SharedFields;

export interface ProjectGroup extends GroupBase {
  groupKind: 'project';
  deadline?: Timestamp;
  // Sharing (docs/SHAREABLE_PROJECTS_SPEC.md, D8) — present only when location === 'shared'.
  location?: GroupLocation;
  rootSharedId?: string;
  ownerUid?: string;
  members?: Record<string, true>;
  memberNames?: Record<string, MemberInfo>;
  memberCount?: number;
}

/** A ProjectGroup that has been shared — lives in top-level sharedProjects/{gid}. All SharedFields present. */
export type SharedProjectGroup = ProjectGroup & SharedFields;

export interface TemplateItem {
  title: string;
  todoType?: TodoType;
  scheduledTime?: string;
  estimatedDuration?: number;
  // Health workout fields (ignored by generic routines)
  isWorkout?: boolean;
  workoutType?: WorkoutType;
  targetDurationMin?: number;
  targetIntensity?: IntensityLevel;
  targetDistanceValue?: number;
  targetDistanceUnit?: 'km' | 'm';
  targetSets?: number;
  targetReps?: number;
}

export interface RoutineGroup extends GroupBase {
  groupKind: 'routine';
  recurrence: string;
  spawnTime: string;
  templateChildren: TemplateItem[];
  lastSpawnedAt?: Timestamp;
  streakCount: number;
  deferUntil?: Timestamp; // if set and > now, routine is paused (skip spawn)
  // Health routine fields (undefined/false = generic routine)
  isHealthRoutine?: boolean;
  dailyCalorieGoal?: number;
  dailyDurationGoal?: number;
  weeklySessionGoal?: number;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
}

/** A recurring single-item routine: spawns one todo on each due date. */
export interface RecurringTodoGroup extends GroupBase {
  groupKind: 'recurring-todo';
  /** What kind of todo to spawn each cycle. */
  recurTodoType: 'generic-task' | 'money-reminder';
  /**
   * Recurrence pattern (same encoding as RoutineGroup):
   *   'daily' | 'weekdays' | 'weekly:MON' |
   *   'monthly:N' | 'quarterly:N' | 'yearly:N'
   */
  recurrence: string;
  amount?: number;    // money-reminder only
  category?: string;  // money-reminder only
  lastSpawnedAt?: Timestamp;
  streakCount: number;
}

export type Group = ShoppingListGroup | ProjectGroup | RoutineGroup | RecurringTodoGroup;

// ─── Shared-group support types ────────────────────────────────────────────────

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

/** Firestore: top-level invites/{id}. Mutated only by Cloud Functions. */
export interface Invite {
  id?: string;
  pid: string;
  projectName: string;
  invitedEmail: string;
  invitedBy: string;
  invitedByName?: string;
  invitedByEmail?: string;
  status: InviteStatus;
  createdAt: Timestamp;
}

/** Realtime Database: presence/{pid}/{uid}. Ephemeral — never stored in Firestore. */
export interface PresenceEntry {
  name: string;
  at: number;
  editingTaskId?: string;
}

// ─── Health Log Prefill ───────────────────────────────────────────────────────

export interface HealthLogPrefill {
  workoutType?: WorkoutType;
  targetDurationMin?: number;
  targetIntensity?: IntensityLevel;
  targetDistanceValue?: number;
  targetDistanceUnit?: 'km' | 'm';
  targetSets?: number;
  targetReps?: number;
  sourceRoutineId?: string;
  sourceTemplateIdx?: number;
}

// ─── Assistant chat agent (functions/src/ai/assistantAgent.ts) ─────────────────
// Written by the Admin SDK from the Cloud Function; the client only appends user
// message docs. Registered as a user-data store in userDataRegistry.ts (Tenet 1).

export type ChatSessionStatus = 'idle' | 'running' | 'awaiting-approval';

/** Firestore: users/{uid}/chatSessions/{sid}. */
export interface ChatSession {
  id?: string;
  title?: string;
  status: ChatSessionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** One tool call the agent made, surfaced as a chip under the assistant message. */
export interface ToolActivity {
  tool: string;
  summary: string;
  status: 'ok' | 'error';
}

/** Firestore: users/{uid}/chatSessions/{sid}/messages/{mid}. */
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  toolActivity?: ToolActivity[];
  /** Set by the function once a user message has been handled (idempotency). */
  processedAt?: Timestamp;
  createdAt: Timestamp;
}

/** Firestore: users/{uid}/chatSessions/{sid}/proposedActions/{aid} — Phase 2 (approval gate). */
export interface ProposedAction {
  id?: string;
  tool: string;
  summary: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

// ─── UI Context ───────────────────────────────────────────────────────────────

export type ComposeMode = 'todo' | 'log';

export interface UIContextType {
  composeOpen: boolean;
  composeMode: ComposeMode;
  composeTodoType?: TodoType;
  composeLogType?: LogType;
  composeEntry?: Todo | Log;
  composeGroupId?: string;
  composeHealthPrefill?: HealthLogPrefill;
  openComposeTodo: (todoType?: TodoType) => void;
  openComposeLog: (logType?: LogType) => void;
  openComposeHealthLog: (prefill?: HealthLogPrefill) => void;
  openComposeForEdit: (entry: Todo | Log) => void;
  openComposeForGroup: (groupId: string, todoType?: TodoType) => void;
  closeCompose: () => void;
  deferOpen: boolean;
  deferTodoId?: string;
  openDefer: (todoId: string) => void;
  closeDefer: () => void;
  editRecurringGroup: RecurringTodoGroup | null;
  openEditRecurring: (group: RecurringTodoGroup) => void;
  closeEditRecurring: () => void;
}
