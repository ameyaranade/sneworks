import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteField,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Todo } from '../types';

// ─── Collection helpers ────────────────────────────────────────────────────────

export function todosCol(uid: string) {
  return collection(db, 'users', uid, 'sandbox_todos');
}

function todoDoc(uid: string, todoId: string) {
  return doc(db, 'users', uid, 'sandbox_todos', todoId);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addTodo(
  uid: string,
  todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  // Firestore rejects undefined field values — strip them before writing.
  const cleaned = Object.fromEntries(
    Object.entries(todo as Record<string, unknown>).filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(todosCol(uid), {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTodo(
  uid: string,
  todoId: string,
  partial: Partial<Omit<Todo, 'id' | 'createdAt'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(todoDoc(uid, todoId), payload);
}

export async function deleteTodo(uid: string, todoId: string): Promise<void> {
  await deleteDoc(todoDoc(uid, todoId));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribes to all active TODOs (pending/deferred/done in last 30 days).
 * Uses a 90-day createdAt window — covers nearly all use cases for Phase 1.
 * Older recurring reminders will be handled in Phase 3 with a dedicated query.
 */
export function subscribeToAllTodos(
  uid: string,
  cb: (todos: Todo[]) => void,
): Unsubscribe {
  const cutoff = Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const q = query(
    todosCol(uid),
    where('createdAt', '>=', cutoff),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Todo));
    cb(todos);
  });
}

/**
 * Subscribes to TODOs for a specific group, sorted by sortOrder.
 */
export function subscribeToTodosForGroup(
  uid: string,
  groupId: string,
  cb: (todos: Todo[]) => void,
): Unsubscribe {
  let fallbackUnsub: Unsubscribe | null = null;

  const primaryUnsub = onSnapshot(
    query(todosCol(uid), where('groupId', '==', groupId), orderBy('sortOrder', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Todo))),
    (err) => {
      if (err.code === 'failed-precondition') {
        const fallbackQ = query(todosCol(uid), where('groupId', '==', groupId));
        fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
          const todos = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Todo))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          cb(todos);
        });
      }
    },
  );

  return () => {
    primaryUnsub();
    fallbackUnsub?.();
  };
}
