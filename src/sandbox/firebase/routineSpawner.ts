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
import type { RoutineGroup, RecurringTodoGroup } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};
const DAY_NAMES: Record<string, string> = {
  SUN: 'Sun', MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat',
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Recurrence helpers (shared by routines & recurring-todos) ────────────────

export function isDueToday(recurrence: string): boolean {
  const now = new Date();
  const day = now.getDay();

  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return day >= 1 && day <= 5;

  const weeklyM = recurrence.match(/^weekly:([A-Z]+)$/);
  if (weeklyM) return DAY_MAP[weeklyM[1]] === day;

  const monthlyM = recurrence.match(/^monthly:(\d+)$/);
  if (monthlyM) return now.getDate() === Number(monthlyM[1]);

  const quarterlyM = recurrence.match(/^quarterly:(\d+)$/);
  if (quarterlyM) {
    // Due on a specific day in Jan, Apr, Jul, Oct
    return now.getMonth() % 3 === 0 && now.getDate() === Number(quarterlyM[1]);
  }

  const yearlyM = recurrence.match(/^yearly:(\d+)$/);
  if (yearlyM) {
    return now.getMonth() === 0 && now.getDate() === Number(yearlyM[1]);
  }

  return false;
}

export function recurrenceLabel(recurrence: string): string {
  if (recurrence === 'daily') return 'Daily';
  if (recurrence === 'weekdays') return 'Weekdays';

  const weeklyM = recurrence.match(/^weekly:([A-Z]+)$/);
  if (weeklyM) return `Weekly · ${DAY_NAMES[weeklyM[1]] ?? weeklyM[1]}`;

  const monthlyM = recurrence.match(/^monthly:(\d+)$/);
  if (monthlyM) return `Monthly · ${ordinal(Number(monthlyM[1]))}`;

  const quarterlyM = recurrence.match(/^quarterly:(\d+)$/);
  if (quarterlyM) return `Quarterly · ${ordinal(Number(quarterlyM[1]))}`;

  const yearlyM = recurrence.match(/^yearly:(\d+)$/);
  if (yearlyM) return `Yearly · Jan ${ordinal(Number(yearlyM[1]))}`;

  return recurrence;
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

    // Skip if deferred
    if (routine.deferUntil && routine.deferUntil.toDate() > today) continue;

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
      newStreak = 0;
    } else if (existing.length > 0) {
      const allDone = existing.every(
        (t) => t.status === 'done' || t.status === 'skipped',
      );
      newStreak = allDone ? (routine.streakCount ?? 0) + 1 : 0;
    } else {
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

// ─── Spawn due recurring single-todos ─────────────────────────────────────────
//
// For each 'recurring-todo' group due today that hasn't spawned yet:
//   - Create one pending todo (money-reminder or generic-task)
//   - Update group lastSpawnedAt
//
// Called on session start (same guard as spawnDueRoutines).

export async function spawnDueRecurringTodos(uid: string): Promise<void> {
  const groupsCol = collection(db, 'users', uid, 'sandbox_groups');
  const todosCol  = collection(db, 'users', uid, 'sandbox_todos');

  const recurringSnap = await getDocs(
    query(groupsCol, where('groupKind', '==', 'recurring-todo')),
  );

  const today = new Date();

  for (const groupDoc of recurringSnap.docs) {
    const group = { id: groupDoc.id, ...groupDoc.data() } as RecurringTodoGroup;

    if (group.archivedAt) continue;
    if (!isDueToday(group.recurrence)) continue;
    if (group.lastSpawnedAt && isSameDay(group.lastSpawnedAt.toDate(), today)) continue;

    const batch = writeBatch(db);
    const now   = Timestamp.now();

    // Check for existing pending instance — don't double-spawn
    const existingSnap = await getDocs(
      query(todosCol, where('groupId', '==', group.id), where('status', '==', 'pending')),
    );
    if (existingSnap.empty) {
      const ref = doc(todosCol);
      const todoData: Record<string, unknown> = {
        todoType:  group.recurTodoType,
        title:     group.name,
        groupId:   group.id,
        status:    'pending',
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
      };
      if (group.recurTodoType === 'money-reminder') {
        if (group.amount != null) todoData.amount = group.amount;
        if (group.category)       todoData.category = group.category;
      }
      batch.set(ref, todoData);
    }

    batch.update(doc(groupsCol, group.id), {
      lastSpawnedAt: now,
      childCount:    1,
      updatedAt:     now,
    });

    await batch.commit();
  }
}
