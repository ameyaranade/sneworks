import { create } from 'zustand';
import type { Group } from '../types';
import {
  subscribeToMySharedProjects,
  updateSharedProject as fbUpdateSharedProject,
} from '../firebase/sharedProjectQueries';
import { cacheKey, readCache, writeCache } from '../utils';
import { getCachedUid } from '../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = 'sharedProjects';

interface SharedProjectsState {
  sharedProjects: Group[];
  loaded: boolean;

  init: (uid: string) => Unsubscribe;

  // Selectors — mirror useGroupsStore selectors, scoped to shared groups.
  getActiveSharedProjects: () => Group[];
  getCompletedSharedProjects: () => Group[];
  getArchivedSharedProjects: () => Group[];
  getSharedSubGroups: (parentGroupId: string) => Group[];
  getSharedProjectById: (pid: string) => Group | undefined;
  getActiveSharedShoppingLists: () => Group[];
  getArchivedSharedShoppingLists: () => Group[];

  // CRUD (non-ACL fields only — membership goes through sharedProjectQueries callables)
  updateSharedProject: (pid: string, partial: Partial<Group>) => Promise<void>;
}

export const useSharedProjectsStore = create<SharedProjectsState>((set, get) => {
  const cachedUid = getCachedUid();
  let initialSharedProjects: Group[] = [];
  if (cachedUid) {
    initialSharedProjects = readCache<Group[]>(cacheKey(cachedUid, CACHE_KEY)) ?? [];
  }

  return {
    sharedProjects: initialSharedProjects,
    loaded: initialSharedProjects.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToMySharedProjects(uid, (sharedProjects) => {
        set({ sharedProjects, loaded: true });
        writeCache(cacheKey(uid, CACHE_KEY), sharedProjects);
      });
      return unsub;
    },

    // ── Selectors ──────────────────────────────────────────────────────────────

    getActiveSharedProjects: () =>
      get().sharedProjects.filter(
        (g) => g.groupKind === 'project' && !g.completed && !g.archivedAt && !g.parentGroupId,
      ),

    getCompletedSharedProjects: () =>
      get().sharedProjects.filter(
        (g) => g.groupKind === 'project' && g.completed && !g.archivedAt && !g.parentGroupId,
      ),

    getArchivedSharedProjects: () =>
      get().sharedProjects.filter((g) => g.groupKind === 'project' && !!g.archivedAt && !g.parentGroupId),

    getSharedSubGroups: (parentGroupId: string) =>
      get().sharedProjects.filter(
        (g) => g.groupKind === 'project' && g.parentGroupId === parentGroupId && !g.archivedAt,
      ),

    getSharedProjectById: (pid: string) => get().sharedProjects.find((g) => g.id === pid),

    getActiveSharedShoppingLists: () =>
      get().sharedProjects.filter((g) => g.groupKind === 'shopping-list' && !g.archivedAt),

    getArchivedSharedShoppingLists: () =>
      get().sharedProjects.filter((g) => g.groupKind === 'shopping-list' && !!g.archivedAt),

    // ── CRUD ──────────────────────────────────────────────────────────────────

    updateSharedProject: async (pid, partial) => {
      // Optimistic: update local state immediately
      set((s) => ({
        sharedProjects: s.sharedProjects.map((g) => (g.id !== pid ? g : ({ ...g, ...partial } as Group))),
      }));
      try {
        await fbUpdateSharedProject(pid, partial);
      } catch (err) {
        console.error('updateSharedProject failed', err);
        throw err;
      }
    },
  };
});
