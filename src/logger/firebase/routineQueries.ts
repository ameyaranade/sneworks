import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { RRule } from 'rrule';
import { db } from '../../firebase/config';
import type { Routine } from '../types';
import { startOfDay, isSameDay, addDays } from '../utils';

// ─── Collection helpers ────────────────────────────────────────────────────────

function routinesCol(uid: string) {
  return collection(db, 'users', uid, 'logger_routines');
}

function entriesCol(uid: string) {
  return collection(db, 'users', uid, 'logger_entries');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addRoutine(
  uid: string,
  routine: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(routinesCol(uid), {
    ...routine,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRoutine(
  uid: string,
  routineId: string,
  partial: Partial<Omit<Routine, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'logger_routines', routineId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoutine(uid: string, routineId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'logger_routines', routineId));
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export function subscribeToRoutines(
  uid: string,
  cb: (routines: Routine[]) => void,
): Unsubscribe {
  // Only active routines (no deleted field)
  const q = query(routinesCol(uid), where('updatedAt', '!=', null));
  return onSnapshot(q, (snap) => {
    const routines = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Routine));
    cb(routines);
  });
}

// ─── Routine Spawner ──────────────────────────────────────────────────────────

/**
 * For each routine due today that hasn't been spawned yet, batch-create
 * pending todo entries from templateChildren and update lastSpawnedAt.
 */
export async function spawnDueRoutines(uid: string, routines: Routine[]): Promise<void> {
  const today = startOfDay(new Date());
  const todayTs = Timestamp.fromDate(today);

  for (const routine of routines) {
    if (!routine.id || routine.templateChildren.length === 0) continue;

    // Skip if already spawned today
    if (routine.lastSpawnedAt) {
      const lastSpawn = routine.lastSpawnedAt.toDate();
      if (isSameDay(lastSpawn, today)) continue;
    }

    // Parse the RRule string and check whether today is a valid occurrence
    let shouldSpawn = false;
    try {
      const rule = RRule.fromString(routine.recurrence);
      // Check a ±2-day window around today to handle timezone edge cases
      const occurrences = rule.between(addDays(today, -1), addDays(today, 2), true);
      shouldSpawn = occurrences.some((d) => isSameDay(d, today));
    } catch {
      // Malformed RRule — skip this routine
      continue;
    }

    if (!shouldSpawn) continue;

    const batch = writeBatch(db);
    const entryCol = entriesCol(uid);

    routine.templateChildren.forEach((item, idx) => {
      const entryRef = doc(entryCol);
      batch.set(entryRef, {
        kind: 'todo',
        typeId: item.typeId ?? '',
        title: item.title,
        data: {},
        dueAt: todayTs,
        status: 'pending',
        recurrenceId: routine.id,
        instanceOf: routine.id,
        sortOrder: Date.now() + idx,
        source: 'recurring',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    batch.update(doc(db, 'users', uid, 'logger_routines', routine.id), {
      lastSpawnedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }
}
