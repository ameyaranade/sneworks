import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import type { Todo, TodoStatus, Group, MoneyReminderTodo, ExpenseLog } from '../types';
import {
  addTodo as fbAddTodo,
  updateTodo as fbUpdateTodo,
  deleteTodo as fbDeleteTodo,
  subscribeToAllTodos,
} from '../firebase/todoQueries';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { sandboxCacheKey, readCache, writeCache, startOfDay, endOfDay, addHours, addDays } from '../utils';
import { getCachedUid } from '../../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = 'todos';

interface TodosState {
  todos: Todo[];
  loaded: boolean;

  init: (uid: string) => Unsubscribe;

  // Selectors
  getOverdueTodos: () => Todo[];
  getTodayTodos: () => Todo[];
  getDoneTodayTodos: () => Todo[];
  getTodosForGroup: (groupId: string) => Todo[];
  getUngroupedShoppingItems: () => Todo[];

  // CRUD
  addTodo: (uid: string, todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTodo: (uid: string, todoId: string, partial: Partial<Todo>) => Promise<void>;
  deleteTodo: (uid: string, todoId: string) => Promise<Todo | undefined>;
  restoreTodo: (uid: string, todo: Todo) => Promise<string>;

  // Status actions (optimistic)
  completeTodo: (uid: string, todoId: string) => Promise<void>;
  skipTodo: (uid: string, todoId: string) => Promise<void>;
  deferTodo: (uid: string, todoId: string, newDate: Date) => Promise<void>;
  deferTodoPlusHours: (uid: string, todoId: string, hours: number) => Promise<void>;
  markPending: (uid: string, todoId: string) => Promise<void>;
}

export const useTodosStore = create<TodosState>((set, get) => {
  // Synchronous cache seed for instant first render
  const cachedUid = getCachedUid();
  let initialTodos: Todo[] = [];
  if (cachedUid) {
    initialTodos = readCache<Todo[]>(sandboxCacheKey(cachedUid, CACHE_KEY)) ?? [];
  }

  return {
    todos: initialTodos,
    loaded: initialTodos.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToAllTodos(uid, (todos) => {
        set({ todos, loaded: true });
        writeCache(sandboxCacheKey(uid, CACHE_KEY), todos);
      });
      return unsub;
    },

    // ── Selectors ──────────────────────────────────────────────────────────────

    getOverdueTodos: () => {
      const todayStart = startOfDay(new Date()).getTime();
      return get().todos.filter(
        (t) =>
          (t.status === 'pending' || t.status === 'deferred') &&
          t.dueAt &&
          t.dueAt.toMillis() < todayStart,
      );
    },

    getTodayTodos: () => {
      const todayStart = startOfDay(new Date()).getTime();
      const todayEnd = endOfDay(new Date()).getTime();
      return get().todos.filter((t) => {
        if (t.status !== 'pending' && t.status !== 'deferred') return false;
        // No due date at all = undated inbox item, always show in Up Next
        if (!t.dueAt) return true;
        // Has due date: must be today (or earlier today via deferred) or pinned
        const ms = t.dueAt.toMillis();
        return ms >= todayStart && ms <= todayEnd;
      });
    },

    getDoneTodayTodos: () => {
      const todayStart = startOfDay(new Date()).getTime();
      const todayEnd = endOfDay(new Date()).getTime();
      return get().todos.filter((t) => {
        if (t.status !== 'done' && t.status !== 'skipped') return false;
        const ms = t.completedAt?.toMillis();
        return ms !== undefined && ms >= todayStart && ms <= todayEnd;
      });
    },

    getTodosForGroup: (groupId: string) =>
      get().todos.filter((t) => t.groupId === groupId),

    getUngroupedShoppingItems: () =>
      get().todos.filter(
        (t) => t.todoType === 'shopping-item' && !t.groupId && t.status === 'pending',
      ),

    // ── CRUD ──────────────────────────────────────────────────────────────────

    addTodo: async (uid, todoInput) => {
      return fbAddTodo(uid, todoInput);
    },

    updateTodo: async (uid, todoId, partial) => {
      // Optimistic update
      set((s) => ({
        todos: s.todos.map((t) => {
          if (t.id !== todoId) return t;
          const updated = { ...t, ...partial } as unknown as Record<string, unknown>;
          for (const key of Object.keys(partial as Record<string, unknown>)) {
            if ((partial as Record<string, unknown>)[key] === undefined) {
              delete updated[key];
            }
          }
          return updated as unknown as Todo;
        }),
      }));
      try {
        await fbUpdateTodo(uid, todoId, partial);
      } catch (err) {
        console.error('updateTodo failed', err);
        throw err;
      }
    },

    deleteTodo: async (uid, todoId) => {
      const deleted = get().todos.find((t) => t.id === todoId);
      set((s) => ({ todos: s.todos.filter((t) => t.id !== todoId) }));
      try {
        await fbDeleteTodo(uid, todoId);
      } catch (err) {
        console.error('deleteTodo failed', err);
        throw err;
      }
      return deleted;
    },

    restoreTodo: async (uid, todo) => {
      const { id: _id, ...rest } = todo;
      return fbAddTodo(uid, rest as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>);
    },

    // ── Status actions ────────────────────────────────────────────────────────

    completeTodo: async (uid, todoId) => {
      const todo = get().todos.find((t) => t.id === todoId);
      const now = Timestamp.now();
      await get().updateTodo(uid, todoId, { status: 'done', completedAt: now });

      // Phase 2: auto-trip creation for ungrouped shopping items
      if (todo?.todoType === 'shopping-item' && !todo.groupId) {
        // Lazy import to avoid circular dep at module evaluation time
        const { useGroupsStore } = await import('./useGroupsStore');
        const { groups, addGroup } = useGroupsStore.getState();
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const tripName = `Shopping:${dd}-${mm}-${yyyy}`;

        let tripGroupId = groups.find(
          (g) => g.groupKind === 'shopping-list' && g.name === tripName,
        )?.id;

        if (!tripGroupId) {
          tripGroupId = await addGroup(uid, {
            groupKind: 'shopping-list',
            name: tripName,
            priceTrackingEnabled: false,
            totalSpent: 0,
            ancestorPath: [],
            showProgress: true,
            showSumMoney: false,
            childCount: 0,
            doneCount: 0,
            completed: false,
          } as Omit<Group, 'id' | 'createdAt' | 'updatedAt'>);
        }
        await get().updateTodo(uid, todoId, { groupId: tripGroupId });
        recomputeGroupCounts(uid, tripGroupId).catch(console.error);
      } else if (todo?.groupId) {
        recomputeGroupCounts(uid, todo.groupId).catch(console.error);
      }
      // Phase 3: completion bridge — money-reminder → expense log
      if (todo?.todoType === 'money-reminder') {
        const moneyTodo = todo as MoneyReminderTodo;
        if (moneyTodo.amount) {
          const { useLogsStore } = await import('./useLogsStore');
          const { addLog } = useLogsStore.getState();
          addLog(uid, {
            logType: 'expense',
            title: moneyTodo.title,
            spentOn: moneyTodo.title,
            amount: moneyTodo.amount,
            category: moneyTodo.category,
            occurredAt: now,
            sourceTodoId: todoId,
            sortOrder: Date.now(),
          } as Omit<ExpenseLog, 'id' | 'createdAt' | 'updatedAt'>).catch(console.error);
        }

      }
    },

    skipTodo: async (uid, todoId) => {
      const now = Timestamp.now();
      await get().updateTodo(uid, todoId, { status: 'skipped' as TodoStatus, completedAt: now });
    },

    deferTodo: async (uid, todoId, newDate: Date) => {
      await get().updateTodo(uid, todoId, {
        dueAt: Timestamp.fromDate(newDate),
        status: 'deferred',
      });
    },

    deferTodoPlusHours: async (uid, todoId, hours: number) => {
      const todo = get().todos.find((t) => t.id === todoId);
      const base = todo?.dueAt?.toDate() ?? new Date();
      const newDate = addHours(base, hours);
      await get().updateTodo(uid, todoId, {
        dueAt: Timestamp.fromDate(newDate),
        status: 'deferred',
      });
    },

    markPending: async (uid, todoId) => {
      const todo = get().todos.find((t) => t.id === todoId);
      await get().updateTodo(uid, todoId, {
        status: 'pending',
        completedAt: undefined,
      });
      if (todo?.groupId) {
        recomputeGroupCounts(uid, todo.groupId).catch(console.error);
      }
    },
  };
});

// Convenience: get tomorrow at 09:00
export function tomorrowAt9(): Date {
  const d = addDays(new Date(), 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
