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
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Group } from '../types';
import { entriesCol } from './loggerQueries';

// ─── Collection helper ─────────────────────────────────────────────────────────

function groupsCol(uid: string) {
  return collection(db, 'users', uid, 'logger_groups');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addGroup(
  uid: string,
  group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(groupsCol(uid), {
    ...group,
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
  await updateDoc(doc(db, 'users', uid, 'logger_groups', groupId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGroup(uid: string, groupId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'logger_groups', groupId));
}

// ─── Denormalized count recompute ─────────────────────────────────────────────

export async function recomputeGroupCounts(uid: string, groupId: string): Promise<void> {
  const entriesQ = query(entriesCol(uid), where('groupId', '==', groupId));
  const snap = await getDocs(entriesQ);

  let doneCount = 0;
  let totalSpent = 0;
  const childCount = snap.size;

  for (const d of snap.docs) {
    const e = d.data();
    if (e.status === 'done') doneCount++;
    if (typeof e.data?.price === 'number') totalSpent += e.data.price;
    if (typeof e.data?.amount === 'number') totalSpent += e.data.amount;
  }

  await updateDoc(doc(db, 'users', uid, 'logger_groups', groupId), {
    childCount,
    doneCount,
    totalSpent,
    updatedAt: serverTimestamp(),
  });
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export function subscribeToGroups(
  uid: string,
  cb: (groups: Group[]) => void,
): Unsubscribe {
  let fallbackUnsub: Unsubscribe | null = null;

  const primaryUnsub = onSnapshot(
    query(groupsCol(uid), where('archivedAt', '==', null), orderBy('createdAt', 'desc')),
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
    },
    (err) => {
      // Fallback: if composite index not yet built, filter client-side
      if (err.code === 'failed-precondition') {
        const fallbackQ = query(groupsCol(uid), orderBy('createdAt', 'desc'));
        fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
          cb(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Group))
              .filter((g) => !g.archivedAt),
          );
        });
      }
    },
  );

  return () => {
    primaryUnsub();
    fallbackUnsub?.();
  };
}
