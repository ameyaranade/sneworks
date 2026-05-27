import { Timestamp } from 'firebase/firestore';

// ─── Timestamp serialization (same pattern as TrackerProvider) ────────────────

export function reviveTimestamps(val: unknown): unknown {
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

export function serializeTimestamps(val: unknown): unknown {
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

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return startOfDay(d);
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

// ─── Entry display helpers ────────────────────────────────────────────────────

/** Interpolate a logFormat template with entry data values */
export function formatLogTitle(logFormat: string, data: Record<string, unknown>): string {
  return logFormat.replace(/\{(\w+)\}/g, (_, key) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

/** Get a human-readable relative date label */
export function relativeDateLabel(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 6) {
    return date.toLocaleDateString('en-IN', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Format a Timestamp for display in Timeline */
export function formatTime(ts: Timestamp): string {
  const d = ts.toDate();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}
