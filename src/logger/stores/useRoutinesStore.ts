import { create } from 'zustand';
import type { Routine } from '../types';
import {
  addRoutine as fbAddRoutine,
  updateRoutine as fbUpdateRoutine,
  deleteRoutine as fbDeleteRoutine,
  subscribeToRoutines,
} from '../firebase/routineQueries';
import { loggerCacheKey } from '../constants';
import { readCache, writeCache } from '../utils';
import { getCachedUid } from '../../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

interface RoutinesState {
  routines: Routine[];
  loaded: boolean;

  init: (uid: string) => Unsubscribe;

  addRoutine: (uid: string, routine: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateRoutine: (uid: string, routineId: string, partial: Partial<Routine>) => Promise<void>;
  deleteRoutine: (uid: string, routineId: string) => Promise<void>;
}

export const useRoutinesStore = create<RoutinesState>((set) => {
  const cachedUid = getCachedUid();
  const initialRoutines: Routine[] = cachedUid
    ? (readCache<Routine[]>(loggerCacheKey(cachedUid, 'routines')) ?? [])
    : [];

  return {
    routines: initialRoutines,
    loaded: initialRoutines.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToRoutines(uid, (routines) => {
        set({ routines, loaded: true });
        writeCache(loggerCacheKey(uid, 'routines'), routines);
      });
      return unsub;
    },

    addRoutine: async (uid, routine) => fbAddRoutine(uid, routine),

    updateRoutine: async (uid, routineId, partial) => {
      set((s) => ({
        routines: s.routines.map((r) =>
          r.id === routineId ? { ...r, ...partial } : r,
        ),
      }));
      await fbUpdateRoutine(uid, routineId, partial);
    },

    deleteRoutine: async (uid, routineId) => {
      set((s) => ({ routines: s.routines.filter((r) => r.id !== routineId) }));
      await fbDeleteRoutine(uid, routineId);
    },
  };
});
