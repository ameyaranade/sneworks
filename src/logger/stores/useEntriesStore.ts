import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import type { Entry } from '../types';
import {
  addEntry as fbAddEntry,
  updateEntry as fbUpdateEntry,
  deleteEntry as fbDeleteEntry,
  subscribeToAllEntries,
} from '../firebase/loggerQueries';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { loggerCacheKey } from '../constants';
import { readCache, writeCache, startOfDay, endOfDay } from '../utils';
import { getCachedUid } from '../../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

interface EntriesState {
  entries: Entry[];
  loaded: boolean;

  // Initialize subscription — returns unsubscribe
  init: (uid: string) => Unsubscribe;

  // Derived selectors (call from components, not stored in state)
  getTodayEntries: () => Entry[];
  getEntriesForDate: (date: Date) => Entry[];
  getEntriesForRange: (start: Date, end: Date) => Entry[];
  getEntriesForGroup: (groupId: string) => Entry[];

  // CRUD
  addEntry: (uid: string, entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEntry: (uid: string, entryId: string, partial: Partial<Entry>) => Promise<void>;
  deleteEntry: (uid: string, entryId: string) => Promise<Entry | undefined>;
  restoreEntry: (uid: string, entry: Entry) => Promise<string>;

  // Status actions (optimistic)
  completeEntry: (uid: string, entryId: string) => Promise<void>;
  skipEntry: (uid: string, entryId: string) => Promise<void>;
  deferEntry: (uid: string, entryId: string, newDate: Date) => Promise<void>;
  markPending: (uid: string, entryId: string) => Promise<void>;
}

export const useEntriesStore = create<EntriesState>((set, get) => {
  // Synchronous cache seed
  const cachedUid = getCachedUid();
  let initialEntries: Entry[] = [];
  if (cachedUid) {
    initialEntries = readCache<Entry[]>(loggerCacheKey(cachedUid, 'entries')) ?? [];
  }

  const getTs = (e: Entry): Timestamp =>
    (e.occurredAt ?? e.dueAt ?? e.createdAt) as Timestamp;

  return {
    entries: initialEntries,
    loaded: initialEntries.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToAllEntries(uid, (entries) => {
        set({ entries, loaded: true });
        writeCache(loggerCacheKey(uid, 'entries'), entries);
      });
      return unsub;
    },

    // Selectors
    getTodayEntries: () => {
      const start = startOfDay(new Date()).getTime();
      const end = endOfDay(new Date()).getTime();
      return get().entries.filter((e) => {
        const ms = getTs(e)?.toMillis?.();
        return ms !== undefined && ms >= start && ms <= end;
      });
    },

    getEntriesForDate: (date: Date) => {
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      return get().entries.filter((e) => {
        const ms = getTs(e)?.toMillis?.();
        return ms !== undefined && ms >= start && ms <= end;
      });
    },

    getEntriesForRange: (start: Date, end: Date) => {
      const startMs = start.getTime();
      const endMs = end.getTime();
      return get().entries.filter((e) => {
        const ms = getTs(e)?.toMillis?.();
        return ms !== undefined && ms >= startMs && ms <= endMs;
      });
    },

    getEntriesForGroup: (groupId: string) => {
      return get().entries.filter((e) => e.groupId === groupId);
    },

    // CRUD
    addEntry: async (uid, entryInput) => {
      const id = await fbAddEntry(uid, entryInput);
      if (entryInput.groupId) {
        recomputeGroupCounts(uid, entryInput.groupId).catch(console.error);
      }
      return id;
    },

    updateEntry: async (uid, entryId, partial) => {
      // Optimistic update — undefined values mean "delete this key"
      set((s) => ({
        entries: s.entries.map((e) => {
          if (e.id !== entryId) return e;
          const updated = { ...e, ...partial } as unknown as Record<string, unknown>;
          for (const key of Object.keys(partial as Record<string, unknown>)) {
            if ((partial as Record<string, unknown>)[key] === undefined) {
              delete updated[key];
            }
          }
          return updated as unknown as Entry;
        }),
      }));
      try {
        await fbUpdateEntry(uid, entryId, partial);
        // Recompute group counts if groupId changed or is present
        const entry = get().entries.find((e) => e.id === entryId);
        if (entry?.groupId) {
          recomputeGroupCounts(uid, entry.groupId).catch(console.error);
        }
      } catch (err) {
        // Rollback: next onSnapshot will restore correct state
        console.error('updateEntry failed', err);
        throw err;
      }
    },

    deleteEntry: async (uid, entryId) => {
      const deleted = get().entries.find((e) => e.id === entryId);
      // Optimistic remove
      set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }));
      try {
        await fbDeleteEntry(uid, entryId);
        if (deleted?.groupId) {
          recomputeGroupCounts(uid, deleted.groupId).catch(console.error);
        }
      } catch (err) {
        console.error('deleteEntry failed', err);
        throw err;
      }
      return deleted;
    },

    restoreEntry: async (uid, entry) => {
      // Re-add a previously deleted entry (for undo)
      const { id: _id, ...rest } = entry;
      return fbAddEntry(uid, rest);
    },

    // Status actions
    completeEntry: async (uid, entryId) => {
      const now = Timestamp.now();
      await get().updateEntry(uid, entryId, {
        status: 'done',
        completedAt: now,
      });
    },

    skipEntry: async (uid, entryId) => {
      await get().updateEntry(uid, entryId, { status: 'skipped' });
    },

    deferEntry: async (uid, entryId, newDate: Date) => {
      const newTs = Timestamp.fromDate(newDate);
      await get().updateEntry(uid, entryId, {
        dueAt: newTs,
        occurredAt: newTs,
        status: 'deferred',
      });
    },

    markPending: async (uid, entryId) => {
      await get().updateEntry(uid, entryId, {
        status: 'pending',
        completedAt: undefined,
      });
    },
  };
});
