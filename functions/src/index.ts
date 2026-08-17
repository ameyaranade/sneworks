// sneworks — push notification scheduler + Claude-powered daily summary
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';

const anthropicKey = defineSecret('ANTHROPIC_API_KEY');

admin.initializeApp();
const db = admin.firestore();

// AI task processor (Firestore-triggered) — resolves relative/holiday dates and
// creates a Google Calendar reminder via the self-hosted MCP server. See
// functions/src/ai/processAiTask.ts and services/gcal-mcp/.
export { processAiTask } from './ai/processAiTask';

// In-app conversational agent (Firestore-triggered on a new chat message). Runs a
// Tool Runner loop over the user's own todos/logs/groups via the Admin SDK. Gated
// off by default (settings.assistantEnabled). See functions/src/ai/assistantAgent.ts.
export { assistantAgent } from './ai/assistantAgent';

// Phase 2 approval gate: executes a destructive agent action once the user flips
// its proposedActions doc to approved/rejected. See functions/src/ai/resumeAgent.ts.
export { resumeAgent } from './ai/resumeAgent';

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

// ─── Sandbox types ───────────────────────────────────────────────────────────

interface SandboxRoutine {
  groupKind: string;
  name: string;
  recurrence: string;   // 'daily' | 'weekdays' | 'weekly:MON' etc.
  spawnTime: string;    // 'HH:MM'
  archivedAt?: admin.firestore.Timestamp;
  deferUntil?: admin.firestore.Timestamp;
  childCount: number;
}

// ─── Recurrence helper ────────────────────────────────────────────────────────

function isRoutineDueToday(recurrence: string, localNow: Date): boolean {
  const day = localNow.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return day >= 1 && day <= 5;
  const m = recurrence.match(/^weekly:([A-Z]+)$/);
  if (m) {
    const DAY_MAP: Record<string, number> = {
      SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
    };
    return day === (DAY_MAP[m[1]] ?? -1);
  }
  return false;
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

        // ── 3. Sandbox routine spawn notifications ──
        const sandboxGroupsSnap = await db
          .collection(`users/${uid}/sandbox_groups`)
          .where('groupKind', '==', 'routine')
          .get();

        for (const rdoc of sandboxGroupsSnap.docs) {
          const r = rdoc.data() as SandboxRoutine;
          if (r.archivedAt) continue;
          if (r.deferUntil && r.deferUntil.toDate() > new Date(nowMs)) continue;
          if (!isRoutineDueToday(r.recurrence, localNow)) continue;
          if (!r.spawnTime) continue;

          const parts = r.spawnTime.split(':').map(Number);
          const spawnMs = (parts[0] * 60 + parts[1]) * 60_000;

          if (Math.abs(localTimeMs - spawnMs) <= WINDOW_MS) {
            await admin.messaging().send({
              token,
              notification: {
                title: r.name,
                body: r.childCount > 0
                  ? `${r.childCount} task${r.childCount > 1 ? 's' : ''} for today`
                  : 'Your routine is ready for today',
              },
            });
          }
        }

        // ── 4. Sandbox overdue todos at 9 AM ──
        const sandboxTodosSnap = await db
          .collection(`users/${uid}/sandbox_todos`)
          .where('status', '==', 'pending')
          .get();

        const overdueTodos = sandboxTodosSnap.docs.filter((d) => {
          const data = d.data() as { dueDate?: string };
          return data.dueDate && data.dueDate < todayStr;
        });

        if (overdueTodos.length > 0 && Math.abs(localTimeMs - nineAMMs) <= WINDOW_MS) {
          await admin.messaging().send({
            token,
            notification: {
              title: 'Overdue tasks',
              body: `You have ${overdueTodos.length} overdue task${overdueTodos.length > 1 ? 's' : ''}`,
            },
          });
        }
      })(),
    );
  }

  await Promise.allSettled(perUserTasks);
});

// ─── Daily summary ────────────────────────────────────────────────────────────

interface SummaryTodoItem {
  title: string;
  todoType: string;
  amount?: number;
  groupName?: string;
  overdue: boolean;
}

const DAILY_SUMMARY_CALL_LIMIT = 1000;

