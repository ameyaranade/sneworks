import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';

export interface AppSettings {
  currency: string;
  currencySymbol: string;
  darkMode: boolean;
  notificationsEnabled: boolean;
  fcmToken?: string;
  timezoneOffset?: number;
  sbFontScale?: 'small' | 'medium' | 'large';
  updatedAt: Timestamp;
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'updatedAt'> = {
  currency: 'INR',
  currencySymbol: '₹',
  darkMode: false,
  notificationsEnabled: false,
  sbFontScale: 'medium',
};

function settingsDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'preferences');
}

export async function getSettings(uid: string): Promise<AppSettings> {
  const snap = await getDoc(settingsDoc(uid));
  if (snap.exists()) return snap.data() as AppSettings;
  const defaults = { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() };
  await setDoc(settingsDoc(uid), defaults);
  return { ...DEFAULT_SETTINGS, updatedAt: Timestamp.now() };
}

export async function updateSettings(uid: string, partial: Partial<AppSettings>) {
  await setDoc(settingsDoc(uid), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToSettings(
  uid: string,
  cb: (s: AppSettings) => void,
): Unsubscribe {
  return onSnapshot(settingsDoc(uid), (snap) => {
    if (snap.exists()) cb(snap.data() as AppSettings);
  });
}
