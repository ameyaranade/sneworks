import { Timestamp } from 'firebase/firestore';

// ─── Cache key helper ─────────────────────────────────────────────────────────

export const cacheKey = (uid: string, key: string) =>
  `sneworks_${uid}_${key}`;

// ─── Timestamp serialization ──────────────────────────────────────────────────

function reviveTimestamps(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(reviveTimestamps);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (
      obj.__firestoreTimestamp === true &&
      typeof obj.seconds === 'number' &&
      typeof obj.nanoseconds === 'number'
    ) {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, reviveTimestamps(v)]));
  }
  return val;
}

function serializeTimestamps(val: unknown): unknown {
  if (val instanceof Timestamp) {
    return { __firestoreTimestamp: true, seconds: val.seconds, nanoseconds: val.nanoseconds };
  }
  if (Array.isArray(val)) return val.map(serializeTimestamps);
  if (val && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, serializeTimestamps(v)]),
    );
  }
  return val;
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (reviveTimestamps(JSON.parse(raw)) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(serializeTimestamps(data)));
  } catch (_) {}
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Next Saturday or Sunday from today */
export function nextWeekend(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 6=Sat
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  return addDays(d, daysUntilSat);
}

/** Next Monday from today */
export function nextMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMon = (1 - day + 7) % 7 || 7;
  return addDays(d, daysUntilMon);
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function formatTime(ts: Timestamp): string {
  const d = ts.toDate();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

export function formatDueLabel(ts: Timestamp): string {
  const d = ts.toDate();
  const now = new Date();
  const startToday = startOfDay(now);
  const startTomorrow = addDays(startToday, 1);
  const startYesterday = addDays(startToday, -1);
  const dStart = startOfDay(d);

  if (dStart.getTime() === startToday.getTime()) {
    // today — show time if not midnight
    if (d.getHours() !== 0 || d.getMinutes() !== 0) return formatTime(ts);
    return 'Today';
  }
  if (dStart.getTime() === startTomorrow.getTime()) return 'Tomorrow';
  if (dStart.getTime() === startYesterday.getTime()) return 'Yesterday';
  if (d < now) {
    // past
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  const diffDays = Math.round((dStart.getTime() - startToday.getTime()) / 86400000);
  if (diffDays <= 6) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Format date string (YYYY-MM-DD) + time string (HH:MM) → Timestamp */
export function buildTimestamp(dateStr: string, timeStr?: string): Timestamp {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 0;
  let minutes = 0;
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    hours = h;
    minutes = m;
  }
  return Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes, 0));
}

/** Timestamp → "YYYY-MM-DD" for date input value */
export function tsToDateStr(ts: Timestamp): string {
  return ts.toDate().toISOString().slice(0, 10);
}

/** Timestamp → "HH:MM" for time input value (empty if midnight) */
export function tsToTimeStr(ts: Timestamp): string {
  const d = ts.toDate();
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
