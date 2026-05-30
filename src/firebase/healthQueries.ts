import type { HealthLog, Log } from '../types';

/** Filter health logs from a pre-fetched set by routine and optional date range. */
export function filterRoutineLogs(
  logs: Log[],
  routineId: string,
  startMs?: number,
  endMs?: number,
): HealthLog[] {
  return logs.filter((l): l is HealthLog => {
    if (l.logType !== 'health-log') return false;
    const hl = l as HealthLog;
    if (hl.sourceRoutineId !== routineId) return false;
    if (startMs !== undefined && l.occurredAt.toMillis() < startMs) return false;
    if (endMs !== undefined && l.occurredAt.toMillis() > endMs) return false;
    return true;
  });
}

/** Group logs by YYYY-MM-DD key. */
export function groupLogsByDay(logs: HealthLog[]): Map<string, HealthLog[]> {
  const m = new Map<string, HealthLog[]>();
  for (const l of logs) {
    const key = l.occurredAt.toDate().toISOString().slice(0, 10);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(l);
  }
  return m;
}

/** Sum caloriesBurned in a list of logs (null if none have the field). */
export function sumCalories(logs: HealthLog[]): number {
  return logs.reduce((acc, l) => acc + (l.caloriesBurned ?? 0), 0);
}

/** Sum durationMin in a list of logs. */
export function sumDuration(logs: HealthLog[]): number {
  return logs.reduce((acc, l) => acc + (l.durationMin ?? 0), 0);
}

/** ISO date string for today. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO date string for N days ago. */
export function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Returns array of 7 YYYY-MM-DD keys: [6 days ago, ..., today] */
export function last7DayKeys(): string[] {
  return Array.from({ length: 7 }, (_, i) => daysAgoKey(6 - i));
}

/** Short day label like "Mon", "Tue" from a YYYY-MM-DD key. */
export function shortDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
