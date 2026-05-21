import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  Activity,
  ActivityType,
  Reminder,
  ReminderType,
  GroceryReminder,
  TrackerSettings,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants';

// ─── New Paths ───

function activitiesCol(uid: string) {
  return collection(db, 'users', uid, 'activities');
}

function remindersCol(uid: string) {
  return collection(db, 'users', uid, 'reminders');
}

function settingsDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'preferences');
}

// ─── Settings (unchanged) ───

export async function getSettings(uid: string): Promise<TrackerSettings> {
  const snap = await getDoc(settingsDoc(uid));
  if (snap.exists()) return snap.data() as TrackerSettings;
  const defaults = { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() };
  await setDoc(settingsDoc(uid), defaults);
  return { ...DEFAULT_SETTINGS, updatedAt: null as any };
}

export async function updateSettings(uid: string, partial: Partial<TrackerSettings>) {
  await setDoc(settingsDoc(uid), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToSettings(uid: string, cb: (s: TrackerSettings) => void): Unsubscribe {
  return onSnapshot(settingsDoc(uid), (snap) => {
    if (snap.exists()) cb(snap.data() as TrackerSettings);
  });
}

// ─── Activities ───

export async function addActivity(
  uid: string,
  activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'> & Record<string, unknown>,
) {
  const ref = await addDoc(activitiesCol(uid), {
    ...activity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateActivity(uid: string, activityId: string, partial: Partial<Activity>) {
  await updateDoc(doc(activitiesCol(uid), activityId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteActivity(uid: string, activityId: string) {
  await deleteDoc(doc(activitiesCol(uid), activityId));
}

export function subscribeToActivitiesForDate(
  uid: string,
  date: string,
  cb: (activities: Activity[]) => void,
): Unsubscribe {
  const q = query(activitiesCol(uid), where('date', '==', date));
  return onSnapshot(q, (snap) => {
    const activities = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Activity);
    activities.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(activities);
  });
}

export function subscribeToActivitiesForDateRange(
  uid: string,
  startDate: string,
  endDate: string,
  cb: (activities: Activity[]) => void,
): Unsubscribe {
  const q = query(
    activitiesCol(uid),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  return onSnapshot(q, (snap) => {
    const activities = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Activity);
    activities.sort(
      (a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
    );
    cb(activities);
  });
}

export function subscribeToActivitiesByType<T extends Activity>(
  uid: string,
  type: ActivityType,
  cb: (activities: T[]) => void,
): Unsubscribe {
  const q = query(activitiesCol(uid), where('type', '==', type));
  return onSnapshot(q, (snap) => {
    const activities = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
    activities.sort(
      (a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
    );
    cb(activities);
  });
}

export async function getActivitiesForDateRange(uid: string, startDate: string, endDate: string) {
  const q = query(
    activitiesCol(uid),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  const snap = await getDocs(q);
  const activities = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Activity);
  activities.sort(
    (a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
  );
  return activities;
}

// ─── Reminders ───

export async function addReminder(
  uid: string,
  reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'> & Record<string, unknown>,
) {
  const ref = await addDoc(remindersCol(uid), {
    ...reminder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateReminder(uid: string, reminderId: string, partial: Partial<Reminder>) {
  await updateDoc(doc(remindersCol(uid), reminderId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReminder(uid: string, reminderId: string) {
  await deleteDoc(doc(remindersCol(uid), reminderId));
}

export function subscribeToReminders(uid: string, cb: (reminders: Reminder[]) => void): Unsubscribe {
  const q = query(remindersCol(uid), where('active', '==', true));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Reminder));
  });
}

export function subscribeToRemindersByType<T extends Reminder>(
  uid: string,
  type: ReminderType,
  cb: (reminders: T[]) => void,
): Unsubscribe {
  const q = query(remindersCol(uid), where('type', '==', type), where('active', '==', true));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T));
  });
}

export async function toggleGroceryReminder(uid: string, reminderId: string, checked: boolean) {
  await updateDoc(doc(remindersCol(uid), reminderId), {
    checked,
    checkedAt: checked ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveGroceryTrip(
  uid: string,
  tripName: string,
  tripMode: 'store' | 'online',
  checkedReminders: GroceryReminder[],
  date: string,
) {
  await addActivity(uid, {
    type: 'grocery',
    date,
    notes: '',
    tripName,
    tripMode,
    tripItems: checkedReminders.map((r) => ({
      id: r.id!,
      name: r.name,
      checked: true,
      ...(r.checkedAt ? { checkedAt: r.checkedAt } : {}),
    })),
  });
  const batch = writeBatch(db);
  for (const r of checkedReminders) {
    if (r.id) batch.delete(doc(remindersCol(uid), r.id));
  }
  await batch.commit();
}

export async function completeGenericReminder(uid: string, reminderId: string) {
  await updateDoc(doc(remindersCol(uid), reminderId), {
    completed: true,
    completedAt: serverTimestamp(),
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function getCompletedGenericReminders(uid: string): Promise<import('../types').GenericReminder[]> {
  const q = query(
    remindersCol(uid),
    where('type', '==', 'generic'),
    where('active', '==', false),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as import('../types').GenericReminder)
    .filter((r) => r.completed)
    .sort((a, b) => {
      const aTime = (a as any).completedAt?.toMillis?.() ?? 0;
      const bTime = (b as any).completedAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
}

