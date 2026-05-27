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
  writeBatch,
  deleteField,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Entry, EntryStatus } from '../types';

// ─── Collection helpers ────────────────────────────────────────────────────────

export function entriesCol(uid: string) {
  return collection(db, 'users', uid, 'logger_entries');
}

function entryDoc(uid: string, entryId: string) {
  return doc(db, 'users', uid, 'logger_entries', entryId);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addEntry(
  uid: string,
  entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(entriesCol(uid), {
    ...entry,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEntry(
  uid: string,
  entryId: string,
  partial: Partial<Omit<Entry, 'id' | 'createdAt'>>,
): Promise<void> {
  // Convert any `undefined` values to deleteField() so callers can clear optional fields
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(entryDoc(uid, entryId), payload);
}

export async function deleteEntry(uid: string, entryId: string): Promise<void> {
  await deleteDoc(entryDoc(uid, entryId));
}

export async function batchUpdateEntryStatus(
  uid: string,
  entryIds: string[],
  status: EntryStatus,
): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();
  for (const id of entryIds) {
    batch.update(entryDoc(uid, id), {
      status,
      ...(status === 'done' ? { completedAt: now } : {}),
      updatedAt: now,
    });
  }
  await batch.commit();
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeToEntriesForDateRange(
  uid: string,
  startDate: Date,
  endDate: Date,
  cb: (entries: Entry[]) => void,
): Unsubscribe {
  const startTs = Timestamp.fromDate(startDate);
  const endTs = Timestamp.fromDate(endDate);

  // Use occurredAt for logs, dueAt for todos — query by both via two separate fields
  // For simplicity we index by occurredAt for logs and dueAt for todos.
  // We fetch all entries with occurredAt in range OR dueAt in range client-side.
  // Use a broad query: any entry whose createdAt is in the last 90 days (wide window).
  const q = query(
    entriesCol(uid),
    where('createdAt', '>=', Timestamp.fromMillis(startTs.toMillis() - 90 * 24 * 60 * 60 * 1000)),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const entries: Entry[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Entry))
      .filter((e) => {
        const ts = e.occurredAt ?? e.dueAt ?? e.createdAt;
        return ts && ts.toMillis() >= startTs.toMillis() && ts.toMillis() <= endTs.toMillis();
      });
    cb(entries);
  });
}

export function subscribeToEntriesForToday(
  uid: string,
  cb: (entries: Entry[]) => void,
): Unsubscribe {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return subscribeToEntriesForDateRange(uid, start, end, cb);
}

export function subscribeToEntriesByGroup(
  uid: string,
  groupId: string,
  cb: (entries: Entry[]) => void,
): Unsubscribe {
  let fallbackUnsub: Unsubscribe | null = null;

  const primaryUnsub = onSnapshot(
    query(entriesCol(uid), where('groupId', '==', groupId), orderBy('sortOrder', 'asc')),
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry)));
    },
    (err) => {
      // Fallback: if composite index not yet built, sort client-side
      if (err.code === 'failed-precondition') {
        const fallbackQ = query(entriesCol(uid), where('groupId', '==', groupId));
        fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
          const entries = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Entry))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          cb(entries);
        });
      }
    },
  );

  return () => {
    primaryUnsub();
    fallbackUnsub?.();
  };
}

export function subscribeToAllEntries(
  uid: string,
  cb: (entries: Entry[]) => void,
): Unsubscribe {
  // Subscribe to recent 90 days of entries for offline-first use
  const cutoff = Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const q = query(
    entriesCol(uid),
    where('createdAt', '>=', cutoff),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry));
    cb(entries);
  });
}
