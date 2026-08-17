"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prunePresence = exports.onSharedTaskWrite = exports.eraseMySharedProjectData = exports.deleteSharedProject = exports.unshareProject = exports.removeMember = exports.leaveProject = exports.blockInviter = exports.revokeInvite = exports.declineInvite = exports.acceptInvite = exports.inviteToProject = exports.generateDailySummary = exports.sendReminders = exports.resumeAgent = exports.assistantAgent = exports.processAiTask = void 0;
// sneworks — push notification scheduler + Claude-powered daily summary
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
admin.initializeApp();
const db = admin.firestore();
// AI task processor (Firestore-triggered) — resolves relative/holiday dates and
// creates a Google Calendar reminder via the self-hosted MCP server. See
// functions/src/ai/processAiTask.ts and services/gcal-mcp/.
var processAiTask_1 = require("./ai/processAiTask");
Object.defineProperty(exports, "processAiTask", { enumerable: true, get: function () { return processAiTask_1.processAiTask; } });
// In-app conversational agent (Firestore-triggered on a new chat message). Runs a
// Tool Runner loop over the user's own todos/logs/groups via the Admin SDK. Gated
// off by default (settings.assistantEnabled). See functions/src/ai/assistantAgent.ts.
var assistantAgent_1 = require("./ai/assistantAgent");
Object.defineProperty(exports, "assistantAgent", { enumerable: true, get: function () { return assistantAgent_1.assistantAgent; } });
// Phase 2 approval gate: executes a destructive agent action once the user flips
// its proposedActions doc to approved/rejected. See functions/src/ai/resumeAgent.ts.
var resumeAgent_1 = require("./ai/resumeAgent");
Object.defineProperty(exports, "resumeAgent", { enumerable: true, get: function () { return resumeAgent_1.resumeAgent; } });
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
function toLocalFakeDate(utcMs, timezoneOffset) {
    return new Date(utcMs - timezoneOffset * 60000);
}
function localDateString(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
// ─── Recurrence helper ────────────────────────────────────────────────────────
function isRoutineDueToday(recurrence, localNow) {
    var _a;
    const day = localNow.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (recurrence === 'daily')
        return true;
    if (recurrence === 'weekdays')
        return day >= 1 && day <= 5;
    const m = recurrence.match(/^weekly:([A-Z]+)$/);
    if (m) {
        const DAY_MAP = {
            SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
        };
        return day === ((_a = DAY_MAP[m[1]]) !== null && _a !== void 0 ? _a : -1);
    }
    return false;
}
// ─── Next-due-date calculation (ported from client utils.ts) ───
// All Date operations use UTC methods so they work correctly on the Cloud
// Function server (which runs in UTC). `localNow` is a fake-UTC Date from
// toLocalFakeDate(), so its UTC methods return the user's local values.
function computeNextDueDate(item, localNow) {
    var _a, _b, _c;
    const today = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()));
    switch (item.frequency) {
        case 'weekly': {
            const diff = (item.dueDay - today.getUTCDay() + 7) % 7;
            const next = new Date(today);
            next.setUTCDate(today.getUTCDate() + (diff === 0 ? 0 : diff));
            return next;
        }
        case 'biweekly': {
            const created = (_c = (_b = (_a = item.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : today;
            const weeksSince = Math.floor((today.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));
            const isThisWeek = weeksSince % 2 === 0;
            const diff = (item.dueDay - today.getUTCDay() + 7) % 7;
            const next = new Date(today);
            next.setUTCDate(today.getUTCDate() + diff + (isThisWeek ? 0 : 7));
            return next;
        }
        case 'monthly': {
            const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), item.dueDay));
            if (next < today)
                next.setUTCMonth(next.getUTCMonth() + 1);
            return next;
        }
        case 'quarterly': {
            for (const m of [0, 3, 6, 9]) {
                const candidate = new Date(Date.UTC(today.getUTCFullYear(), m, item.dueDay));
                if (candidate >= today)
                    return candidate;
            }
            return new Date(Date.UTC(today.getUTCFullYear() + 1, 0, item.dueDay));
        }
        case 'yearly': {
            const next = new Date(Date.UTC(today.getUTCFullYear(), 0, item.dueDay));
            if (next < today)
                next.setUTCFullYear(next.getUTCFullYear() + 1);
            return next;
        }
        default:
            return today;
    }
}
// ─── Scheduled function — runs every 10 minutes ───
exports.sendReminders = (0, scheduler_1.onSchedule)('every 5 minutes', async () => {
    var _a, _b;
    const nowMs = Date.now();
    const WINDOW_MS = 2 * 60 * 1000; // ±2-minute firing window
    // Fetch all users' settings docs (collection: users/{uid}/settings, doc: preferences)
    const settingsSnap = await db.collectionGroup('settings').get();
    const perUserTasks = [];
    for (const settingsDoc of settingsSnap.docs) {
        const settings = settingsDoc.data();
        if (!settings.notificationsEnabled || !settings.fcmToken)
            continue;
        const uid = (_a = settingsDoc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
        if (!uid)
            continue;
        const token = settings.fcmToken;
        const tzOffset = (_b = settings.timezoneOffset) !== null && _b !== void 0 ? _b : 0;
        const localNow = toLocalFakeDate(nowMs, tzOffset);
        const todayStr = localDateString(localNow);
        // Local time-of-day in ms (e.g. 09:00 = 32 400 000)
        const localTimeMs = (localNow.getUTCHours() * 60 + localNow.getUTCMinutes()) * 60000;
        perUserTasks.push((async () => {
            // ── 1. Generic reminders: fire at dueDate + dueTime ──
            const genericSnap = await db
                .collection(`users/${uid}/reminders`)
                .where('type', '==', 'generic')
                .where('completed', '==', false)
                .where('active', '==', true)
                .where('dueDate', '==', todayStr)
                .get();
            for (const rdoc of genericSnap.docs) {
                const r = rdoc.data();
                // Use stored dueTime, or fall back to 9 AM local if none set
                const dueMsInDay = r.dueTime
                    ? (() => { const [h, m] = r.dueTime.split(':'); return (Number(h) * 60 + Number(m)) * 60000; })()
                    : 9 * 60 * 60000;
                if (Math.abs(localTimeMs - dueMsInDay) <= WINDOW_MS) {
                    await admin.messaging().send({
                        token,
                        notification: { title: 'Reminder', body: r.name },
                    });
                }
            }
            // ── 2. Finance reminders: fire at 9 AM if due today and unpaid ──
            const nineAMMs = 9 * 60 * 60000;
            if (Math.abs(localTimeMs - nineAMMs) > WINDOW_MS)
                return;
            const financeSnap = await db
                .collection(`users/${uid}/reminders`)
                .where('type', '==', 'finance')
                .where('active', '==', true)
                .get();
            for (const fdoc of financeSnap.docs) {
                const fr = Object.assign({ id: fdoc.id }, fdoc.data());
                const nextDue = computeNextDueDate(fr, localNow);
                if (localDateString(nextDue) !== todayStr)
                    continue;
                // Check if already paid or skipped today
                const paidSnap = await db
                    .collection(`users/${uid}/activities`)
                    .where('type', '==', 'payment')
                    .where('reminderId', '==', fr.id)
                    .where('date', '==', todayStr)
                    .limit(1)
                    .get();
                if (!paidSnap.empty)
                    continue;
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
                const r = rdoc.data();
                if (r.archivedAt)
                    continue;
                if (r.deferUntil && r.deferUntil.toDate() > new Date(nowMs))
                    continue;
                if (!isRoutineDueToday(r.recurrence, localNow))
                    continue;
                if (!r.spawnTime)
                    continue;
                const parts = r.spawnTime.split(':').map(Number);
                const spawnMs = (parts[0] * 60 + parts[1]) * 60000;
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
                const data = d.data();
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
        })());
    }
    await Promise.allSettled(perUserTasks);
});
const DAILY_SUMMARY_CALL_LIMIT = 1000;
async function checkAndIncrementRateLimit(dateStr) {
    const limitRef = db.collection('dailySummaryCounts').doc(dateStr);
    return db.runTransaction(async (txn) => {
        var _a, _b;
        const snap = await txn.get(limitRef);
        const count = snap.exists ? ((_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0) : 0;
        if (count >= DAILY_SUMMARY_CALL_LIMIT)
            return false;
        txn.set(limitRef, { count: count + 1 }, { merge: true });
        return true;
    });
}
exports.generateDailySummary = (0, https_1.onCall)({ secrets: [anthropicKey] }, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = request.auth.uid;
    // Read settings for timezone offset
    const settingsSnap = await db.doc(`users/${uid}/settings/preferences`).get();
    const tzOffset = settingsSnap.exists
        ? ((_a = (settingsSnap.data().timezoneOffset)) !== null && _a !== void 0 ? _a : 0)
        : 0;
    // Compute local today's window in real UTC ms
    const localNow = toLocalFakeDate(Date.now(), tzOffset);
    const y = localNow.getUTCFullYear();
    const mo = localNow.getUTCMonth();
    const d = localNow.getUTCDate();
    // localMidnightFakeMs is a fake-UTC ms where UTC methods give local midnight
    const localMidnightFakeMs = Date.UTC(y, mo, d);
    // real UTC ms at local midnight = fake ms + tzOffset * 60000
    const realTodayStartMs = localMidnightFakeMs + tzOffset * 60000;
    const realTodayEndMs = realTodayStartMs + 24 * 60 * 60 * 1000 - 1;
    const todayDateStr = localDateString(localNow);
    // Read todos and groups in parallel
    const [todosSnap, groupsSnap] = await Promise.all([
        db.collection(`users/${uid}/todos`).get(),
        db.collection(`users/${uid}/groups`).get(),
    ]);
    // Build groupId → group name map
    const groupNames = {};
    for (const gdoc of groupsSnap.docs) {
        const g = gdoc.data();
        if (g.name)
            groupNames[gdoc.id] = g.name;
    }
    // Filter to today's actionable items (pending/deferred, not shopping, due today or overdue or no due date)
    const items = [];
    for (const tdoc of todosSnap.docs) {
        const t = tdoc.data();
        if (t.status !== 'pending' && t.status !== 'deferred')
            continue;
        if (t.todoType === 'shopping-item')
            continue;
        const dueMs = t.dueAt ? t.dueAt.toMillis() : null;
        // Include inbox items (no dueAt) and anything due today or earlier
        if (dueMs !== null && dueMs > realTodayEndMs)
            continue;
        items.push({
            title: (_b = t.title) !== null && _b !== void 0 ? _b : '(untitled)',
            todoType: (_c = t.todoType) !== null && _c !== void 0 ? _c : 'generic-task',
            amount: t.amount,
            groupName: t.groupId ? groupNames[t.groupId] : undefined,
            overdue: dueMs !== null && dueMs < realTodayStartMs,
        });
    }
    if (items.length === 0)
        return { text: '' };
    // Global rate limit: at most 1000 Claude calls per day (UTC date bucket)
    const allowed = await checkAndIncrementRateLimit(todayDateStr);
    if (!allowed)
        return { text: '', limited: true };
    // Group items by parent group name; ungrouped items go under "TODOs"
    const byGroup = new Map();
    for (const item of items) {
        const key = (_d = item.groupName) !== null && _d !== void 0 ? _d : 'TODOs';
        if (!byGroup.has(key))
            byGroup.set(key, []);
        byGroup.get(key).push(item);
    }
    const sections = Array.from(byGroup.entries()).map(([groupName, groupItems]) => {
        const lines = groupItems.map((item) => {
            let line = `* ${item.title}`;
            if (item.todoType === 'money-reminder' && item.amount != null)
                line += ` (₹${item.amount})`;
            if (item.overdue)
                line += ' (overdue)';
            return line;
        });
        return `[${groupName}]\n${lines.join('\n')}`;
    });
    const promptBody = sections.join('\n\n');
    const anthropic = new sdk_1.default({ apiKey: anthropicKey.value() });
    const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: "You write a warm, concise 2–3 sentence summary of the user's day from their task list. " +
            'Be specific about what they have ahead. No preamble, no lists, second person.',
        messages: [
            {
                role: 'user',
                content: `Here is my task list for today:\n\n${promptBody}`,
            },
        ],
    });
    const text = ((_e = message.content[0]) === null || _e === void 0 ? void 0 : _e.type) === 'text' ? message.content[0].text : '';
    return { text };
});
// ─── Shared groups (one top-level sharedProjects collection; covers projects + lists) ──
// The `members` map / `ownerUid` on sharedProjects/{gid} are the ACL. Only these
// callables (Admin SDK, bypasses rules) may mutate them — firestore.rules
// rejects client writes to those fields.
const SHARED_BATCH_LIMIT = 400;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
/** Batches an arbitrary number of writes, flushing at SHARED_BATCH_LIMIT. */
function batchWriter() {
    let batch = db.batch();
    let pending = 0;
    return {
        stage: (fn) => {
            fn(batch);
            pending += 1;
        },
        flushIfFull: async () => {
            if (pending < SHARED_BATCH_LIMIT)
                return;
            await batch.commit();
            batch = db.batch();
            pending = 0;
        },
        flush: async () => {
            if (pending === 0)
                return;
            await batch.commit();
            batch = db.batch();
            pending = 0;
        },
    };
}
/** Reads a group + its sub-groups (projects only) + all their todos from the personal tree.
 *  Accepts groupKind 'project' or 'shopping-list' — rejects routines/recurring-todos (D12). */
