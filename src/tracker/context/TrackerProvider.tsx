import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import type {
  Activity,
  Reminder,
  TrackerSettings,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Timestamp } from 'firebase/firestore';
import {
  subscribeToSettings,
  subscribeToActivitiesForDate,
  subscribeToActivitiesForDateRange,
  subscribeToReminders,
} from '../firebase/trackerQueries';
import { formatDate, getWeekRange } from '../utils';

interface TrackerContextType {
  settings: TrackerSettings;
  todayActivities: Activity[];
  weekActivities: Activity[];
  monthActivities: Activity[];
  reminders: Reminder[];
  loading: boolean;
}

const defaultSettings: TrackerSettings = { ...DEFAULT_SETTINGS, updatedAt: Timestamp.now() };

const defaultContext: TrackerContextType = {
  settings: defaultSettings,
  todayActivities: [],
  weekActivities: [],
  monthActivities: [],
  reminders: [],
  loading: true,
};

const TrackerContext = createContext<TrackerContextType>(defaultContext);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TrackerSettings>(defaultSettings);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [weekActivities, setWeekActivities] = useState<Activity[]>([]);
  const [monthActivities, setMonthActivities] = useState<Activity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
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
      subscribeToActivitiesForDate(uid, today, (a) => { setTodayActivities(a); onLoad(); }),
      subscribeToActivitiesForDateRange(uid, start, end, (a) => { setWeekActivities(a); onLoad(); }),
      subscribeToActivitiesForDateRange(uid, monthStart, today, (a) => { setMonthActivities(a); onLoad(); }),
      subscribeToReminders(uid, (r) => { setReminders(r); onLoad(); }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <TrackerContext.Provider
      value={{ settings, todayActivities, weekActivities, monthActivities, reminders, loading }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  return useContext(TrackerContext);
}
