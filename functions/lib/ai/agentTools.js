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
exports.executeProposedAction = executeProposedAction;
exports.buildAgentTools = buildAgentTools;
// agentTools.ts — Admin-SDK-backed tool surface for the in-app chat agent.
//
// Every tool operates on the SIGNED-IN user's own tree (users/{uid}/…), so `uid`
// is bound at construction time and can never be supplied by the model. The tools
// here are Phase 1 only: reads + low-risk writes that auto-execute. Destructive
// tools (delete / bulk) are deferred to Phase 2 behind the propose→approve gate
// (docs/ASSISTANT_AGENT_DEV_PLAN.md), so nothing here deletes user data.
//
// Collections match the live client tree (userDataRegistry.ts): users/{uid}/todos,
// users/{uid}/logs, users/{uid}/groups. Every grouped write recomputes counts.
const admin = __importStar(require("firebase-admin"));
const json_schema_1 = require("@anthropic-ai/sdk/helpers/beta/json-schema");
const { Timestamp, FieldValue } = admin.firestore;
// ─── Helpers ─────────────────────────────────────────────────────────────────────
/** Firestore rejects `undefined` field values — strip them before writing. */
function stripUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
/** Parse an ISO date/datetime string to a Timestamp; throws on invalid input. */
function parseTimestamp(iso) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms))
        throw new Error(`Not a valid date: "${iso}". Use ISO format like 2026-08-17 or 2026-08-17T09:00.`);
    return Timestamp.fromMillis(ms);
}
function tsToIso(v) {
    if (v instanceof Timestamp)
        return v.toDate().toISOString();
    return undefined;
}
/**
 * Reads all todos + sub-groups for a group and updates its counts, propagating up
 * to parent groups for nested projects. Admin-SDK port of
 * src/firebase/groupQueries.ts:recomputeGroupCounts (same semantics, max depth 3).
 */
