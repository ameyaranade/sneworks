import { create } from 'zustand';
import type { Group } from '../types';
import {
  addGroup as fbAddGroup,
  updateGroup as fbUpdateGroup,
  deleteGroup as fbDeleteGroup,
  subscribeToGroups,
} from '../firebase/groupQueries';
import { loggerCacheKey } from '../constants';
import { readCache, writeCache } from '../utils';
import { getCachedUid } from '../../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

interface GroupsState {
  groups: Group[];
  loaded: boolean;

  init: (uid: string) => Unsubscribe;

  addGroup: (uid: string, group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateGroup: (uid: string, groupId: string, partial: Partial<Group>) => Promise<void>;
  deleteGroup: (uid: string, groupId: string) => Promise<void>;
}

export const useGroupsStore = create<GroupsState>((set) => {
  const cachedUid = getCachedUid();
  const initialGroups: Group[] = cachedUid
    ? (readCache<Group[]>(loggerCacheKey(cachedUid, 'groups')) ?? [])
    : [];

  return {
    groups: initialGroups,
    loaded: initialGroups.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToGroups(uid, (groups) => {
        set({ groups, loaded: true });
        writeCache(loggerCacheKey(uid, 'groups'), groups);
      });
      return unsub;
    },

    addGroup: async (uid, group) => fbAddGroup(uid, group),

    updateGroup: async (uid, groupId, partial) => {
      set((s) => ({
        groups: s.groups.map((g) => (g.id === groupId ? { ...g, ...partial } : g)),
      }));
      await fbUpdateGroup(uid, groupId, partial);
    },

    deleteGroup: async (uid, groupId) => {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }));
      await fbDeleteGroup(uid, groupId);
    },
  };
});
