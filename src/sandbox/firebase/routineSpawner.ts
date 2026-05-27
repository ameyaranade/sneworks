import {
  collection,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { RoutineGroup } from '../types';

// ─── Recurrence helpers ───────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};
const DAY_NAMES: Record<string, string> = {
  SUN: 'Sun', MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat',
};

export function isDueToday(recurrence: string): boolean {
  const day = new Date().getDay();
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return day >= 1 && day <= 5;
  const m = recurrence.match(/^weekly:([A-Z]+)$/);
  if (m) return DAY_MAP[m[1]] === day;
  return false;
}

export function recurrenceLabel(recurrence: string): string {
  if (recurrence === 'daily') return 'Daily';
  if (recurrence === 'weekdays') return 'Weekdays';
  const m = recurrence.match(/^weekly:([A-Z]+)$/);
  if (m) return `Weekly · ${DAY_NAMES[m[1]] ?? m[1]}`;
  return recurrence;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Spawn due routines ────────────────────────────────────────────────────────
//
// Runs once per session (via useRef guard in SandboxShell).
// For each routine that is due today and hasn't been spawned yet:
//   1. Check if previous instance was fully done (for streak)
//   2. Delete previous todos (clean slate for today)
//   3. Batch-create new todos from templateChildren
//   4. Update group: lastSpawnedAt, streakCount, childCount, doneCount:0, completed:false

export async function spawnDueRoutines(uid: string): Promise<void> {
  const groupsCol = collection(db, 'users', uid, 'sandbox_groups');
  const todosCol  = collection(db, 'users', uid, 'sandbox_todos');

  const routinesSnap = await getDocs(
    query(groupsCol, where('groupKind', '==', 'routine')),
  );

  const today = new Date();

  for (const routineDoc of routinesSnap.docs) {
    const routine = { id: routineDoc.id, ...routineDoc.data() } as RoutineGroup;

    // Skip archived
    if (routine.archivedAt) continue;

    // Skip if already spawned today
    if (routine.lastSpawnedAt && isSameDay(routine.lastSpawnedAt.toDate(), today)) continue;

    // Skip if not due today
    if (!isDueToday(routine.recurrence)) continue;

    // Fetch existing todos for this routine (previous instance)
    const existingSnap = await getDocs(
      query(todosCol, where('groupId', '==', routine.id)),
    );
    type RawTodo = { status: string };
    const existing = existingSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as RawTodo),
    }));

    // Compute new streak
    let newStreak = routine.streakCount ?? 0;
    if (!routine.lastSpawnedAt) {
      // First-ever spawn — no previous instance to evaluate
      newStreak = 0;
    } else if (existing.length > 0) {
      const allDone = existing.every(
        (t) => t.status === 'done' || t.status === 'skipped',
      );
      newStreak = allDone ? (routine.streakCount ?? 0) + 1 : 0;
    } else {
      // Previous spawn had no todos (empty template) — treat as missed
      newStreak = 0;
    }

    const batch = writeBatch(db);
    const now   = Timestamp.now();

    // Delete previous todos
    for (const t of existing) {
      batch.delete(doc(todosCol, t.id));
    }

    // Create fresh todos from template
    const template = routine.templateChildren ?? [];
    template.forEach((item, i) => {
      const ref = doc(todosCol);
      batch.set(ref, {
        todoType:  item.todoType ?? 'generic-task',
        title:     item.title,
        groupId:   routine.id,
        status:    'pending',
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Update routine group
    batch.update(doc(groupsCol, routine.id), {
      lastSpawnedAt: now,
      streakCount:   newStreak,
      childCount:    template.length,
      doneCount:     0,
      completed:     false,
      updatedAt:     now,
    });

    await batch.commit();
  }
}
