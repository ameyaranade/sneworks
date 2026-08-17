import { ref, onValue, set, update, remove, onDisconnect, serverTimestamp } from 'firebase/database';
import { getRtdb, RTDB_ENABLED } from './config';
import type { PresenceEntry } from '../types';

// ─── Ephemeral presence (docs/SHAREABLE_PROJECTS_SPEC.md D9) ───────────────────
// presence/{pid}/{uid} — never written to Firestore, never exported/erased as
// durable data. onDisconnect() clears the entry the moment a tab closes; the
// staleness window below is the fallback for crashes where onDisconnect never
// fires (a scheduled Cloud Function prunes those server-side too).

const STALE_MS = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 45 * 1000;

function presenceRef(pid: string, uid?: string) {
  const db = getRtdb();
  return uid ? ref(db, `presence/${pid}/${uid}`) : ref(db, `presence/${pid}`);
}

/** Starts a presence heartbeat for the current user on a shared project. Call the returned fn to stop. */
export function startPresenceHeartbeat(pid: string, uid: string, name: string): () => void {
  if (!RTDB_ENABLED) return () => {};

  const myRef = presenceRef(pid, uid);
  const write = () => set(myRef, { name, at: serverTimestamp() }).catch(() => {});

  write();
  const disconnectHandle = onDisconnect(myRef);
  disconnectHandle.remove().catch(() => {});
  const interval = setInterval(write, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    disconnectHandle.cancel().catch(() => {});
    remove(myRef).catch(() => {});
  };
}

/** Marks (or clears, with null) the task the current user is actively editing. */
export function setEditingTask(pid: string, uid: string, taskId: string | null): void {
  if (!RTDB_ENABLED) return;
  update(presenceRef(pid, uid), { editingTaskId: taskId ?? null, at: serverTimestamp() }).catch(() => {});
}

/** Live presence map for a project, filtered to entries within the staleness window. */
export function subscribeToPresence(pid: string, cb: (presence: Record<string, PresenceEntry>) => void): () => void {
  if (!RTDB_ENABLED) {
    cb({});
    return () => {};
  }
  const unsub = onValue(presenceRef(pid), (snap) => {
    const raw = (snap.val() as Record<string, PresenceEntry> | null) ?? {};
    const now = Date.now();
    const fresh: Record<string, PresenceEntry> = {};
    for (const [uid, entry] of Object.entries(raw)) {
      if (entry?.at && now - entry.at <= STALE_MS) fresh[uid] = entry;
    }
    cb(fresh);
  });
  return () => unsub();
}
