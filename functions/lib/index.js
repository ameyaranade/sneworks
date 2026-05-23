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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReminders = void 0;
// sneworks — push notification scheduler
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
admin.initializeApp();
const db = admin.firestore();
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
        })());
    }
    await Promise.allSettled(perUserTasks);
});
//# sourceMappingURL=index.js.map