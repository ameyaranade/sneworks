import { useCallback, useEffect, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Todo, TodoStatus } from '../types';
import {
  subscribeToSharedTodos,
  addSharedTodo,
  updateSharedTodo,
  deleteSharedTodo,
} from '../firebase/sharedProjectQueries';
import { addHours } from '../utils';

// How long a row stays flagged as "changed by someone else" (spec §5.3).
const REMOTE_HIGHLIGHT_MS = 2500;
// A local write's own snapshot echo is suppressed as "remote" for this long after firing.
const SELF_WRITE_GRACE_MS = 4000;

/**
 * Per-project task list for a SHARED project — mirrors useTodosStore's shape
 * (same action surface TodoRow expects) but scoped to one project's
 * sharedProjects/{pid}/todos subcollection instead of a global per-user store.
 * Server-side count recompute happens via the onSharedTaskWrite Cloud Function,
 * so (unlike useTodosStore) there's no client-side recomputeGroupCounts call here.
 *
 * Also tracks which rows just changed via someone ELSE's write (remoteUpdatedIds)
 * and exposes a manual `refresh()` to force-resubscribe — see spec §5.3.
 */
export function useSharedProjectTodos(pid: string | undefined) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [remoteUpdatedIds, setRemoteUpdatedIds] = useState<Set<string>>(new Set());
  const [refreshGen, setRefreshGen] = useState(0);

  const prevUpdatedAtRef = useRef<Map<string, number>>(new Map());
  const selfWriteRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!pid) {
      setTodos([]);
      setLoaded(false);
      prevUpdatedAtRef.current = new Map();
      return;
    }
    setLoaded(false);
    return subscribeToSharedTodos(pid, (incoming) => {
      const now = Date.now();
      const prevMap = prevUpdatedAtRef.current;
      const nextMap = new Map<string, number>();
      const newlyRemote: string[] = [];

      for (const t of incoming) {
        if (!t.id) continue;
        const ms = t.updatedAt?.toMillis?.() ?? 0;
        nextMap.set(t.id, ms);
        const prevMs = prevMap.get(t.id);
        if (prevMs !== undefined && ms !== prevMs) {
          const selfWriteAt = selfWriteRef.current.get(t.id);
          const isSelfEcho = selfWriteAt !== undefined && now - selfWriteAt < SELF_WRITE_GRACE_MS;
          if (!isSelfEcho) newlyRemote.push(t.id);
        }
      }
      prevUpdatedAtRef.current = nextMap;

      setTodos(incoming);
      setLoaded(true);

      if (newlyRemote.length > 0) {
        setRemoteUpdatedIds((prev) => {
          const next = new Set(prev);
          newlyRemote.forEach((id) => next.add(id));
          return next;
        });
        newlyRemote.forEach((id) => {
          setTimeout(() => {
            setRemoteUpdatedIds((prev) => {
              if (!prev.has(id)) return prev;
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, REMOTE_HIGHLIGHT_MS);
        });
      }
    });
  }, [pid, refreshGen]);

  /** Forces the subscription to tear down and re-attach (stale/manual-refresh state, spec §5.3). */
  const refresh = useCallback(() => {
    prevUpdatedAtRef.current = new Map();
    setRefreshGen((g) => g + 1);
  }, []);

  const updateTodo = useCallback(
    async (_uid: string, todoId: string, partial: Partial<Todo>) => {
      if (!pid) return;
      selfWriteRef.current.set(todoId, Date.now());
      // Optimistic update — mirrors useTodosStore.updateTodo
      setTodos((prev) =>
        prev.map((t) => {
          if (t.id !== todoId) return t;
          const updated = { ...t, ...partial } as unknown as Record<string, unknown>;
          for (const key of Object.keys(partial as Record<string, unknown>)) {
            if ((partial as Record<string, unknown>)[key] === undefined) delete updated[key];
          }
          return updated as unknown as Todo;
        }),
      );
      await updateSharedTodo(pid, todoId, partial);
    },
    [pid],
  );

  const addTodo = useCallback(
    async (_uid: string, todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!pid) throw new Error('No project id');
      return addSharedTodo(pid, todo);
    },
    [pid],
  );

  const completeTodo = useCallback(
    (uid: string, todoId: string) => updateTodo(uid, todoId, { status: 'done', completedAt: Timestamp.now() }),
    [updateTodo],
  );

  const skipTodo = useCallback(
    (uid: string, todoId: string) =>
      updateTodo(uid, todoId, { status: 'skipped' as TodoStatus, completedAt: Timestamp.now() }),
    [updateTodo],
  );

  const markPending = useCallback(
    (uid: string, todoId: string) => updateTodo(uid, todoId, { status: 'pending', completedAt: undefined }),
    [updateTodo],
  );

  const deferTodo = useCallback(
    (uid: string, todoId: string, newDate: Date) =>
      updateTodo(uid, todoId, { dueAt: Timestamp.fromDate(newDate), status: 'deferred' }),
    [updateTodo],
  );

  const deferTodoPlusHours = useCallback(
    (uid: string, todoId: string, hours: number) => {
      const todo = todos.find((t) => t.id === todoId);
      const base = todo?.dueAt?.toDate() ?? new Date();
      return updateTodo(uid, todoId, { dueAt: Timestamp.fromDate(addHours(base, hours)), status: 'deferred' });
    },
    [todos, updateTodo],
  );

  const deleteTodo = useCallback(
    async (_uid: string, todoId: string): Promise<Todo | undefined> => {
      if (!pid) return undefined;
      const deleted = todos.find((t) => t.id === todoId);
      setTodos((prev) => prev.filter((t) => t.id !== todoId));
      await deleteSharedTodo(pid, todoId);
      return deleted;
    },
    [pid, todos],
  );

  const restoreTodo = useCallback(
    async (_uid: string, todo: Todo): Promise<string> => {
      if (!pid) throw new Error('No project id');
      const { id: _id, ...rest } = todo;
      return addSharedTodo(pid, rest as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>);
    },
    [pid],
  );

  return {
    todos,
    loaded,
    remoteUpdatedIds,
    refresh,
    addTodo,
    updateTodo,
    completeTodo,
    skipTodo,
    markPending,
    deferTodo,
    deferTodoPlusHours,
    deleteTodo,
    restoreTodo,
  };
}