async function checkAndIncrementRateLimit(dateStr: string): Promise<boolean> {
  const limitRef = db.collection('dailySummaryCounts').doc(dateStr);
  return db.runTransaction(async (txn) => {
    const snap = await txn.get(limitRef);
    const count: number = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    if (count >= DAILY_SUMMARY_CALL_LIMIT) return false;
    txn.set(limitRef, { count: count + 1 }, { merge: true });
    return true;
  });
}

export const generateDailySummary = onCall(
  { secrets: [anthropicKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = request.auth.uid;

    // Read settings for timezone offset
    const settingsSnap = await db.doc(`users/${uid}/settings/preferences`).get();
    const tzOffset: number = settingsSnap.exists
      ? (((settingsSnap.data() as { timezoneOffset?: number }).timezoneOffset) ?? 0)
      : 0;

    // Compute local today's window in real UTC ms
    const localNow = toLocalFakeDate(Date.now(), tzOffset);
    const y = localNow.getUTCFullYear();
    const mo = localNow.getUTCMonth();
    const d = localNow.getUTCDate();
    // localMidnightFakeMs is a fake-UTC ms where UTC methods give local midnight
    const localMidnightFakeMs = Date.UTC(y, mo, d);
    // real UTC ms at local midnight = fake ms + tzOffset * 60000
    const realTodayStartMs = localMidnightFakeMs + tzOffset * 60_000;
    const realTodayEndMs = realTodayStartMs + 24 * 60 * 60 * 1000 - 1;
    const todayDateStr = localDateString(localNow);

    // Read todos and groups in parallel
    const [todosSnap, groupsSnap] = await Promise.all([
      db.collection(`users/${uid}/todos`).get(),
      db.collection(`users/${uid}/groups`).get(),
    ]);

    // Build groupId → group name map
    const groupNames: Record<string, string> = {};
    for (const gdoc of groupsSnap.docs) {
      const g = gdoc.data() as { name?: string };
      if (g.name) groupNames[gdoc.id] = g.name;
    }

    // Filter to today's actionable items (pending/deferred, not shopping, due today or overdue or no due date)
    const items: SummaryTodoItem[] = [];
    for (const tdoc of todosSnap.docs) {
      const t = tdoc.data() as {
        status?: string;
        todoType?: string;
        title?: string;
        dueAt?: admin.firestore.Timestamp | null;
        groupId?: string;
        amount?: number;
      };
      if (t.status !== 'pending' && t.status !== 'deferred') continue;
      if (t.todoType === 'shopping-item') continue;

      const dueMs = t.dueAt ? t.dueAt.toMillis() : null;
      // Include inbox items (no dueAt) and anything due today or earlier
      if (dueMs !== null && dueMs > realTodayEndMs) continue;

      items.push({
        title: t.title ?? '(untitled)',
        todoType: t.todoType ?? 'generic-task',
        amount: t.amount,
        groupName: t.groupId ? groupNames[t.groupId] : undefined,
        overdue: dueMs !== null && dueMs < realTodayStartMs,
      });
    }

    if (items.length === 0) return { text: '' };

    // Global rate limit: at most 1000 Claude calls per day (UTC date bucket)
    const allowed = await checkAndIncrementRateLimit(todayDateStr);
    if (!allowed) return { text: '', limited: true };

    // Group items by parent group name; ungrouped items go under "TODOs"
    const byGroup = new Map<string, SummaryTodoItem[]>();
    for (const item of items) {
      const key = item.groupName ?? 'TODOs';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(item);
    }

    const sections = Array.from(byGroup.entries()).map(([groupName, groupItems]) => {
      const lines = groupItems.map((item) => {
        let line = `* ${item.title}`;
        if (item.todoType === 'money-reminder' && item.amount != null) line += ` (₹${item.amount})`;
        if (item.overdue) line += ' (overdue)';
        return line;
      });
      return `[${groupName}]\n${lines.join('\n')}`;
    });
    const promptBody = sections.join('\n\n');

    const anthropic = new Anthropic({ apiKey: anthropicKey.value() });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system:
        "You write a warm, concise 2–3 sentence summary of the user's day from their task list. " +
        'Be specific about what they have ahead. No preamble, no lists, second person.',
      messages: [
        {
          role: 'user',
          content: `Here is my task list for today:\n\n${promptBody}`,
        },
      ],
    });

    const text =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    return { text };
  },
);