async function readPersonalGroupFamily(ownerUid, rootGroupId) {
    const rootRef = db.doc(`users/${ownerUid}/groups/${rootGroupId}`);
    const rootSnap = await rootRef.get();
    if (!rootSnap.exists)
        throw new https_1.HttpsError('not-found', 'Group not found');
    const rootData = rootSnap.data();
    const allowedKinds = ['project', 'shopping-list'];
    if (!allowedKinds.includes(rootData.groupKind)) {
        throw new https_1.HttpsError('failed-precondition', 'Only projects and shopping lists can be shared');
    }
    if (rootData.groupKind === 'project' && rootData.parentGroupId) {
        throw new https_1.HttpsError('failed-precondition', 'Share the top-level project, not a sub-project');
    }
    const groupDocs = [
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
    const todosByGroup = await Promise.all(groupDocs.map((p) => db.collection(`users/${ownerUid}/todos`).where('groupId', '==', p.id).get()));
    return { projectDocs: groupDocs, todosByProject: todosByGroup };
}
/** Migrates a personal group (project or shopping list) into the shared collection. Owner-only, idempotent. */
async function migratePersonalProjectToShared(ownerUid, rootGroupId, ownerInfo) {
    const alreadyShared = await db.doc(`sharedProjects/${rootGroupId}`).get();
    if (alreadyShared.exists)
        return;
    const { projectDocs, todosByProject } = await readPersonalGroupFamily(ownerUid, rootGroupId);
    const totalWrites = projectDocs.length * 2 + todosByProject.reduce((n, s) => n + s.size * 2, 0);
    if (totalWrites > SHARED_BATCH_LIMIT) {
        throw new https_1.HttpsError('resource-exhausted', 'Project is too large to share in one step');
    }
    const members = { [ownerUid]: true };
    const memberNames = { [ownerUid]: ownerInfo };
    const { stage, flush } = batchWriter();
    for (let i = 0; i < projectDocs.length; i++) {
        const p = projectDocs[i];
        stage((b) => b.set(db.doc(`sharedProjects/${p.id}`), Object.assign(Object.assign({}, p.data), { location: 'shared', ownerUid,
            members,
            memberNames, memberCount: 1, rootSharedId: rootGroupId })));
        stage((b) => b.delete(p.ref));
        for (const tdoc of todosByProject[i].docs) {
            stage((b) => b.set(db.doc(`sharedProjects/${p.id}/todos/${tdoc.id}`), tdoc.data()));
            stage((b) => b.delete(tdoc.ref));
        }
    }
    await flush();
}
/** Deletes (or restores to personal) an entire shared-project family: root + sub-projects + their tasks. */
async function deleteSharedProjectFamily(ownerUid, rootSharedId, opts) {
    const familySnap = await db.collection('sharedProjects').where('rootSharedId', '==', rootSharedId).get();
    const { stage, flushIfFull, flush } = batchWriter();
    for (const doc of familySnap.docs) {
        const data = doc.data();
        const todosSnap = await db.collection(`sharedProjects/${doc.id}/todos`).get();
        if (opts.restoreToPersonal) {
            const cleaned = Object.assign({}, data);
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
        }
        else {
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
async function updateFamilyMembership(rootSharedId, uid, action, info) {
    var _a;
    const familySnap = await db.collection('sharedProjects').where('rootSharedId', '==', rootSharedId).get();
    const batch = db.batch();
    for (const doc of familySnap.docs) {
        const members = (_a = doc.data().members) !== null && _a !== void 0 ? _a : {};
        const remaining = Object.keys(members).filter((m) => m !== uid);
        const memberCount = action === 'add' ? remaining.length + 1 : remaining.length;
        batch.update(doc.ref, {
            [`members.${uid}`]: action === 'add' ? true : admin.firestore.FieldValue.delete(),
            [`memberNames.${uid}`]: action === 'add' ? (info !== null && info !== void 0 ? info : { name: 'Member', email: '' }) : admin.firestore.FieldValue.delete(),
            memberCount,
        });
    }
    await batch.commit();
}
exports.inviteToProject = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { pid, email } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!pid || !email)
        throw new https_1.HttpsError('invalid-argument', 'pid and email are required');
    const invitedEmail = normalizeEmail(email);
    if (!isValidEmail(invitedEmail))
        throw new https_1.HttpsError('invalid-argument', 'Enter a valid email address');
    if (invitedEmail === ((_b = request.auth.token.email) !== null && _b !== void 0 ? _b : '').toLowerCase()) {
        throw new https_1.HttpsError('invalid-argument', "That's your own email");
    }
    const sharedRef = db.doc(`sharedProjects/${pid}`);
    let sharedSnap = await sharedRef.get();
    if (!sharedSnap.exists) {
        await migratePersonalProjectToShared(uid, pid, {
            name: (_d = (_c = request.auth.token.name) !== null && _c !== void 0 ? _c : request.auth.token.email) !== null && _d !== void 0 ? _d : 'Owner',
            email: ((_e = request.auth.token.email) !== null && _e !== void 0 ? _e : '').toLowerCase(),
        });
        sharedSnap = await sharedRef.get();
    }
    const shared = sharedSnap.data();
    if (shared.ownerUid !== uid)
        throw new https_1.HttpsError('permission-denied', 'Only the owner can invite');
    // Neutral error used when the recipient has blocked this sender (D11) — never
    // reveal the block, so it can't be probed. Same text as a generic send failure.
    const NEUTRAL_SEND_ERROR = "Couldn't send an invite to this address.";
    try {
        const existingUser = await admin.auth().getUserByEmail(invitedEmail);
        if ((_f = shared.members) === null || _f === void 0 ? void 0 : _f[existingUser.uid]) {
            throw new https_1.HttpsError('already-exists', 'Already a member');
        }
        // Anti-flood: if the recipient has blocked this sender, silently refuse.
        const recipientSettings = await db.doc(`users/${existingUser.uid}/settings/preferences`).get();
        const blocked = (_h = (_g = recipientSettings.data()) === null || _g === void 0 ? void 0 : _g.blockedInviters) !== null && _h !== void 0 ? _h : [];
        if (blocked.some((b) => b.uid === uid)) {
            throw new https_1.HttpsError('permission-denied', NEUTRAL_SEND_ERROR);
        }
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        // auth/user-not-found — fine, they'll accept once they sign in with that email.
    }
    const dupeSnap = await db
        .collection('invites')
        .where('pid', '==', pid)
        .where('invitedEmail', '==', invitedEmail)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
    if (!dupeSnap.empty)
        throw new https_1.HttpsError('already-exists', 'Already invited');
    await db.collection('invites').add({
        pid,
        projectName: (_j = shared.name) !== null && _j !== void 0 ? _j : 'Project',
        invitedEmail,
        invitedBy: uid,
        invitedByName: (_l = (_k = request.auth.token.name) !== null && _k !== void 0 ? _k : request.auth.token.email) !== null && _l !== void 0 ? _l : 'Someone',
        invitedByEmail: ((_m = request.auth.token.email) !== null && _m !== void 0 ? _m : '').toLowerCase(),
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.acceptInvite = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const myEmail = ((_a = request.auth.token.email) !== null && _a !== void 0 ? _a : '').toLowerCase();
    const { inviteId } = ((_b = request.data) !== null && _b !== void 0 ? _b : {});
    if (!inviteId)
        throw new https_1.HttpsError('invalid-argument', 'inviteId is required');
    const inviteRef = db.doc(`invites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists)
        throw new https_1.HttpsError('not-found', 'Invite not found');
    const invite = inviteSnap.data();
    if (invite.invitedEmail !== myEmail)
        throw new https_1.HttpsError('permission-denied', 'This invite is not for you');
    if (invite.status !== 'pending')
        throw new https_1.HttpsError('failed-precondition', 'Invite already resolved');
    const sharedRef = db.doc(`sharedProjects/${invite.pid}`);
    const sharedSnap = await sharedRef.get();
    if (!sharedSnap.exists) {
        await inviteRef.update({ status: 'revoked' });
        throw new https_1.HttpsError('not-found', 'Project no longer exists');
    }
    const rootSharedId = (_c = sharedSnap.data().rootSharedId) !== null && _c !== void 0 ? _c : invite.pid;
    await updateFamilyMembership(rootSharedId, uid, 'add', {
        name: (_d = request.auth.token.name) !== null && _d !== void 0 ? _d : myEmail,
        email: myEmail,
    });
    await inviteRef.update({ status: 'accepted' });
    return { ok: true, pid: invite.pid };
});
exports.declineInvite = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const myEmail = ((_a = request.auth.token.email) !== null && _a !== void 0 ? _a : '').toLowerCase();
    const { inviteId } = ((_b = request.data) !== null && _b !== void 0 ? _b : {});
    if (!inviteId)
        throw new https_1.HttpsError('invalid-argument', 'inviteId is required');
    const inviteRef = db.doc(`invites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists)
        throw new https_1.HttpsError('not-found', 'Invite not found');
    const invite = inviteSnap.data();
    if (invite.invitedEmail !== myEmail)
        throw new https_1.HttpsError('permission-denied', 'This invite is not for you');
    if (invite.status === 'pending')
        await inviteRef.update({ status: 'declined' });
    return { ok: true };
});
exports.revokeInvite = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { inviteId } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!inviteId)
        throw new https_1.HttpsError('invalid-argument', 'inviteId is required');
    const inviteRef = db.doc(`invites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists)
        throw new https_1.HttpsError('not-found', 'Invite not found');
    const invite = inviteSnap.data();
    if (invite.invitedBy !== uid)
        throw new https_1.HttpsError('permission-denied', 'Only the inviter can revoke');
    if (invite.status === 'pending')
        await inviteRef.update({ status: 'revoked' });
    return { ok: true };
});
/**
 * Blocks the sender of an invite (D11): adds them to the recipient's
 * `blockedInviters` and declines every pending invite from that sender to this
 * recipient — atomically, server-side. Future invites are refused in
 * inviteToProject. Runs as the recipient (invite.invitedEmail must match).
 */
exports.blockInviter = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const myEmail = ((_a = request.auth.token.email) !== null && _a !== void 0 ? _a : '').toLowerCase();
    const { inviteId } = ((_b = request.data) !== null && _b !== void 0 ? _b : {});
    if (!inviteId)
        throw new https_1.HttpsError('invalid-argument', 'inviteId is required');
    const inviteSnap = await db.doc(`invites/${inviteId}`).get();
    if (!inviteSnap.exists)
        throw new https_1.HttpsError('not-found', 'Invite not found');
    const invite = inviteSnap.data();
    if (invite.invitedEmail !== myEmail)
        throw new https_1.HttpsError('permission-denied', 'This invite is not for you');
    const senderUid = invite.invitedBy;
    if (senderUid === uid)
        throw new https_1.HttpsError('failed-precondition', "You can't block yourself");
    // Add to the recipient's block list (dedupe by sender uid).
    const settingsRef = db.doc(`users/${uid}/settings/preferences`);
    const settingsSnap = await settingsRef.get();
    const existing = (_d = (_c = settingsSnap.data()) === null || _c === void 0 ? void 0 : _c.blockedInviters) !== null && _d !== void 0 ? _d : [];
    if (!existing.some((b) => b.uid === senderUid)) {
        await settingsRef.set({
            blockedInviters: admin.firestore.FieldValue.arrayUnion({
                uid: senderUid,
                email: (_e = invite.invitedByEmail) !== null && _e !== void 0 ? _e : '',
                name: (_f = invite.invitedByName) !== null && _f !== void 0 ? _f : 'Someone',
                blockedAt: admin.firestore.Timestamp.now(),
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
exports.leaveProject = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { pid } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!pid)
        throw new https_1.HttpsError('invalid-argument', 'pid is required');
    const sharedSnap = await db.doc(`sharedProjects/${pid}`).get();
    if (!sharedSnap.exists)
        return { ok: true };
    const shared = sharedSnap.data();
    if (shared.ownerUid === uid) {
        throw new https_1.HttpsError('failed-precondition', 'Owner cannot leave — delete the project instead');
    }
    if (!((_b = shared.members) === null || _b === void 0 ? void 0 : _b[uid]))
        return { ok: true };
    await updateFamilyMembership((_c = shared.rootSharedId) !== null && _c !== void 0 ? _c : pid, uid, 'remove');
    return { ok: true };
});
exports.removeMember = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { pid, memberUid } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!pid || !memberUid)
        throw new https_1.HttpsError('invalid-argument', 'pid and memberUid are required');
    const sharedSnap = await db.doc(`sharedProjects/${pid}`).get();
    if (!sharedSnap.exists)
        throw new https_1.HttpsError('not-found', 'Project not found');
    const shared = sharedSnap.data();
    if (shared.ownerUid !== uid)
        throw new https_1.HttpsError('permission-denied', 'Only the owner can remove members');
    if (memberUid === shared.ownerUid)
        throw new https_1.HttpsError('failed-precondition', 'Cannot remove the owner');
    await updateFamilyMembership((_b = shared.rootSharedId) !== null && _b !== void 0 ? _b : pid, memberUid, 'remove');
    return { ok: true };
});
exports.unshareProject = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { pid } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!pid)
        throw new https_1.HttpsError('invalid-argument', 'pid is required');
    const rootSnap = await db.doc(`sharedProjects/${pid}`).get();
    if (!rootSnap.exists)
        throw new https_1.HttpsError('not-found', 'Project not found');
    const root = rootSnap.data();
    if (root.ownerUid !== uid)
        throw new https_1.HttpsError('permission-denied', 'Only the owner can unshare');
    if (root.rootSharedId !== pid)
        throw new https_1.HttpsError('failed-precondition', 'Unshare from the root project');
    await deleteSharedProjectFamily(uid, pid, { restoreToPersonal: true });
    const invitesSnap = await db.collection('invites').where('pid', '==', pid).where('status', '==', 'pending').get();
    await Promise.all(invitesSnap.docs.map((d) => d.ref.update({ status: 'revoked' })));
    return { ok: true };
});
exports.deleteSharedProject = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { pid } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!pid)
        throw new https_1.HttpsError('invalid-argument', 'pid is required');
    const rootSnap = await db.doc(`sharedProjects/${pid}`).get();
    if (!rootSnap.exists)
        return { ok: true };
    const root = rootSnap.data();
    if (root.ownerUid !== uid)
        throw new https_1.HttpsError('permission-denied', 'Only the owner can delete');
    await deleteSharedProjectFamily(uid, (_b = root.rootSharedId) !== null && _b !== void 0 ? _b : pid, { restoreToPersonal: false });
    const invitesSnap = await db.collection('invites').where('pid', '==', pid).where('status', '==', 'pending').get();
    await Promise.all(invitesSnap.docs.map((d) => d.ref.update({ status: 'revoked' })));
    return { ok: true };
});
/** Called from the client's account-erase flow (userDataRegistry). */
exports.eraseMySharedProjectData = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const myEmail = ((_a = request.auth.token.email) !== null && _a !== void 0 ? _a : '').toLowerCase();
    // 1. Projects this user owns: cascade-delete for everyone (D8).
    const ownedSnap = await db.collection('sharedProjects').where('ownerUid', '==', uid).get();
    const ownedRootIds = new Set(ownedSnap.docs.filter((d) => d.data().rootSharedId === d.id).map((d) => d.id));
    for (const rootId of ownedRootIds) {
        await deleteSharedProjectFamily(uid, rootId, { restoreToPersonal: false });
    }
    // 2. Memberships in projects owned by others: leave (their data isn't touched).
    const memberSnap = await db.collection('sharedProjects').where(`members.${uid}`, '==', true).get();
    const foreignRootIds = new Set(memberSnap.docs.filter((d) => d.data().ownerUid !== uid).map((d) => { var _a; return (_a = d.data().rootSharedId) !== null && _a !== void 0 ? _a : d.id; }));
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
async function recomputeSharedProjectCounts(pid, depth = 0) {
    if (depth > 3)
        return; // safety guard against runaway recursion (mirrors client recomputeGroupCounts)
    const projectRef = db.doc(`sharedProjects/${pid}`);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists)
        return;
    const todosSnap = await db.collection(`sharedProjects/${pid}/todos`).get();
    const items = todosSnap.docs.map((d) => d.data());
    const childCount = items.length;
    const doneCount = items.filter((t) => t.status === 'done' || t.status === 'skipped').length;
    const totalSpent = items.reduce((sum, t) => { var _a; return sum + (t.todoType === 'shopping-item' ? ((_a = t.price) !== null && _a !== void 0 ? _a : 0) : 0); }, 0);
    const subSnap = await db.collection('sharedProjects').where('parentGroupId', '==', pid).get();
    const subGroups = subSnap.docs.map((d) => d.data());
    const allSubsDone = subGroups.length === 0 || subGroups.every((sg) => sg.completed);
    const totalItems = childCount + subGroups.length;
    const allTodosDone = childCount === 0 || doneCount === childCount;
    const completed = totalItems > 0 && allTodosDone && allSubsDone;
    const payload = { childCount, doneCount, totalSpent, completed };
    if (completed)
        payload.completedAt = admin.firestore.FieldValue.serverTimestamp();
    await projectRef.update(payload);
    const parentGroupId = projectSnap.data().parentGroupId;
    if (parentGroupId)
        await recomputeSharedProjectCounts(parentGroupId, depth + 1);
}
exports.onSharedTaskWrite = (0, firestore_1.onDocumentWritten)('sharedProjects/{pid}/todos/{tid}', async (event) => {
    await recomputeSharedProjectCounts(event.params.pid);
});
// ─── Presence cleanup (docs/SHAREABLE_PROJECTS_SPEC.md D9) ─────────────────────
// `onDisconnect().remove()` clears a user's presence when their tab closes
// cleanly, but a hard crash / lost connection can orphan an entry. This sweep is
// the backstop: it prunes any presence node whose heartbeat is older than the
// staleness window, and removes now-empty project buckets, so RTDB never
// accumulates stale data (keeps it effectively empty when nobody is active).
const PRESENCE_STALE_MS = 2 * 60 * 1000;
exports.prunePresence = (0, scheduler_1.onSchedule)('every 5 minutes', async () => {
    var _a;
    const rtdb = admin.database();
    const rootRef = rtdb.ref('presence');
    const snap = await rootRef.get();
    if (!snap.exists())
        return;
    const now = Date.now();
    const updates = {};
    const projects = (_a = snap.val()) !== null && _a !== void 0 ? _a : {};
    for (const [pid, entries] of Object.entries(projects)) {
        let liveInBucket = 0;
        for (const [uid, entry] of Object.entries(entries !== null && entries !== void 0 ? entries : {})) {
            const at = typeof (entry === null || entry === void 0 ? void 0 : entry.at) === 'number' ? entry.at : 0;
            if (now - at > PRESENCE_STALE_MS) {
                updates[`${pid}/${uid}`] = null; // prune stale entry
            }
            else {
                liveInBucket += 1;
            }
        }
        if (liveInBucket === 0)
            updates[pid] = null; // drop the empty project bucket
    }
    if (Object.keys(updates).length > 0)
        await rootRef.update(updates);
});
//# sourceMappingURL=index.js.map