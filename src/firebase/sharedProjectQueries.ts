import {
  collection,
  doc,
  updateDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  addDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';
import type { Group, Invite, ProjectGroup, Todo } from '../types';

// ─── Collection helpers ────────────────────────────────────────────────────────

export function sharedProjectsCol() {
  return collection(db, 'sharedProjects');
}

function sharedProjectDoc(pid: string) {
  return doc(db, 'sharedProjects', pid);
}

function sharedTodosCol(pid: string) {
  return collection(db, 'sharedProjects', pid, 'todos');
}

function sharedTodoDoc(pid: string, todoId: string) {
  return doc(db, 'sharedProjects', pid, 'todos', todoId);
}

// Fields the ACL (D8) reserves for Cloud Functions — client updates must never touch these.
const ACL_FIELDS = new Set(['members', 'ownerUid', 'location', 'rootSharedId', 'memberCount']);

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** Shared groups (projects + lists; root + sub-projects) the given uid is a member of. */
export function subscribeToMySharedProjects(uid: string, cb: (groups: Group[]) => void): Unsubscribe {
  const q = query(sharedProjectsCol(), where(`members.${uid}`, '==', true));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group))),
    (err) => console.error('subscribeToMySharedProjects failed', err),
  );
}

export function subscribeToSharedTodos(pid: string, cb: (todos: Todo[]) => void): Unsubscribe {
  let fallbackUnsub: Unsubscribe | null = null;
  const primaryUnsub = onSnapshot(
    query(sharedTodosCol(pid), orderBy('sortOrder', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Todo))),
    (err) => {
      if (err.code === 'failed-precondition') {
        fallbackUnsub = onSnapshot(
          sharedTodosCol(pid),
          (snap) => {
            const todos = snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Todo))
              .sort((a, b) => a.sortOrder - b.sortOrder);
            cb(todos);
          },
          (fallbackErr) => console.error('subscribeToSharedTodos fallback failed', fallbackErr),
        );
      } else {
        console.error('subscribeToSharedTodos failed', err);
      }
    },
  );
  return () => {
    primaryUnsub();
    fallbackUnsub?.();
  };
}

/** Pending invites addressed to this email (Firestore auth token email, lowercased). */
export function subscribeToMyPendingInvites(email: string, cb: (invites: Invite[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'invites'),
    where('invitedEmail', '==', email.toLowerCase()),
    where('status', '==', 'pending'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite))),
    (err) => console.error('subscribeToMyPendingInvites failed', err),
  );
}

/**
 * Pending invites the owner has sent out for a given project (ShareSheet "People"
 * list). MUST filter by `invitedBy == ownerUid`: Firestore rejects a list query
 * unless its filters prove the security rule is satisfiable for every matched doc,
 * and the invites rule's owner branch is `request.auth.uid == invitedBy`. Without
 * this filter the whole query is permission-denied. Only the owner ever creates a
 * project's invites, so scoping to `invitedBy` loses nothing.
 */
export function subscribeToProjectInvites(
  pid: string,
  ownerUid: string,
  cb: (invites: Invite[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'invites'),
    where('pid', '==', pid),
    where('invitedBy', '==', ownerUid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite))),
    (err) => console.error('subscribeToProjectInvites failed', err),
  );
}

// ─── Shared project field updates (non-ACL) ────────────────────────────────────

/**
 * Creates a sub-project under an already-shared root. Owner-only per firestore.rules
 * (`create` requires request.auth.uid == ownerUid) — call only when the current
 * user is the project's owner.
 */
