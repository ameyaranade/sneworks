import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import type { TrackerEntry, ActiveGroceryList, RecurringItem, TrackerSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Timestamp } from 'firebase/firestore';
import {
  subscribeToSettings,
  subscribeToEntriesForDate,
  subscribeToEntriesForDateRange,
  subscribeToActiveGroceryList,
  subscribeToRecurringItems,
} from '../firebase/trackerQueries';
import { formatDate, getWeekRange } from '../utils';

interface TrackerContextType {
  settings: TrackerSettings;
  todayEntries: TrackerEntry[];
  weekEntries: TrackerEntry[];
  monthEntries: TrackerEntry[];
  activeGroceryList: ActiveGroceryList | null;
  recurringItems: RecurringItem[];
  loading: boolean;
}

const defaultSettings: TrackerSettings = { ...DEFAULT_SETTINGS, updatedAt: Timestamp.now() };

const defaultContext: TrackerContextType = {
  settings: defaultSettings,
  todayEntries: [],
  weekEntries: [],
  monthEntries: [],
  activeGroceryList: null,
  recurringItems: [],
  loading: true,
};

const TrackerContext = createContext<TrackerContextType>(defaultContext);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TrackerSettings>(defaultSettings);
  const [todayEntries, setTodayEntries] = useState<TrackerEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TrackerEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<TrackerEntry[]>([]);
  const [groceryList, setGroceryList] = useState<ActiveGroceryList | null>(null);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const uid = user.uid;
    const now = new Date();
    const today = formatDate(now);
    const { start, end } = getWeekRange(now);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthStart = formatDate(monthAgo);
    let loadCount = 0;
    const onLoad = () => {
      loadCount++;
      if (loadCount >= 4) setLoading(false);
    };

    const unsubs = [
      subscribeToSettings(uid, (s) => {
        setSettings(s);
        document.body.dataset.theme = s.darkMode ? 'dark' : '';
        onLoad();
      }),
      subscribeToEntriesForDate(uid, today, (e) => { setTodayEntries(e); onLoad(); }),
      subscribeToEntriesForDateRange(uid, start, end, (e) => { setWeekEntries(e); onLoad(); }),
      subscribeToEntriesForDateRange(uid, monthStart, today, (e) => { setMonthEntries(e); onLoad(); }),
      subscribeToActiveGroceryList(uid, (l) => { setGroceryList(l); onLoad(); }),
      subscribeToRecurringItems(uid, (items) => { setRecurringItems(items); onLoad(); }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <TrackerContext.Provider
      value={{ settings, todayEntries, weekEntries, monthEntries, activeGroceryList: groceryList, recurringItems, loading }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  return useContext(TrackerContext);
}
