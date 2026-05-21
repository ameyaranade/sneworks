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
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  TrackerEntry,
  TrackerSettings,
  ActiveGroceryList,
  GroceryTrip,
  GroceryItem,
  RecurringItem,
  ActivityType,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants';

// ─── Paths ───

function entriesCol(uid: string) {
  return collection(db, 'users', uid, 'entries');
}

function groceryCol(uid: string) {
  return collection(db, 'users', uid, 'groceryLists');
}

function recurringCol(uid: string) {
  return collection(db, 'users', uid, 'recurringItems');
}

function settingsDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'preferences');
}

function activeGroceryDoc(uid: string) {
  return doc(db, 'users', uid, 'groceryLists', 'active');
}

// ─── Settings ───

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

// ─── Entries ───

export async function addEntry(uid: string, entry: Omit<TrackerEntry, 'id' | 'createdAt' | 'updatedAt'> & Record<string, unknown>) {
  const ref = await addDoc(entriesCol(uid), {
    ...entry,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEntry(uid: string, entryId: string, partial: Partial<TrackerEntry>) {
  await updateDoc(doc(entriesCol(uid), entryId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEntry(uid: string, entryId: string) {
  await deleteDoc(doc(entriesCol(uid), entryId));
}

export function subscribeToEntriesForDate(
  uid: string,
  date: string,
  cb: (entries: TrackerEntry[]) => void,
): Unsubscribe {
  const q = query(entriesCol(uid), where('date', '==', date));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as TrackerEntry);
    entries.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(entries);
  });
}

export function subscribeToEntriesForDateRange(
  uid: string,
  startDate: string,
  endDate: string,
  cb: (entries: TrackerEntry[]) => void,
): Unsubscribe {
  const q = query(
    entriesCol(uid),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as TrackerEntry);
    entries.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(entries);
  });
}

export function subscribeToEntriesByType<T extends TrackerEntry>(
  uid: string,
  type: ActivityType,
  cb: (entries: T[]) => void,
): Unsubscribe {
  const q = query(entriesCol(uid), where('type', '==', type));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
    entries.sort(
      (a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
    );
    cb(entries);
  });
}

export async function getEntriesForDateRange(uid: string, startDate: string, endDate: string) {
  const q = query(
    entriesCol(uid),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as TrackerEntry);
  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  return entries;
}

// ─── Grocery Lists ───

export function subscribeToActiveGroceryList(
  uid: string,
  cb: (list: ActiveGroceryList | null) => void,
): Unsubscribe {
  return onSnapshot(activeGroceryDoc(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as ActiveGroceryList) : null);
  });
}

export async function updateActiveGroceryList(uid: string, items: GroceryItem[]) {
  await setDoc(activeGroceryDoc(uid), { items, updatedAt: serverTimestamp() });
}

export async function archiveGroceryTrip(
  uid: string,
  trip: Omit<GroceryTrip, 'id' | 'completedAt'>,
  remainingItems: GroceryItem[],
) {
  await addDoc(groceryCol(uid), {
    ...trip,
    completedAt: serverTimestamp(),
  });
  await updateActiveGroceryList(uid, remainingItems);
}

export async function getGroceryTrips(uid: string): Promise<GroceryTrip[]> {
  const snap = await getDocs(groceryCol(uid));
  return snap.docs
    .filter((d) => d.id !== 'active')
    .map((d) => ({ ...d.data(), id: d.id }) as GroceryTrip)
    .sort((a, b) => (b.completedAt?.seconds ?? 0) - (a.completedAt?.seconds ?? 0));
}

export function subscribeToGroceryTripsForDateRange(
  uid: string,
  startDate: string,
  endDate: string,
  cb: (trips: GroceryTrip[]) => void,
): Unsubscribe {
  const q = query(
    groceryCol(uid),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  return onSnapshot(q, (snap) => {
    const trips = snap.docs
      .filter((d) => d.id !== 'active')
      .map((d) => ({ ...d.data(), id: d.id }) as GroceryTrip)
      .sort((a, b) => (b.completedAt?.seconds ?? 0) - (a.completedAt?.seconds ?? 0));
    cb(trips);
  });
}

// ─── Recurring Items ───

export async function addRecurringItem(uid: string, item: Omit<RecurringItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(recurringCol(uid), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecurringItem(uid: string, itemId: string, partial: Partial<RecurringItem>) {
  await updateDoc(doc(recurringCol(uid), itemId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecurringItem(uid: string, itemId: string) {
  await deleteDoc(doc(recurringCol(uid), itemId));
}

export function subscribeToRecurringItems(
  uid: string,
  cb: (items: RecurringItem[]) => void,
): Unsubscribe {
  const q = query(recurringCol(uid), where('active', '==', true));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as RecurringItem);
    cb(items);
  });
}