// ─── Shared groups (one top-level sharedProjects collection; covers projects + lists) ──
// The `members` map / `ownerUid` on sharedProjects/{gid} are the ACL. Only these
// callables (Admin SDK, bypasses rules) may mutate them — firestore.rules
// rejects client writes to those fields.

const SHARED_BATCH_LIMIT = 400;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Batches an arbitrary number of writes, flushing at SHARED_BATCH_LIMIT. */
function batchWriter() {
  let batch = db.batch();
  let pending = 0;
  return {
    stage: (fn: (b: FirebaseFirestore.WriteBatch) => void) => {
      fn(batch);
      pending += 1;
    },
    flushIfFull: async () => {
      if (pending < SHARED_BATCH_LIMIT) return;
      await batch.commit();
      batch = db.batch();
      pending = 0;
    },
    flush: async () => {
      if (pending === 0) return;
      await batch.commit();
      batch = db.batch();
      pending = 0;
    },
  };
}

/** Reads a group + its sub-groups (projects only) + all their todos from the personal tree.
 *  Accepts groupKind 'project' or 'shopping-list' — rejects routines/recurring-todos (D12). */
async function readPersonalGroupFamily(ownerUid: string, rootGroupId: string) {
  const rootRef = db.doc(`users/${ownerUid}/groups/${rootGroupId}`);
  const rootSnap = await rootRef.get();
  if (!rootSnap.exists) throw new HttpsError('not-found', 'Group not found');
  const rootData = rootSnap.data()!;
  const allowedKinds = ['project', 'shopping-list'];
  if (!allowedKinds.includes(rootData.groupKind)) {
    throw new HttpsError('failed-precondition', 'Only projects and shopping lists can be shared');
  }
  if (rootData.groupKind === 'project' && rootData.parentGroupId) {
    throw new HttpsError('failed-precondition', 'Share the top-level project, not a sub-project');
  }

  const groupDocs: Array<{ id: string; ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }> = [
    { id: rootGroupId, ref: rootRef, data: rootData },
  ];

  // Only projects have sub-groups; shopping lists are always single-layer.
  if (rootData.groupKind === 'project') {
    const subSnap = await db
      .collection(`users/${ownerUid}/groups`)
      .where('ancestorPath', 'array-contains', rootGroupId)
      .get();
    groupDocs.push(...subSnap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() })));
  }

  const todosByGroup = await Promise.all(
    groupDocs.map((p) => db.collection(`users/${ownerUid}/todos`).where('groupId', '==', p.id).get()),
  );

  return { projectDocs: groupDocs, todosByProject: todosByGroup };
}

/** Migrates a personal group (project or shopping list) into the shared collection. Owner-only, idempotent. */
async function migratePersonalProjectToShared(
  ownerUid: string,
  rootGroupId: string,
  ownerInfo: { name: string; email: string },
): Promise<void> {
  const alreadyShared = await db.doc(`sharedProjects/${rootGroupId}`).get();
  if (alreadyShared.exists) return;

  const { projectDocs, todosByProject } = await readPersonalGroupFamily(ownerUid, rootGroupId);

  const totalWrites = projectDocs.length * 2 + todosByProject.reduce((n, s) => n + s.size * 2, 0);
  if (totalWrites > SHARED_BATCH_LIMIT) {
    throw new HttpsError('resource-exhausted', 'Project is too large to share in one step');
  }

  const members = { [ownerUid]: true };
  const memberNames = { [ownerUid]: ownerInfo };
  const { stage, flush } = batchWriter();

  for (let i = 0; i < projectDocs.length; i++) {
    const p = projectDocs[i];
    stage((b) =>
      b.set(db.doc(`sharedProjects/${p.id}`), {
        ...p.data,
        location: 'shared',
        ownerUid,
        members,
        memberNames,
        memberCount: 1,
        rootSharedId: rootGroupId,
      }),
    );
    stage((b) => b.delete(p.ref));

    for (const tdoc of todosByProject[i].docs) {
      stage((b) => b.set(db.doc(`sharedProjects/${p.id}/todos/${tdoc.id}`), tdoc.data()));
      stage((b) => b.delete(tdoc.ref));
    }
  }
  await flush();
}