async function recomputeGroupCounts(db, uid, groupId, depth = 0) {
    var _a;
    if (depth > 3)
        return; // guard against runaway recursion
    const todosSnap = await db.collection(`users/${uid}/todos`).where('groupId', '==', groupId).get();
    const items = todosSnap.docs.map((d) => d.data());
    const childCount = items.length;
    const doneCount = items.filter((t) => t.status === 'done' || t.status === 'skipped').length;
    const totalSpent = items.reduce((sum, t) => { var _a; return sum + (t.todoType === 'shopping-item' ? ((_a = t.price) !== null && _a !== void 0 ? _a : 0) : 0); }, 0);
    const subSnap = await db.collection(`users/${uid}/groups`).where('parentGroupId', '==', groupId).get();
    const subGroups = subSnap.docs.map((d) => d.data());
    const allSubsDone = subGroups.length === 0 || subGroups.every((sg) => sg.completed);
    const totalItems = childCount + subGroups.length;
    const allTodosDone = childCount === 0 || doneCount === childCount;
    const completed = totalItems > 0 && allTodosDone && allSubsDone;
    const payload = { childCount, doneCount, totalSpent, completed, updatedAt: FieldValue.serverTimestamp() };
    if (completed)
        payload.completedAt = Timestamp.now();
    const groupRef = db.doc(`users/${uid}/groups/${groupId}`);
    await groupRef.update(payload);
    const parentGroupId = (_a = (await groupRef.get()).data()) === null || _a === void 0 ? void 0 : _a.parentGroupId;
    if (parentGroupId)
        await recomputeGroupCounts(db, uid, parentGroupId, depth + 1);
}
// ─── Destructive executors (run ONLY after user approval, from resumeAgent) ──────
// The high-risk tools in buildAgentTools never mutate — they only write a
// proposedActions doc. resumeAgent calls executeProposedAction once the user
// approves, which dispatches to these. Each is idempotent-safe (missing target →
// benign message) so an at-least-once redelivery can't corrupt data.
async function deleteTodoExec(db, uid, todoId) {
    var _a, _b, _c;
    const ref = db.doc(`users/${uid}/todos/${todoId}`);
    const snap = await ref.get();
    if (!snap.exists)
        return 'That todo no longer exists.';
    const title = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : todoId;
    const groupId = (_c = snap.data()) === null || _c === void 0 ? void 0 : _c.groupId;
    await ref.delete();
    if (groupId)
        await recomputeGroupCounts(db, uid, groupId);
    return `Deleted "${title}".`;
}
async function deleteGroupExec(db, uid, groupId) {
    var _a, _b, _c;
    const groupRef = db.doc(`users/${uid}/groups/${groupId}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists)
        return 'That list/project no longer exists.';
    const name = (_b = (_a = groupSnap.data()) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : groupId;
    const parentGroupId = (_c = groupSnap.data()) === null || _c === void 0 ? void 0 : _c.parentGroupId;
    // Cascade-delete every todo in the group (batched, no status filter).
    const todosSnap = await db.collection(`users/${uid}/todos`).where('groupId', '==', groupId).get();
    let batch = db.batch();
    let pending = 0;
    for (const d of todosSnap.docs) {
        batch.delete(d.ref);
        if (++pending === 450) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    }
    if (pending > 0)
        await batch.commit();
    await groupRef.delete();
    if (parentGroupId)
        await recomputeGroupCounts(db, uid, parentGroupId);
    return `Deleted "${name}" and its ${todosSnap.size} item${todosSnap.size === 1 ? '' : 's'}.`;
}
/** Dispatches an approved proposal to its executor. Called by resumeAgent only. */
async function executeProposedAction(uid, tool, args) {
    const db = admin.firestore();
    switch (tool) {
        case 'delete_todo': return deleteTodoExec(db, uid, String(args.todoId));
        case 'delete_group': return deleteGroupExec(db, uid, String(args.groupId));
        default: throw new Error(`Unknown proposed action: ${tool}`);
    }
}
// ─── Tool factory ─────────────────────────────────────────────────────────────
/**
 * Builds the agent's tool set bound to one user + chat session. `activityLog`
 * accumulates a chip per call. Read + low-risk-write tools execute immediately;
 * the destructive tools (delete_*) only PROPOSE — they write a `proposedActions`
 * doc and push to `pendingProposals`, and never mutate until resumeAgent runs the
 * executor after the user approves (Phase 2 gate).
 */
function buildAgentTools(uid, sid, activityLog, pendingProposals) {
    const db = admin.firestore();
    const log = (tool, summary, status = 'ok') => {
        activityLog.push({ tool, summary, status });
    };
    const todosCol = () => db.collection(`users/${uid}/todos`);
    const logsCol = () => db.collection(`users/${uid}/logs`);
    const groupsCol = () => db.collection(`users/${uid}/groups`);
    const proposalsCol = () => db.collection(`users/${uid}/chatSessions/${sid}/proposedActions`);
    // Records a destructive proposal (approval card) instead of executing. Returns
    // the tool_result the model sees — a firm instruction to stop and await approval.
    const propose = async (tool, summary, args) => {
        await proposalsCol().add({ tool, summary, args, status: 'pending', createdAt: FieldValue.serverTimestamp() });
        pendingProposals.push({ tool, summary, args });
        log(tool, `Needs approval: ${summary}`);
        return ('PROPOSED — NOT executed. This is a destructive action requiring the user\'s explicit ' +
            'approval; an approval card is now shown to them. Do NOT retry, do NOT call other tools. ' +
            'End your turn with one short line telling the user you\'ve asked them to confirm.');
    };
    return [
        // ── Reads ────────────────────────────────────────────────────────────────
        (0, json_schema_1.betaTool)({
            name: 'list_todos',
            description: 'List the user\'s todos. Optionally filter by status, group, or scope ' +
                '("overdue" = due before today, "today" = due today or undated, "all" = everything). ' +
                'Returns id, title, todoType, status, dueAt, groupId, amount.',
            inputSchema: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'done', 'skipped', 'deferred'], description: 'Only todos with this status.' },
                    groupId: { type: 'string', description: 'Only todos in this group/list/project.' },
                    scope: { type: 'string', enum: ['overdue', 'today', 'all'], description: 'Time scope. Defaults to "all".' },
                },
                additionalProperties: false,
            },
            run: async (args) => {
                try {
                    const snap = await todosCol().get();
                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);
                    const endOfToday = new Date();
                    endOfToday.setHours(23, 59, 59, 999);
                    const rows = snap.docs
                        .map((d) => (Object.assign({ id: d.id }, d.data())))
                        .filter((t) => {
                        if (args.status && t.status !== args.status)
                            return false;
                        if (args.groupId && t.groupId !== args.groupId)
                            return false;
                        const dueMs = t.dueAt instanceof Timestamp ? t.dueAt.toMillis() : null;
                        if (args.scope === 'overdue')
                            return dueMs !== null && dueMs < startOfToday.getTime();
                        if (args.scope === 'today')
                            return dueMs === null || (dueMs >= startOfToday.getTime() && dueMs <= endOfToday.getTime());
                        return true;
                    })
                        .map((t) => ({
                        id: t.id,
                        title: t.title,
                        todoType: t.todoType,
                        status: t.status,
                        dueAt: tsToIso(t.dueAt),
                        groupId: t.groupId,
                        amount: t.amount,
                    }));
                    log('list_todos', `Found ${rows.length} todo${rows.length === 1 ? '' : 's'}`);
                    return JSON.stringify(rows);
                }
                catch (e) {
                    log('list_todos', 'Failed to list todos', 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'list_groups',
            description: 'List the user\'s groups (shopping lists, projects, routines, recurring todos). ' +
                'Optionally filter by groupKind. Returns id, name, groupKind, childCount, doneCount, completed.',
            inputSchema: {
                type: 'object',
                properties: {
                    groupKind: { type: 'string', enum: ['shopping-list', 'project', 'routine', 'recurring-todo'], description: 'Only groups of this kind.' },
                },
                additionalProperties: false,
            },
            run: async (args) => {
                try {
                    const snap = await groupsCol().get();
                    const rows = snap.docs
                        .map((d) => (Object.assign({ id: d.id }, d.data())))
                        .filter((g) => !args.groupKind || g.groupKind === args.groupKind)
                        .map((g) => ({
                        id: g.id,
                        name: g.name,
                        groupKind: g.groupKind,
                        childCount: g.childCount,
                        doneCount: g.doneCount,
                        completed: g.completed,
                        archived: g.archivedAt instanceof Timestamp,
                    }));
                    log('list_groups', `Found ${rows.length} group${rows.length === 1 ? '' : 's'}`);
                    return JSON.stringify(rows);
                }
                catch (e) {
                    log('list_groups', 'Failed to list groups', 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'list_logs',
            description: 'List the user\'s recent logs (expenses, income, notes, health). Optionally filter by logType and limit. ' +
                'Returns id, title, logType, amount, occurredAt.',
            inputSchema: {
                type: 'object',
                properties: {
                    logType: { type: 'string', enum: ['expense', 'income', 'generic-note', 'health-log'], description: 'Only logs of this type.' },
                    limit: { type: 'number', description: 'Max rows to return (default 50).' },
                },
                additionalProperties: false,
            },
            run: async (args) => {
                var _a;
                try {
                    const snap = await logsCol().get();
                    const rows = snap.docs
                        .map((d) => (Object.assign({ id: d.id }, d.data())))
                        .filter((l) => !args.logType || l.logType === args.logType)
                        .sort((a, b) => {
                        const am = a.occurredAt instanceof Timestamp ? a.occurredAt.toMillis() : 0;
                        const bm = b.occurredAt instanceof Timestamp ? b.occurredAt.toMillis() : 0;
                        return bm - am;
                    })
                        .slice(0, (_a = args.limit) !== null && _a !== void 0 ? _a : 50)
                        .map((l) => ({ id: l.id, title: l.title, logType: l.logType, amount: l.amount, occurredAt: tsToIso(l.occurredAt) }));
                    log('list_logs', `Found ${rows.length} log${rows.length === 1 ? '' : 's'}`);
                    return JSON.stringify(rows);
                }
                catch (e) {
                    log('list_logs', 'Failed to list logs', 'error');
                    throw e;
                }
            },
        }),
        // ── Low-risk writes ──────────────────────────────────────────────────────
        (0, json_schema_1.betaTool)({
            name: 'create_todo',
            description: 'Create a new todo. todoType is "generic-task" (default), "money-reminder" (has amount/category), ' +
                'or "shopping-item". dueAt is an optional ISO date/datetime. groupId optionally files it in a list/project. ' +
                'Confirm details with the user before creating anything ambiguous.',
            inputSchema: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Short title for the todo.' },
                    todoType: { type: 'string', enum: ['generic-task', 'money-reminder', 'shopping-item'], description: 'Defaults to generic-task.' },
                    notes: { type: 'string' },
                    dueAt: { type: 'string', description: 'ISO date/datetime, e.g. 2026-08-20 or 2026-08-20T09:00.' },
                    groupId: { type: 'string', description: 'Group/list/project to file this under.' },
                    amount: { type: 'number', description: 'money-reminder only.' },
                    category: { type: 'string', description: 'money-reminder only.' },
                },
                required: ['title'],
                additionalProperties: false,
            },
            run: async (args) => {
                var _a;
                try {
                    const doc = stripUndefined({
                        todoType: (_a = args.todoType) !== null && _a !== void 0 ? _a : 'generic-task',
                        title: args.title,
                        notes: args.notes,
                        status: 'pending',
                        groupId: args.groupId,
                        dueAt: args.dueAt ? parseTimestamp(args.dueAt) : undefined,
                        amount: args.amount,
                        category: args.category,
                        sortOrder: Date.now(),
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    const ref = await todosCol().add(doc);
                    if (args.groupId)
                        await recomputeGroupCounts(db, uid, args.groupId);
                    log('create_todo', `Created todo "${args.title}"`);
                    return JSON.stringify({ id: ref.id, ok: true });
                }
                catch (e) {
                    log('create_todo', `Failed to create todo "${args.title}"`, 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'create_generic_group',
            description: 'Create a new shopping list or project. groupKind is "shopping-list" or "project". ' +
                'Use this before filing todos into a brand-new list/project.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    groupKind: { type: 'string', enum: ['shopping-list', 'project'] },
                    description: { type: 'string' },
                },
                required: ['name', 'groupKind'],
                additionalProperties: false,
            },
            run: async (args) => {
                try {
                    const base = {
                        groupKind: args.groupKind,
                        name: args.name,
                        description: args.description,
                        ancestorPath: [],
                        showProgress: true,
                        showSumMoney: false,
                        childCount: 0,
                        doneCount: 0,
                        completed: false,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    };
                    const extra = args.groupKind === 'shopping-list'
                        ? { priceTrackingEnabled: false, totalSpent: 0 }
                        : {};
                    const ref = await groupsCol().add(stripUndefined(Object.assign(Object.assign({}, base), extra)));
                    log('create_generic_group', `Created ${args.groupKind} "${args.name}"`);
                    return JSON.stringify({ id: ref.id, ok: true });
                }
                catch (e) {
                    log('create_generic_group', `Failed to create "${args.name}"`, 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'create_log',
            description: 'Record a log entry. logType is "expense" (amount + spentOn), "income" (amount + source), ' +
                'or "generic-note" (noteCategory). occurredAt defaults to now.',
            inputSchema: {
                type: 'object',
                properties: {
                    logType: { type: 'string', enum: ['expense', 'income', 'generic-note'] },
                    title: { type: 'string' },
                    amount: { type: 'number', description: 'expense/income only.' },
                    spentOn: { type: 'string', description: 'expense only.' },
                    source: { type: 'string', description: 'income only.' },
                    noteCategory: { type: 'string', description: 'generic-note only.' },
                    notes: { type: 'string' },
                    occurredAt: { type: 'string', description: 'ISO date/datetime; defaults to now.' },
                },
                required: ['logType', 'title'],
                additionalProperties: false,
            },
            run: async (args) => {
                try {
                    const doc = stripUndefined({
                        logType: args.logType,
                        title: args.title,
                        notes: args.notes,
                        amount: args.amount,
                        spentOn: args.spentOn,
                        source: args.source,
                        noteCategory: args.noteCategory,
                        occurredAt: args.occurredAt ? parseTimestamp(args.occurredAt) : Timestamp.now(),
                        sortOrder: Date.now(),
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    const ref = await logsCol().add(doc);
                    log('create_log', `Logged "${args.title}"`);
                    return JSON.stringify({ id: ref.id, ok: true });
                }
                catch (e) {
                    log('create_log', `Failed to log "${args.title}"`, 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'update_todo',
            description: 'Update fields on an existing todo by id: title, notes, dueAt (ISO), status, or groupId. ' +
                'Only pass the fields you want to change.',
            inputSchema: {
                type: 'object',
                properties: {
                    todoId: { type: 'string' },
                    title: { type: 'string' },
                    notes: { type: 'string' },
                    dueAt: { type: 'string', description: 'ISO date/datetime.' },
                    status: { type: 'string', enum: ['pending', 'done', 'skipped', 'deferred'] },
                    groupId: { type: 'string' },
                },
                required: ['todoId'],
                additionalProperties: false,
            },
            run: async (args) => {
                var _a;
                try {
                    const ref = todosCol().doc(args.todoId);
                    const before = await ref.get();
                    if (!before.exists)
                        throw new Error(`No todo with id ${args.todoId}`);
                    const payload = stripUndefined({
                        title: args.title,
                        notes: args.notes,
                        dueAt: args.dueAt ? parseTimestamp(args.dueAt) : undefined,
                        status: args.status,
                        groupId: args.groupId,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    await ref.update(payload);
                    const beforeGroup = (_a = before.data()) === null || _a === void 0 ? void 0 : _a.groupId;
                    const groupsToRecompute = new Set([beforeGroup, args.groupId].filter(Boolean));
                    for (const gid of groupsToRecompute)
                        await recomputeGroupCounts(db, uid, gid);
                    log('update_todo', `Updated todo ${args.todoId}`);
                    return JSON.stringify({ ok: true });
                }
                catch (e) {
                    log('update_todo', `Failed to update todo ${args.todoId}`, 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'complete_todo',
            description: 'Mark a todo as done. Records completedAt and updates the parent group\'s progress.',
            inputSchema: {
                type: 'object',
                properties: { todoId: { type: 'string' } },
                required: ['todoId'],
                additionalProperties: false,
            },
            run: async (args) => {
                var _a, _b, _c;
                try {
                    const ref = todosCol().doc(args.todoId);
                    const snap = await ref.get();
                    if (!snap.exists)
                        throw new Error(`No todo with id ${args.todoId}`);
                    await ref.update({ status: 'done', completedAt: Timestamp.now(), updatedAt: FieldValue.serverTimestamp() });
                    const groupId = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.groupId;
                    if (groupId)
                        await recomputeGroupCounts(db, uid, groupId);
                    log('complete_todo', `Completed "${(_c = (_b = snap.data()) === null || _b === void 0 ? void 0 : _b.title) !== null && _c !== void 0 ? _c : args.todoId}"`);
                    return JSON.stringify({ ok: true });
                }
                catch (e) {
                    log('complete_todo', `Failed to complete todo ${args.todoId}`, 'error');
                    throw e;
                }
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'defer_todo',
            description: 'Defer a todo to a new due date/time. dueAt is a required ISO date/datetime; sets status to deferred.',
            inputSchema: {
                type: 'object',
                properties: {
                    todoId: { type: 'string' },
                    dueAt: { type: 'string', description: 'ISO date/datetime to defer to.' },
                },
                required: ['todoId', 'dueAt'],
                additionalProperties: false,
            },
            run: async (args) => {
                var _a, _b;
                try {
                    const ref = todosCol().doc(args.todoId);
                    const snap = await ref.get();
                    if (!snap.exists)
                        throw new Error(`No todo with id ${args.todoId}`);
                    await ref.update({ dueAt: parseTimestamp(args.dueAt), status: 'deferred', updatedAt: FieldValue.serverTimestamp() });
                    log('defer_todo', `Deferred "${(_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : args.todoId}" to ${args.dueAt}`);
                    return JSON.stringify({ ok: true });
                }
                catch (e) {
                    log('defer_todo', `Failed to defer todo ${args.todoId}`, 'error');
                    throw e;
                }
            },
        }),
        // ── Destructive (high-risk) — PROPOSE only; executed after user approval ──
        (0, json_schema_1.betaTool)({
            name: 'delete_todo',
            description: 'Permanently delete a todo. DESTRUCTIVE: this does NOT delete immediately — it asks the ' +
                'user to approve first via a confirmation card. Call it only when the user clearly asks to ' +
                'delete or remove a specific todo.',
            inputSchema: {
                type: 'object',
                properties: { todoId: { type: 'string' } },
                required: ['todoId'],
                additionalProperties: false,
            },
            run: async (args) => {
                var _a, _b;
                const snap = await todosCol().doc(args.todoId).get();
                if (!snap.exists)
                    throw new Error(`No todo with id ${args.todoId}`);
                return propose('delete_todo', `Delete todo "${(_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : args.todoId}"`, { todoId: args.todoId });
            },
        }),
        (0, json_schema_1.betaTool)({
            name: 'delete_group',
            description: 'Permanently delete a shopping list or project INCLUDING all its items. DESTRUCTIVE: does ' +
                'NOT delete immediately — it asks the user to approve first. Call it only when the user ' +
                'clearly asks to delete or remove a specific list/project.',
            inputSchema: {
                type: 'object',
                properties: { groupId: { type: 'string' } },
                required: ['groupId'],
                additionalProperties: false,
            },
            run: async (args) => {
                var _a, _b;
                const snap = await groupsCol().doc(args.groupId).get();
                if (!snap.exists)
                    throw new Error(`No group with id ${args.groupId}`);
                const count = (await todosCol().where('groupId', '==', args.groupId).get()).size;
                return propose('delete_group', `Delete "${(_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : args.groupId}" and its ${count} item${count === 1 ? '' : 's'}`, { groupId: args.groupId });
            },
        }),
    ];
}
//# sourceMappingURL=agentTools.js.map