export async function addSharedSubProject(parent: ProjectGroup, name: string): Promise<string> {
  const ref = await addDoc(sharedProjectsCol(), {
    groupKind: 'project' as const,
    name,
    ancestorPath: [...(parent.ancestorPath ?? []), parent.id!],
    parentGroupId: parent.id,
    showProgress: true,
    showSumMoney: false,
    childCount: 0,
    doneCount: 0,
    completed: false,
    location: 'shared',
    ownerUid: parent.ownerUid,
    members: parent.members ?? {},
    memberNames: parent.memberNames ?? {},
    memberCount: parent.memberCount ?? 1,
    rootSharedId: parent.rootSharedId ?? parent.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSharedProject(pid: string, partial: Partial<Group>): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    if (ACL_FIELDS.has(k)) continue; // ACL fields are Cloud-Function-only (D8)
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(sharedProjectDoc(pid), payload);
}

// ─── Shared task CRUD ──────────────────────────────────────────────────────────

export async function addSharedTodo(pid: string, todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const cleaned = Object.fromEntries(
    Object.entries(todo as Record<string, unknown>).filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(sharedTodosCol(pid), {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSharedTodo(
  pid: string,
  todoId: string,
  partial: Partial<Omit<Todo, 'id' | 'createdAt'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(sharedTodoDoc(pid, todoId), payload);
}

export async function deleteSharedTodo(pid: string, todoId: string): Promise<void> {
  await deleteDoc(sharedTodoDoc(pid, todoId));
}

/** Batch-delete ALL tasks under a shared project (used when adding a sub-project isn't involved — cascade lives in the Cloud Function for project-level delete). */
export async function deleteAllSharedTodosForProject(pid: string): Promise<void> {
  const snap = await getDocs(sharedTodosCol(pid));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Cloud Function callables (membership mutation — D8) ──────────────────────

const callInviteToProject = httpsCallable<{ pid: string; email: string }, { ok: true }>(functions, 'inviteToProject');
const callAcceptInvite = httpsCallable<{ inviteId: string }, { ok: true; pid: string }>(functions, 'acceptInvite');
const callDeclineInvite = httpsCallable<{ inviteId: string }, { ok: true }>(functions, 'declineInvite');
const callRevokeInvite = httpsCallable<{ inviteId: string }, { ok: true }>(functions, 'revokeInvite');
const callBlockInviter = httpsCallable<{ inviteId: string }, { ok: true }>(functions, 'blockInviter');
const callLeaveProject = httpsCallable<{ pid: string }, { ok: true }>(functions, 'leaveProject');
const callRemoveMember = httpsCallable<{ pid: string; memberUid: string }, { ok: true }>(functions, 'removeMember');
const callUnshareProject = httpsCallable<{ pid: string }, { ok: true }>(functions, 'unshareProject');
const callDeleteSharedProject = httpsCallable<{ pid: string }, { ok: true }>(functions, 'deleteSharedProject');
const callEraseMySharedProjectData = httpsCallable<void, { ok: true }>(functions, 'eraseMySharedProjectData');

/** Invites `email` to project `pid`. If `pid` is still personal, this migrates it to sharedProjects first. */
export async function inviteToProject(pid: string, email: string): Promise<void> {
  await callInviteToProject({ pid, email });
}

export async function acceptInvite(inviteId: string): Promise<{ pid: string }> {
  const result = await callAcceptInvite({ inviteId });
  return { pid: result.data.pid };
}

export async function declineInvite(inviteId: string): Promise<void> {
  await callDeclineInvite({ inviteId });
}

/** Blocks the sender of an invite: adds them to your block list + declines their pending invites (D11). */
export async function blockInviter(inviteId: string): Promise<void> {
  await callBlockInviter({ inviteId });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await callRevokeInvite({ inviteId });
}

export async function leaveSharedProject(pid: string): Promise<void> {
  await callLeaveProject({ pid });
}

export async function removeMember(pid: string, memberUid: string): Promise<void> {
  await callRemoveMember({ pid, memberUid });
}

/** Owner-only: migrates the project back to the personal tree. */
export async function unshareProject(pid: string): Promise<void> {
  await callUnshareProject({ pid });
}

/** Owner-only: permanently deletes a shared project for every member. */
export async function deleteSharedProject(pid: string): Promise<void> {
  await callDeleteSharedProject({ pid });
}

/** Account-erase hook (see userDataRegistry.ts): cascades owned projects, leaves memberships, resolves invites. */
export async function eraseMySharedProjectData(): Promise<void> {
  await callEraseMySharedProjectData();
}
