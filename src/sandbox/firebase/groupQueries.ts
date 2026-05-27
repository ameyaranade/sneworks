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
  getDocs,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Group } from '../types';

// ─── Collection helpers ────────────────────────────────────────────────────────

export function groupsCol(uid: string) {
  return collection(db, 'users', uid, 'sandbox_groups');
}

function groupDocRef(uid: string, groupId: string) {
  return doc(db, 'users', uid, 'sandbox_groups', groupId);
}

function todosColRef(uid: string) {
  return collection(db, 'users', uid, 'sandbox_todos');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addGroup(
  uid: string,
  group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const cleaned = Object.fromEntries(
    Object.entries(group as Record<string, unknown>).filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(groupsCol(uid), {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGroup(
  uid: string,
  groupId: string,
  partial: Partial<Omit<Group, 'id' | 'createdAt'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(groupDocRef(uid, groupId), payload);
}

export async function deleteGroup(uid: string, groupId: string): Promise<void> {
  await deleteDoc(groupDocRef(uid, groupId));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribes to all non-archived groups, newest first.
 * Filters out archived groups client-side (avoids composite index).
 */
export function subscribeToAllGroups(
  uid: string,
  cb: (groups: Group[]) => void,
): Unsubscribe {
  const q = query(groupsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    cb(groups);
  });
}

// ─── Group count recompute ────────────────────────────────────────────────────

/**
 * Reads all todos + sub-groups for a group and updates its counts.
 * Propagates up to parent groups for nested projects.
 * Max recursion depth: 2 (enforced by `depth` guard).
 */
export async function recomputeGroupCounts(
  uid: string,
  groupId: string,
  depth = 0,
): Promise<void> {
  if (depth > 3) return; // safety guard against runaway recursion

  // ── Direct todos ─────────────────────────────────────────────────────────
  const todosSnap = await getDocs(
    query(todosColRef(uid), where('groupId', '==', groupId)),
  );
  type RawItem = { status: string; todoType: string; price?: number };
  const items = todosSnap.docs.map((d) => d.data() as RawItem);
  const childCount = items.length;
  const doneCount = items.filter(
    (t) => t.status === 'done' || t.status === 'skipped',
  ).length;
  const totalSpent = items.reduce(
    (sum, t) => sum + (t.todoType === 'shopping-item' ? (t.price ?? 0) : 0),
    0,
  );

  // ── Sub-groups (for nested projects) ────────────────────────────────────
  const subSnap = await getDocs(
    query(groupsCol(uid), where('parentGroupId', '==', groupId)),
  );
  type RawSubGroup = { completed: boolean };
  const subGroups = subSnap.docs.map((d) => d.data() as RawSubGroup);
  const allSubsDone = subGroups.length === 0 || subGroups.every((sg) => sg.completed);
  const totalItems = childCount + subGroups.length;

  // Complete when all direct todos done AND all sub-groups complete
  const allTodosDone = childCount === 0 || doneCount === childCount;
  const completed = totalItems > 0 && allTodosDone && allSubsDone;

  const payload: Record<string, unknown> = {
    childCount,
    doneCount,
    totalSpent,
    completed,
    updatedAt: serverTimestamp(),
  };
  if (completed) payload.completedAt = Timestamp.now();
  await updateDoc(groupDocRef(uid, groupId), payload);

  // ── Propagate up to parent ───────────────────────────────────────────────
  const groupSnap = await getDoc(groupDocRef(uid, groupId));
  const parentGroupId = (groupSnap.data() as { parentGroupId?: string } | undefined)
    ?.parentGroupId;
  if (parentGroupId) {
    await recomputeGroupCounts(uid, parentGroupId, depth + 1);
  }
}
