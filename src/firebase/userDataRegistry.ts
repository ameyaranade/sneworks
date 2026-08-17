import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { cacheKey } from '../utils';
import { clearAllCache } from '../auth/AuthContext';
import { eraseMySharedProjectData } from './sharedProjectQueries';
import { eraseAllChatSessions } from './chatQueries';

/**
 * The single source of truth for every Firestore store that holds user-created
 * data. Export, account-erase, and cache-clear all iterate `userDataRegistry`
 * so a new collection can't silently escape them.
 *
 * Adding a new `users/{uid}/<collection>` store? Add its name to
 * `USER_DATA_COLLECTIONS` AND a registry entry below — the coverage test
 * (`userDataRegistry.test.ts`) fails if the two diverge, turning a forgotten
 * wiring into a red test instead of a missed checkbox.
 *
 * `sharedProjects` (docs/SHAREABLE_PROJECTS_SPEC.md D8/§8) is the one entry that
 * isn't a `users/{uid}/<collection>` path — it's a single top-level collection
 * holding every shared group (projects, sub-projects, shopping lists), scoped by
 * the `members` map instead of a uid segment. Its erase/export logic differs
 * (owner cascade vs member leave; membership mutation goes through the
 * `eraseMySharedProjectData` Cloud Function) but it still MUST be registered
 * here, or a member's shared-group data would silently escape export/erase.
 *
 * `invites` are intentionally NOT a separate registry entry: they're transient
 * control records (not user content), fully resolved by `eraseMySharedProjectData`
 * (revoke sent / decline received) as part of the sharedProjects erase path.
 */
export const USER_DATA_COLLECTIONS = ['todos', 'logs', 'groups', 'settings', 'sharedProjects', 'chatSessions'] as const;
export type UserDataCollection = (typeof USER_DATA_COLLECTIONS)[number];

export interface UserDataStore {
  collectionName: UserDataCollection;
  label: string;
  /** localStorage cache key for this store, or null if it isn't cached. */
  cacheKey: ((uid: string) => string) | null;
  /** Whether this store participates in the user-facing export. */
  exportable: boolean;
  /** Required when `exportable`; returns the records to include in the export. */
  exportAll?: (uid: string) => Promise<Record<string, unknown>[]>;
  /** Permanently deletes every doc in this store for the user (account erase). */
  eraseAll: (uid: string) => Promise<void>;
}

// Firestore batches cap at 500 writes; stay comfortably under.
const BATCH_LIMIT = 400;

async function wipeCollection(uid: string, name: UserDataCollection): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, name));
  let batch = writeBatch(db);
  let pending = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    pending += 1;
    if (pending === BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

// Projects are Groups with `groupKind === 'project'` (top-level + sub-projects).
async function exportProjects(uid: string): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'groups'), where('groupKind', '==', 'project')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Shared groups the user is a member of — export stays projects-only (D4).
// Shopping lists are not exported (same policy as personal lists).
async function exportSharedProjects(uid: string): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(
    query(
      collection(db, 'sharedProjects'),
      where(`members.${uid}`, '==', true),
      where('groupKind', '==', 'project'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Owner erase cascades (deletes for every member); member-only erase just leaves.
// See docs/SHAREABLE_PROJECTS_SPEC.md D8 — membership mutation is function-only.
async function eraseSharedProjects(): Promise<void> {
  await eraseMySharedProjectData();
}

export const userDataRegistry: UserDataStore[] = [
  {
    collectionName: 'todos',
    label: 'Todos',
    cacheKey: (uid) => cacheKey(uid, 'todos'),
    exportable: false,
    eraseAll: (uid) => wipeCollection(uid, 'todos'),
  },
  {
    collectionName: 'logs',
    label: 'Logs',
    cacheKey: (uid) => cacheKey(uid, 'logs'),
    exportable: false,
    eraseAll: (uid) => wipeCollection(uid, 'logs'),
  },
  {
    collectionName: 'groups',
    label: 'Lists, projects & routines',
    cacheKey: (uid) => cacheKey(uid, 'groups'),
    // Only projects are exportable for now (other types: CRUD-from-UI only).
    exportable: true,
    exportAll: exportProjects,
    eraseAll: (uid) => wipeCollection(uid, 'groups'),
  },
  {
    collectionName: 'settings',
    label: 'Settings',
    cacheKey: null,
    exportable: false,
    eraseAll: (uid) => wipeCollection(uid, 'settings'),
  },
  {
    collectionName: 'sharedProjects',
    label: 'Shared projects & lists',
    cacheKey: (uid) => cacheKey(uid, 'sharedProjects'),
    exportable: true,
    exportAll: exportSharedProjects,
    eraseAll: eraseSharedProjects,
  },
  {
    // Chat agent history (functions/src/ai/assistantAgent.ts). Not exportable —
    // it's transient conversation, not authored user content. Erase cascades
    // into each session's messages/proposedActions subcollections.
    collectionName: 'chatSessions',
    label: 'Assistant chats',
    cacheKey: (uid) => cacheKey(uid, 'chat'),
    exportable: false,
    eraseAll: eraseAllChatSessions,
  },
];

// ─── Export (projects only) ───────────────────────────────────────────────────

export interface UserDataExport {
  app: 'sneworks';
  version: 1;
  exportedAt: string;
  uid: string;
  projects: Record<string, unknown>[];
  projectTasks: Record<string, unknown>[];
}

export async function buildUserDataExport(uid: string): Promise<UserDataExport> {
  const projectArrays = await Promise.all(
    userDataRegistry.filter((s) => s.exportable).map((s) => s.exportAll!(uid)),
  );
  const projects = projectArrays.flat();

  // A project export without its tasks is useless, so include the todos that
  // belong to the exported projects. Personal project tasks live in the flat
  // users/{uid}/todos collection; shared project tasks live in their own
  // sharedProjects/{pid}/todos subcollection (see D8) — gather both.
  const personalProjectIds = new Set(
    projects.filter((p) => p.location !== 'shared').map((p) => p.id as string),
  );
  const sharedProjectIds = projects
    .filter((p) => p.location === 'shared')
    .map((p) => p.id as string);

  let projectTasks: Record<string, unknown>[] = [];
  if (personalProjectIds.size > 0) {
    const todosSnap = await getDocs(collection(db, 'users', uid, 'todos'));
    projectTasks = todosSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => personalProjectIds.has((t as { groupId?: string }).groupId ?? ''));
  }
  if (sharedProjectIds.length > 0) {
    const sharedTaskArrays = await Promise.all(
      sharedProjectIds.map(async (pid) => {
        const snap = await getDocs(collection(db, 'sharedProjects', pid, 'todos'));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }),
    );
    projectTasks = [...projectTasks, ...sharedTaskArrays.flat()];
  }

  return {
    app: 'sneworks',
    version: 1,
    exportedAt: new Date().toISOString(),
    uid,
    projects,
    projectTasks,
  };
}

/** Builds the export and triggers a client-side JSON download. */
export async function exportUserDataToFile(uid: string): Promise<void> {
  const data = await buildUserDataExport(uid);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sneworks-projects-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Erase (everything) ───────────────────────────────────────────────────────

/** Permanently deletes ALL of the user's Firestore data, then clears local cache. */
export async function eraseAllUserData(uid: string): Promise<void> {
  for (const store of userDataRegistry) {
    await store.eraseAll(uid);
  }
  try {
    for (const store of userDataRegistry) {
      if (store.cacheKey) localStorage.removeItem(store.cacheKey(uid));
    }
  } catch (_) {}
  clearAllCache();
}
