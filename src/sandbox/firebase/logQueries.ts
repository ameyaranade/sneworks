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
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Log } from '../types';

// ─── Collection helpers ────────────────────────────────────────────────────────

export function logsCol(uid: string) {
  return collection(db, 'users', uid, 'sandbox_logs');
}

function logDocRef(uid: string, logId: string) {
  return doc(db, 'users', uid, 'sandbox_logs', logId);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addLog(
  uid: string,
  log: Omit<Log, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const cleaned = Object.fromEntries(
    Object.entries(log as Record<string, unknown>).filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(logsCol(uid), {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLog(
  uid: string,
  logId: string,
  partial: Partial<Omit<Log, 'id' | 'createdAt'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(logDocRef(uid, logId), payload);
}

export async function deleteLog(uid: string, logId: string): Promise<void> {
  await deleteDoc(logDocRef(uid, logId));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribes to recent logs (last 90 days), newest first.
 * Range filter on occurredAt avoids composite index.
 */
export function subscribeToRecentLogs(
  uid: string,
  cb: (logs: Log[]) => void,
): Unsubscribe {
  const cutoff = Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const q = query(
    logsCol(uid),
    where('occurredAt', '>=', cutoff),
    orderBy('occurredAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log));
    cb(logs);
  });
}
