import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import type {
  Activity,
  Reminder,
  TrackerSettings,
} from '../types';
import { DEFAULT_SETTINGS, RECENT_ACTIVITIES_DAYS } from '../constants';
import { Timestamp } from 'firebase/firestore';
import {
  subscribeToSettings,
  subscribeToActivitiesForDate,
  subscribeToActivitiesForDateRange,
  subscribeToReminders,
} from '../firebase/trackerQueries';
import { formatDate } from '../utils';

// ─── localStorage cache helpers ───

const ck = (uid: string, key: string) => `sneworks_${uid}_${key}`;

// Firestore Timestamps are serialized with a __firestoreTimestamp discriminator
// so revival is unambiguous — user data with { seconds, nanoseconds } won't be mis-revived.
function reviveTimestamps(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(reviveTimestamps);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.__firestoreTimestamp === true && typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, reviveTimestamps(v)]));
  }
  return val;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (reviveTimestamps(JSON.parse(raw)) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    const serialized = JSON.stringify(data, (_, value) => {
      if (value instanceof Timestamp) {
        return { __firestoreTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
      }
      return value;
    });
    localStorage.setItem(key, serialized);
  } catch (_) {}
}

// ─── Context ───

interface TrackerContextType {
  settings: TrackerSettings;
  todayActivities: Activity[];
  monthActivities: Activity[];
  reminders: Reminder[];
  loading: boolean;
}

const defaultSettings: TrackerSettings = { ...DEFAULT_SETTINGS, updatedAt: Timestamp.now() };

const defaultContext: TrackerContextType = {
  settings: defaultSettings,
  todayActivities: [],
  monthActivities: [],
  reminders: [],
  loading: true,
};

const TrackerContext = createContext<TrackerContextType>(defaultContext);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Read cache synchronously in useState initializers so the very first render
  // already has data. getCachedUid() uses the auth hint so this works even
  // before Firebase resolves the session (optimistic auth phase).
  const [settings, setSettings] = useState<TrackerSettings>(() => {
    const uid = getCachedUid();
    const cached = uid ? readCache<TrackerSettings>(ck(uid, 'settings')) : null;
    if (cached?.darkMode !== undefined) document.body.dataset.theme = cached.darkMode ? 'dark' : '';
    return cached ?? defaultSettings;
  });
  const [todayActivities, setTodayActivities] = useState<Activity[]>(() => {
    const uid = getCachedUid();
    return uid ? readCache<Activity[]>(ck(uid, 'today')) ?? [] : [];
  });
  const [monthActivities, setMonthActivities] = useState<Activity[]>(() => {
    const uid = getCachedUid();
    return uid ? readCache<Activity[]>(ck(uid, 'month')) ?? [] : [];
  });
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const uid = getCachedUid();
    return uid ? readCache<Reminder[]>(ck(uid, 'reminders')) ?? [] : [];
  });
  const [loading, setLoading] = useState(() => {
    const uid = getCachedUid();
    if (!uid) return true;
    const hasCache = !!(
      readCache(ck(uid, 'settings')) ||
      readCache(ck(uid, 'today')) ||
      readCache(ck(uid, 'reminders'))
    );
    return !hasCache;
  });

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    const now = new Date();
    const today = formatDate(now);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - RECENT_ACTIVITIES_DAYS);
    const monthStart = formatDate(monthAgo);

    // Live subscriptions update state + cache when Firebase responds
    let loadCount = 0;
    const onLoad = () => { loadCount++; if (loadCount >= 4) setLoading(false); };

    const unsubs = [
      subscribeToSettings(uid, (s) => {
        setSettings(s);
        writeCache(ck(uid, 'settings'), s);
        document.body.dataset.theme = s.darkMode ? 'dark' : '';
        try { localStorage.setItem('sneworks-dark', s.darkMode ? '1' : '0'); } catch (_) {}
        onLoad();
      }),
      subscribeToActivitiesForDate(uid, today, (a) => {
        setTodayActivities(a);
        writeCache(ck(uid, 'today'), a);
        onLoad();
      }),
      subscribeToActivitiesForDateRange(uid, monthStart, today, (a) => {
        setMonthActivities(a);
        writeCache(ck(uid, 'month'), a);
        onLoad();
      }),
      subscribeToReminders(uid, (r) => {
        setReminders(r);
        writeCache(ck(uid, 'reminders'), r);
        onLoad();
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const contextValue = useMemo(
    () => ({ settings, todayActivities, monthActivities, reminders, loading }),
    [settings, todayActivities, monthActivities, reminders, loading],
  );

  return (
    <TrackerContext.Provider value={contextValue}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  return useContext(TrackerContext);
}
