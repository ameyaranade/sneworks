import { create } from 'zustand';
import type { Log } from '../types';
import {
  addLog as fbAddLog,
  updateLog as fbUpdateLog,
  deleteLog as fbDeleteLog,
  subscribeToRecentLogs,
} from '../firebase/logQueries';
import { cacheKey, readCache, writeCache, startOfDay } from '../utils';
import { getCachedUid } from '../auth/AuthContext';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = 'logs';

export interface DayGroup {
  dateKey: string;   // "YYYY-MM-DD" for sorting
  label: string;     // "Today" | "Yesterday" | "25 May"
  logs: Log[];
}

interface LogsState {
  logs: Log[];
  loaded: boolean;

  init: (uid: string) => Unsubscribe;

  // Selectors
  getLogsGroupedByDay: () => DayGroup[];
  getWeekTotals: () => { expenses: number; income: number };

  // CRUD
  addLog: (uid: string, log: Omit<Log, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLog: (uid: string, logId: string, partial: Partial<Omit<Log, 'id' | 'createdAt'>>) => Promise<void>;
  deleteLog: (uid: string, logId: string) => Promise<Log | undefined>;
  restoreLog: (uid: string, log: Log) => Promise<string>;
}

export const useLogsStore = create<LogsState>((set, get) => {
  const cachedUid = getCachedUid();
  let initialLogs: Log[] = [];
  if (cachedUid) {
    initialLogs = readCache<Log[]>(cacheKey(cachedUid, CACHE_KEY)) ?? [];
  }

  return {
    logs: initialLogs,
    loaded: initialLogs.length > 0,

    init: (uid: string) => {
      const unsub = subscribeToRecentLogs(uid, (logs) => {
        set({ logs, loaded: true });
        writeCache(cacheKey(uid, CACHE_KEY), logs);
      });
      return unsub;
    },

    // ── Selectors ──────────────────────────────────────────────────────────────

    getLogsGroupedByDay: () => {
      const now = new Date();
      const todayStart = startOfDay(now).getTime();
      const yesterdayStart = todayStart - 86400000;

      const buckets = new Map<string, { label: string; logs: Log[] }>();

      for (const log of get().logs) {
        const d = log.occurredAt.toDate();
        const ms = startOfDay(d).getTime();
        const key = d.toISOString().slice(0, 10);

        let label: string;
        if (ms === todayStart) label = 'Today';
        else if (ms === yesterdayStart) label = 'Yesterday';
        else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

        if (!buckets.has(key)) buckets.set(key, { label, logs: [] });
        buckets.get(key)!.logs.push(log);
      }

      return Array.from(buckets.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dateKey, { label, logs }]) => ({ dateKey, label, logs }));
    },

    getWeekTotals: () => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let expenses = 0;
      let income = 0;
      for (const log of get().logs) {
        if (log.occurredAt.toMillis() < weekAgo) continue;
        if (log.logType === 'expense') expenses += (log as { amount?: number }).amount ?? 0;
        if (log.logType === 'income') income += (log as { amount?: number }).amount ?? 0;
      }
      return { expenses, income };
    },

    // ── CRUD ──────────────────────────────────────────────────────────────────

    addLog: async (uid, logInput) => {
      return fbAddLog(uid, logInput);
    },

    updateLog: async (uid, logId, partial) => {
      set((s) => ({
        logs: s.logs.map((l) =>
          l.id !== logId ? l : ({ ...l, ...partial } as Log),
        ),
      }));
      try {
        await fbUpdateLog(uid, logId, partial);
      } catch (err) {
        console.error('updateLog failed', err);
        throw err;
      }
    },

    deleteLog: async (uid, logId) => {
      const deleted = get().logs.find((l) => l.id === logId);
      set((s) => ({ logs: s.logs.filter((l) => l.id !== logId) }));
      try {
        await fbDeleteLog(uid, logId);
      } catch (err) {
        console.error('deleteLog failed', err);
        throw err;
      }
      return deleted;
    },

    restoreLog: async (uid, log) => {
      const { id: _id, ...rest } = log;
      return fbAddLog(uid, rest as Omit<Log, 'id' | 'createdAt' | 'updatedAt'>);
    },
  };
});