/** Deletes (or restores to personal) an entire shared-project family: root + sub-projects + their tasks. */
async function deleteSharedProjectFamily(
  ownerUid: string,
  rootSharedId: string,
  opts: { restoreToPersonal: boolean },
): Promise<void> {
  const familySnap = await db.collection('sharedProjects').where('rootSharedId', '==', rootSharedId).get();
  const { stage, flushIfFull, flush } = batchWriter();

  for (const doc of familySnap.docs) {
    const data = doc.data();
    const todosSnap = await db.collection(`sharedProjects/${doc.id}/todos`).get();

    if (opts.restoreToPersonal) {
      const cleaned: Record<string, unknown> = { ...data };
      delete cleaned.location;
      delete cleaned.ownerUid;
      delete cleaned.members;
      delete cleaned.memberNames;
      delete cleaned.memberCount;
      delete cleaned.rootSharedId;
      stage((b) => b.set(db.doc(`users/${ownerUid}/groups/${doc.id}`), cleaned));
      await flushIfFull();
      for (const tdoc of todosSnap.docs) {
        stage((b) => b.set(db.doc(`users/${ownerUid}/todos/${tdoc.id}`), tdoc.data()));
        await flushIfFull();
        stage((b) => b.delete(tdoc.ref));
        await flushIfFull();
      }
    } else {
      for (const tdoc of todosSnap.docs) {
        stage((b) => b.delete(tdoc.ref));
        await flushIfFull();
      }
    }
    stage((b) => b.delete(doc.ref));
    await flushIfFull();
  }
  await flush();
}

/** Adds/removes a uid (+ display info) across every doc in a shared-project family (root + sub-projects). */
async function updateFamilyMembership(
  rootSharedId: string,
  uid: string,
  action: 'add' | 'remove',
  info?: { name: string; email: string },
): Promise<void> {
  const familySnap = await db.collection('sharedProjects').where('rootSharedId', '==', rootSharedId).get();
  const batch = db.batch();
  for (const doc of familySnap.docs) {
    const members = (doc.data().members as Record<string, true>) ?? {};
    const remaining = Object.keys(members).filter((m) => m !== uid);
    const memberCount = action === 'add' ? remaining.length + 1 : remaining.length;
    batch.update(doc.ref, {
      [`members.${uid}`]: action === 'add' ? true : admin.firestore.FieldValue.delete(),
      [`memberNames.${uid}`]: action === 'add' ? (info ?? { name: 'Member', email: '' }) : admin.firestore.FieldValue.delete(),
      memberCount,
    });
  }
  await batch.commit();
}

