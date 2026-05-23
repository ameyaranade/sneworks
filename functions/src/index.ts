// sneworks — push notification scheduler
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();
const db = admin.firestore();

// ─── Types (mirrored from client types.ts) ───

type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

interface FinanceReminder {
  id: string;
  name: string;
  amount: number;
  frequency: PaymentFrequency;
  dueDay: number;
  active: boolean;
  createdAt: admin.firestore.Timestamp;
}

interface GenericReminder {
  id: string;
  name: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  completed: boolean;
  active: boolean;
}

interface UserSettings {
  notificationsEnabled: boolean;
  fcmToken?: string;
  timezoneOffset?: number; // from new Date().getTimezoneOffset() — negative for UTC+ zones
}

// ─── Timezone helpers ───

/**
 * Returns a Date where .getUTCHours() / .getUTCDate() / .getUTCFullYear() etc.
 * all reflect the user's LOCAL time values.
 *
 * timezoneOffset is the JS value from new Date().getTimezoneOffset():
 *   IST = -330, PST = 480, UTC = 0
 *
 * Formula: localMs = utcMs - timezoneOffset * 60 000
 *   IST example: localMs = utcMs - (-330*60000) = utcMs + 19 800 000  ✓
 */
function toLocalFakeDate(utcMs: number, timezoneOffset: number): Date {
  return new Date(utcMs - timezoneOffset * 60_000);
}

function localDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Next-due-date calculation (ported from client utils.ts) ───
// All Date operations use UTC methods so they work correctly on the Cloud
// Function server (which runs in UTC). `localNow` is a fake-UTC Date from
// toLocalFakeDate(), so its UTC methods return the user's local values.

function computeNextDueDate(item: FinanceReminder, localNow: Date): Date {
  const today = new Date(Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
  ));

  switch (item.frequency) {
    case 'weekly': {
      const diff = (item.dueDay - today.getUTCDay() + 7) % 7;
      const next = new Date(today);
      next.setUTCDate(today.getUTCDate() + (diff === 0 ? 0 : diff));
      return next;
    }
    case 'biweekly': {
      const created = item.createdAt?.toDate?.() ?? today;
      const weeksSince = Math.floor(
        (today.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      const isThisWeek = weeksSince % 2 === 0;
      const diff = (item.dueDay - today.getUTCDay() + 7) % 7;
      const next = new Date(today);
      next.setUTCDate(today.getUTCDate() + diff + (isThisWeek ? 0 : 7));
      return next;
    }
    case 'monthly': {
      const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), item.dueDay));
      if (next < today) next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    }
    case 'quarterly': {
      for (const m of [0, 3, 6, 9]) {
        const candidate = new Date(Date.UTC(today.getUTCFullYear(), m, item.dueDay));
        if (candidate >= today) return candidate;
      }
      return new Date(Date.UTC(today.getUTCFullYear() + 1, 0, item.dueDay));
    }
    case 'yearly': {
      const next = new Date(Date.UTC(today.getUTCFullYear(), 0, item.dueDay));
      if (next < today) next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    }
    default:
      return today;
  }
}

// ─── Scheduled function — runs every 10 minutes ───

export const sendReminders = onSchedule('every 5 minutes', async () => {
  const nowMs = Date.now();
  const WINDOW_MS = 2 * 60 * 1000; // ±2-minute firing window

  // Fetch all users' settings docs (collection: users/{uid}/settings, doc: preferences)
  const settingsSnap = await db.collectionGroup('settings').get();

  const perUserTasks: Promise<void>[] = [];

  for (const settingsDoc of settingsSnap.docs) {
    const settings = settingsDoc.data() as UserSettings;
    if (!settings.notificationsEnabled || !settings.fcmToken) continue;

    const uid = settingsDoc.ref.parent.parent?.id;
    if (!uid) continue;

    const token = settings.fcmToken;
    const tzOffset = settings.timezoneOffset ?? 0;
    const localNow = toLocalFakeDate(nowMs, tzOffset);
    const todayStr = localDateString(localNow);

    // Local time-of-day in ms (e.g. 09:00 = 32 400 000)
    const localTimeMs =
      (localNow.getUTCHours() * 60 + localNow.getUTCMinutes()) * 60_000;

    perUserTasks.push(
      (async () => {
        // ── 1. Generic reminders: fire at dueDate + dueTime ──
        const genericSnap = await db
          .collection(`users/${uid}/reminders`)
          .where('type', '==', 'generic')
          .where('completed', '==', false)
          .where('active', '==', true)
          .where('dueDate', '==', todayStr)
          .get();

        for (const rdoc of genericSnap.docs) {
          const r = rdoc.data() as GenericReminder;

          // Use stored dueTime, or fall back to 9 AM local if none set
          const dueMsInDay = r.dueTime
            ? (() => { const [h, m] = r.dueTime!.split(':'); return (Number(h) * 60 + Number(m)) * 60_000; })()
            : 9 * 60 * 60_000;

          if (Math.abs(localTimeMs - dueMsInDay) <= WINDOW_MS) {
            await admin.messaging().send({
              token,
              notification: { title: 'Reminder', body: r.name },
            });
          }
        }

        // ── 2. Finance reminders: fire at 9 AM if due today and unpaid ──
        const nineAMMs = 9 * 60 * 60_000;
        if (Math.abs(localTimeMs - nineAMMs) > WINDOW_MS) return;

        const financeSnap = await db
          .collection(`users/${uid}/reminders`)
          .where('type', '==', 'finance')
          .where('active', '==', true)
          .get();

        for (const fdoc of financeSnap.docs) {
          const fr: FinanceReminder = { id: fdoc.id, ...(fdoc.data() as Omit<FinanceReminder, 'id'>) };
          const nextDue = computeNextDueDate(fr, localNow);

          if (localDateString(nextDue) !== todayStr) continue;

          // Check if already paid or skipped today
          const paidSnap = await db
            .collection(`users/${uid}/activities`)
            .where('type', '==', 'payment')
            .where('reminderId', '==', fr.id)
            .where('date', '==', todayStr)
            .limit(1)
            .get();

          if (!paidSnap.empty) continue;

          await admin.messaging().send({
            token,
            notification: { title: 'Bill Due Today', body: fr.name },
          });
        }
      })(),
    );
  }

  await Promise.allSettled(perUserTasks);
});
