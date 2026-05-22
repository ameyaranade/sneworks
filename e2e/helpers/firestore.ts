import type { Page } from '@playwright/test';

const FIRESTORE_EMULATOR = 'http://localhost:8080';
const PROJECT_ID = 'sneworks-app';

/**
 * Wipe ALL Firestore data in the emulator.
 * Call this in beforeEach so every test starts with a clean slate.
 */
export async function clearFirestore(page: Page) {
  await page.request.delete(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
  );
}

/**
 * Seed a Finance reminder (recurring bill) for the signed-in user.
 * Returns the created reminder ID.
 */
export async function seedFinanceReminder(
  page: Page,
  opts: { name: string; amount: number; frequency: string; dueDay: number },
): Promise<string> {
  return page.evaluate(async (o) => {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const uid = getAuth().currentUser!.uid;
    const db = getFirestore();
    const ref = await addDoc(collection(db, 'users', uid, 'reminders'), {
      type: 'finance',
      name: o.name,
      amount: o.amount,
      frequency: o.frequency,
      dueDay: o.dueDay,
      notes: '',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, opts);
}

/**
 * Seed a Grocery reminder item for the signed-in user.
 * Returns the created reminder ID.
 */
export async function seedGroceryItem(
  page: Page,
  opts: { name: string; sortOrder?: number },
): Promise<string> {
  return page.evaluate(async (o) => {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const uid = getAuth().currentUser!.uid;
    const db = getFirestore();
    const ref = await addDoc(collection(db, 'users', uid, 'reminders'), {
      type: 'grocery',
      name: o.name,
      notes: '',
      active: true,
      checked: false,
      sortOrder: o.sortOrder ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, opts);
}

/**
 * Seed a Generic reminder for the signed-in user.
 * Returns the created reminder ID.
 */
export async function seedGenericReminder(
  page: Page,
  opts: { name: string; dueDate?: string; dueTime?: string },
): Promise<string> {
  return page.evaluate(async (o) => {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const uid = getAuth().currentUser!.uid;
    const db = getFirestore();
    const ref = await addDoc(collection(db, 'users', uid, 'reminders'), {
      type: 'generic',
      name: o.name,
      notes: '',
      active: true,
      completed: false,
      dueDate: o.dueDate ?? null,
      dueTime: o.dueTime ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, opts);
}

/**
 * Re-seed the settings document after clearFirestore() wipes it.
 */
export async function seedSettings(page: Page) {
  await page.evaluate(async () => {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const uid = getAuth().currentUser!.uid;
    const db = getFirestore();
    await setDoc(doc(db, 'users', uid, 'settings', 'preferences'), {
      currency: 'INR',
      currencySymbol: '₹',
      darkMode: false,
      notificationsEnabled: false,
      updatedAt: serverTimestamp(),
    });
  });
}
