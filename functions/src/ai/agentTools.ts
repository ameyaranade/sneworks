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
import * as admin from 'firebase-admin';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

type Firestore = admin.firestore.Firestore;
const { Timestamp, FieldValue } = admin.firestore;

/** A Firestore doc row: its id plus arbitrary data fields (index-signature access). */
type DocRow = { id: string } & Record<string, unknown>;

// ─── Activity log ──────────────────────────────────────────────────────────────
// buildAgentTools pushes one entry per tool invocation; assistantAgent persists it
// on the assistant message as toolActivity so the UI can render tool chips.
export interface ToolActivity {
  tool: string;
  summary: string;
  status: 'ok' | 'error';
}

/** A destructive action the agent proposed this turn (Phase 2 approval gate). */
export interface PendingProposal {
  tool: string;
  summary: string;
  args: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/** Firestore rejects `undefined` field values — strip them before writing. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Parse an ISO date/datetime string to a Timestamp; throws on invalid input. */
function parseTimestamp(iso: string): admin.firestore.Timestamp {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Not a valid date: "${iso}". Use ISO format like 2026-08-17 or 2026-08-17T09:00.`);
  return Timestamp.fromMillis(ms);
}

function tsToIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return undefined;
}

/**
 * Reads all todos + sub-groups for a group and updates its counts, propagating up
 * to parent groups for nested projects. Admin-SDK port of
 * src/firebase/groupQueries.ts:recomputeGroupCounts (same semantics, max depth 3).
 */
async function recomputeGroupCounts(db: Firestore, uid: string, groupId: string, depth = 0): Promise<void> {
  if (depth > 3) return; // guard against runaway recursion

  const todosSnap = await db.collection(`users/${uid}/todos`).where('groupId', '==', groupId).get();
  const items = todosSnap.docs.map((d) => d.data() as { status?: string; todoType?: string; price?: number });
  const childCount = items.length;
  const doneCount = items.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  const totalSpent = items.reduce((sum, t) => sum + (t.todoType === 'shopping-item' ? (t.price ?? 0) : 0), 0);

  const subSnap = await db.collection(`users/${uid}/groups`).where('parentGroupId', '==', groupId).get();
  const subGroups = subSnap.docs.map((d) => d.data() as { completed?: boolean });
  const allSubsDone = subGroups.length === 0 || subGroups.every((sg) => sg.completed);
  const totalItems = childCount + subGroups.length;
  const allTodosDone = childCount === 0 || doneCount === childCount;
  const completed = totalItems > 0 && allTodosDone && allSubsDone;

  const payload: Record<string, unknown> = { childCount, doneCount, totalSpent, completed, updatedAt: FieldValue.serverTimestamp() };
  if (completed) payload.completedAt = Timestamp.now();

  const groupRef = db.doc(`users/${uid}/groups/${groupId}`);
  await groupRef.update(payload);

  const parentGroupId = (await groupRef.get()).data()?.parentGroupId as string | undefined;
  if (parentGroupId) await recomputeGroupCounts(db, uid, parentGroupId, depth + 1);
}

// ─── Destructive executors (run ONLY after user approval, from resumeAgent) ──────
// The high-risk tools in buildAgentTools never mutate — they only write a
// proposedActions doc. resumeAgent calls executeProposedAction once the user
// approves, which dispatches to these. Each is idempotent-safe (missing target →
// benign message) so an at-least-once redelivery can't corrupt data.

async function deleteTodoExec(db: Firestore, uid: string, todoId: string): Promise<string> {
  const ref = db.doc(`users/${uid}/todos/${todoId}`);
  const snap = await ref.get();
  if (!snap.exists) return 'That todo no longer exists.';
  const title = (snap.data()?.title as string) ?? todoId;
  const groupId = snap.data()?.groupId as string | undefined;
  await ref.delete();
  if (groupId) await recomputeGroupCounts(db, uid, groupId);
  return `Deleted "${title}".`;
}

async function deleteGroupExec(db: Firestore, uid: string, groupId: string): Promise<string> {
  const groupRef = db.doc(`users/${uid}/groups/${groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) return 'That list/project no longer exists.';
  const name = (groupSnap.data()?.name as string) ?? groupId;
  const parentGroupId = groupSnap.data()?.parentGroupId as string | undefined;

  // Cascade-delete every todo in the group (batched, no status filter).
  const todosSnap = await db.collection(`users/${uid}/todos`).where('groupId', '==', groupId).get();
  let batch = db.batch();
  let pending = 0;
  for (const d of todosSnap.docs) {
    batch.delete(d.ref);
    if (++pending === 450) { await batch.commit(); batch = db.batch(); pending = 0; }
  }
  if (pending > 0) await batch.commit();

  await groupRef.delete();
  if (parentGroupId) await recomputeGroupCounts(db, uid, parentGroupId);
  return `Deleted "${name}" and its ${todosSnap.size} item${todosSnap.size === 1 ? '' : 's'}.`;
}

/** Dispatches an approved proposal to its executor. Called by resumeAgent only. */
export async function executeProposedAction(uid: string, tool: string, args: Record<string, unknown>): Promise<string> {
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
export function buildAgentTools(
  uid: string,
  sid: string,
  activityLog: ToolActivity[],
  pendingProposals: PendingProposal[],
) {
  const db = admin.firestore();

  const log = (tool: string, summary: string, status: 'ok' | 'error' = 'ok') => {
    activityLog.push({ tool, summary, status });
  };

  const todosCol = () => db.collection(`users/${uid}/todos`);
  const logsCol = () => db.collection(`users/${uid}/logs`);
  const groupsCol = () => db.collection(`users/${uid}/groups`);
  const proposalsCol = () => db.collection(`users/${uid}/chatSessions/${sid}/proposedActions`);

  // Records a destructive proposal (approval card) instead of executing. Returns
  // the tool_result the model sees — a firm instruction to stop and await approval.
  const propose = async (tool: string, summary: string, args: Record<string, unknown>): Promise<string> => {
    await proposalsCol().add({ tool, summary, args, status: 'pending', createdAt: FieldValue.serverTimestamp() });
    pendingProposals.push({ tool, summary, args });
    log(tool, `Needs approval: ${summary}`);
    return (
      'PROPOSED — NOT executed. This is a destructive action requiring the user\'s explicit ' +
      'approval; an approval card is now shown to them. Do NOT retry, do NOT call other tools. ' +
      'End your turn with one short line telling the user you\'ve asked them to confirm.'
    );
  };

  return [
    // ── Reads ────────────────────────────────────────────────────────────────
    betaTool({
      name: 'list_todos',
      description:
        'List the user\'s todos. Optionally filter by status, group, or scope ' +
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
          const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as DocRow))
            .filter((t) => {
              if (args.status && t.status !== args.status) return false;
              if (args.groupId && t.groupId !== args.groupId) return false;
              const dueMs = t.dueAt instanceof Timestamp ? t.dueAt.toMillis() : null;
              if (args.scope === 'overdue') return dueMs !== null && dueMs < startOfToday.getTime();
              if (args.scope === 'today') return dueMs === null || (dueMs >= startOfToday.getTime() && dueMs <= endOfToday.getTime());
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
        } catch (e) {
          log('list_todos', 'Failed to list todos', 'error');
          throw e;
        }
      },
    }),

    betaTool({
      name: 'list_groups',
      description:
        'List the user\'s groups (shopping lists, projects, routines, recurring todos). ' +
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
            .map((d) => ({ id: d.id, ...d.data() } as DocRow))
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
        } catch (e) {
          log('list_groups', 'Failed to list groups', 'error');
          throw e;
        }
      },
    }),

    betaTool({
      name: 'list_logs',
      description:
        'List the user\'s recent logs (expenses, income, notes, health). Optionally filter by logType and limit. ' +
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
        try {
          const snap = await logsCol().get();
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as DocRow))
            .filter((l) => !args.logType || l.logType === args.logType)
            .sort((a, b) => {
              const am = a.occurredAt instanceof Timestamp ? a.occurredAt.toMillis() : 0;
              const bm = b.occurredAt instanceof Timestamp ? b.occurredAt.toMillis() : 0;
              return bm - am;
            })
            .slice(0, args.limit ?? 50)
            .map((l) => ({ id: l.id, title: l.title, logType: l.logType, amount: l.amount, occurredAt: tsToIso(l.occurredAt) }));
          log('list_logs', `Found ${rows.length} log${rows.length === 1 ? '' : 's'}`);
          return JSON.stringify(rows);
        } catch (e) {
          log('list_logs', 'Failed to list logs', 'error');
          throw e;
        }
      },
    }),

    // ── Low-risk writes ──────────────────────────────────────────────────────
    betaTool({
      name: 'create_todo',
      description:
        'Create a new todo. todoType is "generic-task" (default), "money-reminder" (has amount/category), ' +
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
        try {
          const doc: Record<string, unknown> = stripUndefined({
            todoType: args.todoType ?? 'generic-task',
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
          if (args.groupId) await recomputeGroupCounts(db, uid, args.groupId);
          log('create_todo', `Created todo "${args.title}"`);
          return JSON.stringify({ id: ref.id, ok: true });
        } catch (e) {
          log('create_todo', `Failed to create todo "${args.title}"`, 'error');
          throw e;
        }
      },
    }),

    betaTool({
      name: 'create_generic_group',
      description:
        'Create a new shopping list or project. groupKind is "shopping-list" or "project". ' +
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
          const ref = await groupsCol().add(stripUndefined({ ...base, ...extra }));
          log('create_generic_group', `Created ${args.groupKind} "${args.name}"`);
          return JSON.stringify({ id: ref.id, ok: true });
        } catch (e) {
          log('create_generic_group', `Failed to create "${args.name}"`, 'error');
          throw e;
        }
      },
    }),

    betaTool({
      name: 'create_log',
      description:
        'Record a log entry. logType is "expense" (amount + spentOn), "income" (amount + source), ' +
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
        } catch (e) {
          log('create_log', `Failed to log "${args.title}"`, 'error');
          throw e;
        }
      },
    }),

    betaTool({
      name: 'update_todo',
      description:
        'Update fields on an existing todo by id: title, notes, dueAt (ISO), status, or groupId. ' +
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
        try {
          const ref = todosCol().doc(args.todoId);
          const before = await ref.get();
          if (!before.exists) throw new Error(`No todo with id ${args.todoId}`);
          const payload = stripUndefined({
            title: args.title,
            notes: args.notes,
            dueAt: args.dueAt ? parseTimestamp(args.dueAt) : undefined,
            status: args.status,
            groupId: args.groupId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          await ref.update(payload);
          const beforeGroup = before.data()?.groupId as string | undefined;
          const groupsToRecompute = new Set([beforeGroup, args.groupId].filter(Boolean) as string[]);
          for (const gid of groupsToRecompute) await recomputeGroupCounts(db, uid, gid);
          log('update_todo', `Updated todo ${args.todoId}`);
          return JSON.stringify({ ok: true });
        } catch (e) {
          log('update_todo', `Failed to update todo ${args.todoId}`, 'error');
          throw e;
        }
      },
    }),

    betaTool({
      name: 'complete_todo',
      description: 'Mark a todo as done. Records completedAt and updates the parent group\'s progress.',
      inputSchema: {
        type: 'object',
        properties: { todoId: { type: 'string' } },
        required: ['todoId'],
        additionalProperties: false,
      },
      run: async (args) => {
        try {
          const ref = todosCol().doc(args.todoId);
          const snap = await ref.get();
          if (!snap.exists) throw new Error(`No todo with id ${args.todoId}`);
          await ref.update({ status: 'done', completedAt: Timestamp.now(), updatedAt: FieldValue.serverTimestamp() });
          const groupId = snap.data()?.groupId as string | undefined;
          if (groupId) await recomputeGroupCounts(db, uid, groupId);
          log('complete_todo', `Completed "${snap.data()?.title ?? args.todoId}"`);
          return JSON.stringify({ ok: true });
        } catch (e) {
          log('complete_todo', `Failed to complete todo ${args.todoId}`, 'error');
          throw e;
        }
      },
    }),

    betaTool({
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
        try {
          const ref = todosCol().doc(args.todoId);
          const snap = await ref.get();
          if (!snap.exists) throw new Error(`No todo with id ${args.todoId}`);
          await ref.update({ dueAt: parseTimestamp(args.dueAt), status: 'deferred', updatedAt: FieldValue.serverTimestamp() });
          log('defer_todo', `Deferred "${snap.data()?.title ?? args.todoId}" to ${args.dueAt}`);
          return JSON.stringify({ ok: true });
        } catch (e) {
          log('defer_todo', `Failed to defer todo ${args.todoId}`, 'error');
          throw e;
        }
      },
    }),

    // ── Destructive (high-risk) — PROPOSE only; executed after user approval ──
    betaTool({
      name: 'delete_todo',
      description:
        'Permanently delete a todo. DESTRUCTIVE: this does NOT delete immediately — it asks the ' +
        'user to approve first via a confirmation card. Call it only when the user clearly asks to ' +
        'delete or remove a specific todo.',
      inputSchema: {
        type: 'object',
        properties: { todoId: { type: 'string' } },
        required: ['todoId'],
        additionalProperties: false,
      },
      run: async (args) => {
        const snap = await todosCol().doc(args.todoId).get();
        if (!snap.exists) throw new Error(`No todo with id ${args.todoId}`);
        return propose('delete_todo', `Delete todo "${snap.data()?.title ?? args.todoId}"`, { todoId: args.todoId });
      },
    }),

    betaTool({
      name: 'delete_group',
      description:
        'Permanently delete a shopping list or project INCLUDING all its items. DESTRUCTIVE: does ' +
        'NOT delete immediately — it asks the user to approve first. Call it only when the user ' +
        'clearly asks to delete or remove a specific list/project.',
      inputSchema: {
        type: 'object',
        properties: { groupId: { type: 'string' } },
        required: ['groupId'],
        additionalProperties: false,
      },
      run: async (args) => {
        const snap = await groupsCol().doc(args.groupId).get();
        if (!snap.exists) throw new Error(`No group with id ${args.groupId}`);
        const count = (await todosCol().where('groupId', '==', args.groupId).get()).size;
        return propose(
          'delete_group',
          `Delete "${snap.data()?.name ?? args.groupId}" and its ${count} item${count === 1 ? '' : 's'}`,
          { groupId: args.groupId },
        );
      },
    }),
  ];
}