export const inviteToProject = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const { pid, email } = (request.data ?? {}) as { pid?: string; email?: string };
  if (!pid || !email) throw new HttpsError('invalid-argument', 'pid and email are required');

  const invitedEmail = normalizeEmail(email);
  if (!isValidEmail(invitedEmail)) throw new HttpsError('invalid-argument', 'Enter a valid email address');
  if (invitedEmail === (request.auth.token.email ?? '').toLowerCase()) {
    throw new HttpsError('invalid-argument', "That's your own email");
  }

  const sharedRef = db.doc(`sharedProjects/${pid}`);
  let sharedSnap = await sharedRef.get();
  if (!sharedSnap.exists) {
    await migratePersonalProjectToShared(uid, pid, {
      name: request.auth.token.name ?? request.auth.token.email ?? 'Owner',
      email: (request.auth.token.email ?? '').toLowerCase(),
    });
    sharedSnap = await sharedRef.get();
  }

  const shared = sharedSnap.data()!;
  if (shared.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can invite');

  // Neutral error used when the recipient has blocked this sender (D11) — never
  // reveal the block, so it can't be probed. Same text as a generic send failure.
  const NEUTRAL_SEND_ERROR = "Couldn't send an invite to this address.";

  try {
    const existingUser = await admin.auth().getUserByEmail(invitedEmail);
    if ((shared.members as Record<string, true>)?.[existingUser.uid]) {
      throw new HttpsError('already-exists', 'Already a member');
    }
    // Anti-flood: if the recipient has blocked this sender, silently refuse.
    const recipientSettings = await db.doc(`users/${existingUser.uid}/settings/preferences`).get();
    const blocked = (recipientSettings.data()?.blockedInviters as Array<{ uid: string }> | undefined) ?? [];
    if (blocked.some((b) => b.uid === uid)) {
      throw new HttpsError('permission-denied', NEUTRAL_SEND_ERROR);
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    // auth/user-not-found — fine, they'll accept once they sign in with that email.
  }

  const dupeSnap = await db
    .collection('invites')
    .where('pid', '==', pid)
    .where('invitedEmail', '==', invitedEmail)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!dupeSnap.empty) throw new HttpsError('already-exists', 'Already invited');

  await db.collection('invites').add({
    pid,
    projectName: (shared.name as string) ?? 'Project',
    invitedEmail,
    invitedBy: uid,
    invitedByName: request.auth.token.name ?? request.auth.token.email ?? 'Someone',
    invitedByEmail: (request.auth.token.email ?? '').toLowerCase(),
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const acceptInvite = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const myEmail = (request.auth.token.email ?? '').toLowerCase();
  const { inviteId } = (request.data ?? {}) as { inviteId?: string };
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required');

  const inviteRef = db.doc(`invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invite not found');
  const invite = inviteSnap.data()!;
  if (invite.invitedEmail !== myEmail) throw new HttpsError('permission-denied', 'This invite is not for you');
  if (invite.status !== 'pending') throw new HttpsError('failed-precondition', 'Invite already resolved');

  const sharedRef = db.doc(`sharedProjects/${invite.pid}`);
  const sharedSnap = await sharedRef.get();
  if (!sharedSnap.exists) {
    await inviteRef.update({ status: 'revoked' });
    throw new HttpsError('not-found', 'Project no longer exists');
  }
  const rootSharedId = (sharedSnap.data()!.rootSharedId as string) ?? invite.pid;

  await updateFamilyMembership(rootSharedId, uid, 'add', {
    name: request.auth.token.name ?? myEmail,
    email: myEmail,
  });
  await inviteRef.update({ status: 'accepted' });

  return { ok: true, pid: invite.pid as string };
});

export const declineInvite = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const myEmail = (request.auth.token.email ?? '').toLowerCase();
  const { inviteId } = (request.data ?? {}) as { inviteId?: string };
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required');

  const inviteRef = db.doc(`invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invite not found');
  const invite = inviteSnap.data()!;
  if (invite.invitedEmail !== myEmail) throw new HttpsError('permission-denied', 'This invite is not for you');
  if (invite.status === 'pending') await inviteRef.update({ status: 'declined' });

  return { ok: true };
});

export const revokeInvite = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const { inviteId } = (request.data ?? {}) as { inviteId?: string };
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required');

  const inviteRef = db.doc(`invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invite not found');
  const invite = inviteSnap.data()!;
  if (invite.invitedBy !== uid) throw new HttpsError('permission-denied', 'Only the inviter can revoke');
  if (invite.status === 'pending') await inviteRef.update({ status: 'revoked' });

  return { ok: true };
});

/**
 * Blocks the sender of an invite (D11): adds them to the recipient's
 * `blockedInviters` and declines every pending invite from that sender to this
 * recipient — atomically, server-side. Future invites are refused in
 * inviteToProject. Runs as the recipient (invite.invitedEmail must match).
 */
export const blockInviter = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const myEmail = (request.auth.token.email ?? '').toLowerCase();
  const { inviteId } = (request.data ?? {}) as { inviteId?: string };
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required');

  const inviteSnap = await db.doc(`invites/${inviteId}`).get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invite not found');
  const invite = inviteSnap.data()!;
  if (invite.invitedEmail !== myEmail) throw new HttpsError('permission-denied', 'This invite is not for you');

  const senderUid = invite.invitedBy as string;
  if (senderUid === uid) throw new HttpsError('failed-precondition', "You can't block yourself");

  // Add to the recipient's block list (dedupe by sender uid).
  const settingsRef = db.doc(`users/${uid}/settings/preferences`);
  const settingsSnap = await settingsRef.get();
  const existing = (settingsSnap.data()?.blockedInviters as Array<{ uid: string }> | undefined) ?? [];
  if (!existing.some((b) => b.uid === senderUid)) {
    await settingsRef.set(
      {
        blockedInviters: admin.firestore.FieldValue.arrayUnion({
          uid: senderUid,
          email: (invite.invitedByEmail as string) ?? '',
          name: (invite.invitedByName as string) ?? 'Someone',
          blockedAt: admin.firestore.Timestamp.now(),
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  // Decline every pending invite from this sender to this recipient.
  const pendingSnap = await db
    .collection('invites')
    .where('invitedEmail', '==', myEmail)
    .where('invitedBy', '==', senderUid)
    .where('status', '==', 'pending')
    .get();
  await Promise.all(pendingSnap.docs.map((d) => d.ref.update({ status: 'declined' })));

  return { ok: true };
});

export const leaveProject = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const { pid } = (request.data ?? {}) as { pid?: string };
  if (!pid) throw new HttpsError('invalid-argument', 'pid is required');

  const sharedSnap = await db.doc(`sharedProjects/${pid}`).get();
  if (!sharedSnap.exists) return { ok: true };
  const shared = sharedSnap.data()!;
  if (shared.ownerUid === uid) {
    throw new HttpsError('failed-precondition', 'Owner cannot leave — delete the project instead');
  }
  if (!(shared.members as Record<string, true>)?.[uid]) return { ok: true };

  await updateFamilyMembership((shared.rootSharedId as string) ?? pid, uid, 'remove');
  return { ok: true };
});

export const removeMember = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const { pid, memberUid } = (request.data ?? {}) as { pid?: string; memberUid?: string };
  if (!pid || !memberUid) throw new HttpsError('invalid-argument', 'pid and memberUid are required');

  const sharedSnap = await db.doc(`sharedProjects/${pid}`).get();
  if (!sharedSnap.exists) throw new HttpsError('not-found', 'Project not found');
  const shared = sharedSnap.data()!;
  if (shared.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can remove members');
  if (memberUid === shared.ownerUid) throw new HttpsError('failed-precondition', 'Cannot remove the owner');

  await updateFamilyMembership((shared.rootSharedId as string) ?? pid, memberUid, 'remove');
  return { ok: true };
});

export const unshareProject = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const { pid } = (request.data ?? {}) as { pid?: string };
  if (!pid) throw new HttpsError('invalid-argument', 'pid is required');

  const rootSnap = await db.doc(`sharedProjects/${pid}`).get();
  if (!rootSnap.exists) throw new HttpsError('not-found', 'Project not found');
  const root = rootSnap.data()!;
  if (root.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can unshare');
  if (root.rootSharedId !== pid) throw new HttpsError('failed-precondition', 'Unshare from the root project');

  await deleteSharedProjectFamily(uid, pid, { restoreToPersonal: true });

  const invitesSnap = await db.collection('invites').where('pid', '==', pid).where('status', '==', 'pending').get();
  await Promise.all(invitesSnap.docs.map((d) => d.ref.update({ status: 'revoked' })));

  return { ok: true };
});

export const deleteSharedProject = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const { pid } = (request.data ?? {}) as { pid?: string };
  if (!pid) throw new HttpsError('invalid-argument', 'pid is required');

  const rootSnap = await db.doc(`sharedProjects/${pid}`).get();
  if (!rootSnap.exists) return { ok: true };
  const root = rootSnap.data()!;
  if (root.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the owner can delete');

  await deleteSharedProjectFamily(uid, (root.rootSharedId as string) ?? pid, { restoreToPersonal: false });

  const invitesSnap = await db.collection('invites').where('pid', '==', pid).where('status', '==', 'pending').get();
  await Promise.all(invitesSnap.docs.map((d) => d.ref.update({ status: 'revoked' })));

  return { ok: true };
});

/** Called from the client's account-erase flow (userDataRegistry). */
export const eraseMySharedProjectData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const uid = request.auth.uid;
  const myEmail = (request.auth.token.email ?? '').toLowerCase();

  // 1. Projects this user owns: cascade-delete for everyone (D8).
  const ownedSnap = await db.collection('sharedProjects').where('ownerUid', '==', uid).get();
  const ownedRootIds = new Set(
    ownedSnap.docs.filter((d) => d.data().rootSharedId === d.id).map((d) => d.id),
  );
  for (const rootId of ownedRootIds) {
    await deleteSharedProjectFamily(uid, rootId, { restoreToPersonal: false });
  }

  // 2. Memberships in projects owned by others: leave (their data isn't touched).
  const memberSnap = await db.collection('sharedProjects').where(`members.${uid}`, '==', true).get();
  const foreignRootIds = new Set(
    memberSnap.docs.filter((d) => d.data().ownerUid !== uid).map((d) => (d.data().rootSharedId as string) ?? d.id),
  );
  for (const rootId of foreignRootIds) {
    await updateFamilyMembership(rootId, uid, 'remove');
  }

  // 3. Invites: revoke ones sent by this user, decline ones addressed to their email.
  const [sentSnap, receivedSnap] = await Promise.all([
    db.collection('invites').where('invitedBy', '==', uid).where('status', '==', 'pending').get(),
    db.collection('invites').where('invitedEmail', '==', myEmail).where('status', '==', 'pending').get(),
  ]);
  await Promise.all([
    ...sentSnap.docs.map((d) => d.ref.update({ status: 'revoked' })),
    ...receivedSnap.docs.map((d) => d.ref.update({ status: 'declined' })),
  ]);

  return { ok: true };
});

/** Server-side count recompute — avoids the multi-writer race of client-side recompute. */
async function recomputeSharedProjectCounts(pid: string, depth = 0): Promise<void> {
  if (depth > 3) return; // safety guard against runaway recursion (mirrors client recomputeGroupCounts)

  const projectRef = db.doc(`sharedProjects/${pid}`);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return;

  const todosSnap = await db.collection(`sharedProjects/${pid}/todos`).get();
  const items = todosSnap.docs.map((d) => d.data() as { status?: string; todoType?: string; price?: number });
  const childCount = items.length;
  const doneCount = items.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  const totalSpent = items.reduce((sum, t) => sum + (t.todoType === 'shopping-item' ? (t.price ?? 0) : 0), 0);

  const subSnap = await db.collection('sharedProjects').where('parentGroupId', '==', pid).get();
  const subGroups = subSnap.docs.map((d) => d.data() as { completed?: boolean });
  const allSubsDone = subGroups.length === 0 || subGroups.every((sg) => sg.completed);
  const totalItems = childCount + subGroups.length;
  const allTodosDone = childCount === 0 || doneCount === childCount;
  const completed = totalItems > 0 && allTodosDone && allSubsDone;

  const payload: Record<string, unknown> = { childCount, doneCount, totalSpent, completed };
  if (completed) payload.completedAt = admin.firestore.FieldValue.serverTimestamp();
  await projectRef.update(payload);

  const parentGroupId = (projectSnap.data() as { parentGroupId?: string }).parentGroupId;
  if (parentGroupId) await recomputeSharedProjectCounts(parentGroupId, depth + 1);
}

export const onSharedTaskWrite = onDocumentWritten('sharedProjects/{pid}/todos/{tid}', async (event) => {
  await recomputeSharedProjectCounts(event.params.pid);
});

// ─── Presence cleanup (docs/SHAREABLE_PROJECTS_SPEC.md D9) ─────────────────────
// `onDisconnect().remove()` clears a user's presence when their tab closes
// cleanly, but a hard crash / lost connection can orphan an entry. This sweep is
// the backstop: it prunes any presence node whose heartbeat is older than the
// staleness window, and removes now-empty project buckets, so RTDB never
// accumulates stale data (keeps it effectively empty when nobody is active).
const PRESENCE_STALE_MS = 2 * 60 * 1000;

export const prunePresence = onSchedule('every 5 minutes', async () => {
  const rtdb = admin.database();
  const rootRef = rtdb.ref('presence');
  const snap = await rootRef.get();
  if (!snap.exists()) return;

  const now = Date.now();
  const updates: Record<string, null> = {};
  const projects = (snap.val() as Record<string, Record<string, { at?: number }>>) ?? {};

  for (const [pid, entries] of Object.entries(projects)) {
    let liveInBucket = 0;
    for (const [uid, entry] of Object.entries(entries ?? {})) {
      const at = typeof entry?.at === 'number' ? entry.at : 0;
      if (now - at > PRESENCE_STALE_MS) {
        updates[`${pid}/${uid}`] = null; // prune stale entry
      } else {
        liveInBucket += 1;
      }
    }
    if (liveInBucket === 0) updates[pid] = null; // drop the empty project bucket
  }

  if (Object.keys(updates).length > 0) await rootRef.update(updates);
});
