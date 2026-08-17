import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  deleteField,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type { ThemeMode } from '../theme';

/** A person the user has blocked from sending them project invites (D11). */
export interface BlockedInviter {
  uid: string;
  email: string;
  name: string;
  blockedAt: Timestamp;
}

export interface AppSettings {
  currency: string;
  currencySymbol: string;
  /** @deprecated superseded by `themeMode`; kept for back-compat reads. */
  darkMode?: boolean;
  /** 'dark' | 'light' | 'system' — defaults to 'system' (follows the OS). */
  themeMode?: ThemeMode;
  notificationsEnabled: boolean;
  fcmToken?: string;
  timezoneOffset?: number;
  sbFontScale?: 'small' | 'medium' | 'large';
  // Personal health profile — used for calorie estimation
  healthWeightKg?: number;
  summaryEnabled?: boolean;
  /** Opt-in gate for the in-app chat agent. Absent/false = feature hidden and the
   *  backend trigger no-ops. Deliberately NOT in DEFAULT_SETTINGS (off by default). */
  assistantEnabled?: boolean;
  onboardingDone?: boolean;
  /** Senders blocked from inviting this user to projects — enforced in inviteToProject (D11). */
  blockedInviters?: BlockedInviter[];
  updatedAt: Timestamp;
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'updatedAt'> = {
  currency: 'INR',
  currencySymbol: '₹',
  themeMode: 'system',
  notificationsEnabled: false,
  sbFontScale: 'medium',
  summaryEnabled: true,
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

/** Write health profile weight; pass null to clear it from Firestore. */
export async function updateHealthProfile(
  uid: string,
  profile: { healthWeightKg: number | null },
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  payload.healthWeightKg = profile.healthWeightKg ?? deleteField();
  await setDoc(settingsDoc(uid), payload, { merge: true });
}

/**
 * Removes a blocked inviter (unblock). Client-side write is safe — it's the
 * user's own settings doc and has no cross-user side effects (unlike blocking,
 * which also declines pending invites and goes through a Cloud Function).
 */
export async function unblockInviter(uid: string, senderUid: string): Promise<void> {
  const snap = await getDoc(settingsDoc(uid));
  const current = (snap.exists() ? (snap.data() as AppSettings).blockedInviters : []) ?? [];
  const next = current.filter((b) => b.uid !== senderUid);
  await setDoc(settingsDoc(uid), { blockedInviters: next, updatedAt: serverTimestamp() }, { merge: true });
}
