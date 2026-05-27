import { create } from 'zustand';
import type { Group, RecurringTodoGroup } from '../types';
import {
  addGroup as fbAddGroup,
  updateGroup as fbUpdateGroup,
  deleteGroup as fbDeleteGroup,
  subscribeToAllGroups,
} from '../firebase/groupQueries';
import { sandboxCacheKey, readCache, writeCache } from '../utils';
import { getCachedUid } from '../../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = 'groups';

interface GroupsState {
  groups: Group[];
  loaded: boolean;

  init: (uid: string) => Unsubscribe;

  // Selectors
  getActiveShoppingLists: () => Group[];
  getTodayShoppingListGroup: () => Group | undefined;
  getActiveProjects: () => Group[];
  getCompletedProjects: () => Group[];
  getArchivedProjects: () => Group[];
  getActiveRoutines: () => Group[];
  getArchivedRoutines: () => Group[];
  getActiveRecurringTodos: () => RecurringTodoGroup[];
  getSubGroups: (parentGroupId: string) => Group[];

  // CRUD
  addGroup: (uid: string, group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateGroup: (uid: string, groupId: string, partial: Partial<Omit<Group, 'id' | 'createdAt'>>) => Promise<void>;
  deleteGroup: (uid: string, groupId: string) => Promise<void>;
}

export const useGroupsStore = create<GroupsState>((set, get) => {
  const cachedUid = getCachedUid();
  let initialGroups: Group[] = [];
  if (cachedUid) {
    initialGroups = readCache<Group[]>(sandboxCacheKey(cachedUid, CACHE_KEY)) ?? [];
  }

  return {
    groups: initialGroups,
    loaded: initialGroups.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToAllGroups(uid, (groups) => {
        set({ groups, loaded: true });
        writeCache(sandboxCacheKey(uid, CACHE_KEY), groups);
      });
      return unsub;
    },

    // ── Selectors ──────────────────────────────────────────────────────────────

    getActiveShoppingLists: () =>
      get().groups.filter((g) => g.groupKind === 'shopping-list' && !g.completed && !g.archivedAt),

    getTodayShoppingListGroup: () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const tripName = `Shopping:${dd}-${mm}-${yyyy}`;
      return get().groups.find((g) => g.groupKind === 'shopping-list' && g.name === tripName);
    },

    getActiveProjects: () =>
      get().groups.filter(
        (g) => g.groupKind === 'project' && !g.completed && !g.archivedAt && !g.parentGroupId,
      ),

    getCompletedProjects: () =>
      get().groups.filter(
        (g) => g.groupKind === 'project' && g.completed && !g.archivedAt && !g.parentGroupId,
      ),

    getArchivedProjects: () =>
      get().groups.filter(
        (g) => g.groupKind === 'project' && !!g.archivedAt && !g.parentGroupId,
      ),

    getActiveRoutines: () =>
      get().groups.filter((g) => g.groupKind === 'routine' && !g.archivedAt),

    getArchivedRoutines: () =>
      get().groups.filter((g) => g.groupKind === 'routine' && !!g.archivedAt),

    getActiveRecurringTodos: () =>
      get().groups.filter(
        (g): g is RecurringTodoGroup => g.groupKind === 'recurring-todo' && !g.archivedAt,
      ),

    getSubGroups: (parentGroupId: string) =>
      get().groups.filter((g) => g.parentGroupId === parentGroupId && !g.archivedAt),

    // ── CRUD ──────────────────────────────────────────────────────────────────

    addGroup: async (uid, groupInput) => {
      return fbAddGroup(uid, groupInput);
    },

    updateGroup: async (uid, groupId, partial) => {
      set((s) => ({
        groups: s.groups.map((g) =>
          g.id !== groupId ? g : ({ ...g, ...partial } as Group),
        ),
      }));
      try {
        await fbUpdateGroup(uid, groupId, partial);
      } catch (err) {
        console.error('updateGroup failed', err);
        throw err;
      }
    },

    deleteGroup: async (uid, groupId) => {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }));
      try {
        await fbDeleteGroup(uid, groupId);
      } catch (err) {
        console.error('deleteGroup failed', err);
        throw err;
      }
    },
  };
});
