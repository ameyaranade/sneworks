import type { Page } from '@playwright/test';

export const TEST_EMAIL = 'test@sneworks.test';
export const TEST_PASSWORD = 'TestPass123!';

/**
 * Sign in (or create) the test user via Firebase Auth Emulator, then navigate
 * to /tracker and wait for the tab bar to confirm the shell is ready.
 *
 * Uses page.evaluate() so the call runs inside the browser against the already-
 * initialized Firebase SDK (connected to the emulator via VITE_USE_EMULATOR=true).
 */
export async function signInAndGoToTracker(page: Page) {
  // Start at landing page so the Firebase SDK is loaded and emulator-connected
  await page.goto('/');

  await page.evaluate(
    async ({ email, password }) => {
      const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } =
        await import('firebase/auth');
      const auth = getAuth();
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch {
        // User already exists — sign in normally
        await signInWithEmailAndPassword(auth, email, password);
      }
    },
    { email: TEST_EMAIL, password: TEST_PASSWORD },
  );

  // Navigate to tracker
  await page.goto('/tracker');

  // Wait for the bottom tab bar — confirms TrackerShell + Provider are mounted
  await page.waitForSelector('.bottom-tab-bar', { timeout: 10_000 });
}

/**
 * Seed the settings document so TrackerProvider's subscribeToSettings fires.
 * Must be called AFTER sign-in (so we have a uid) and BEFORE navigating to /tracker.
 */
export async function seedSettings(page: Page) {
  await page.evaluate(async () => {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('No signed-in user when seeding settings');
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

/** Full setup: sign in → seed settings → go to tracker → wait for load. */
export async function setupTracker(page: Page) {
  await page.goto('/');
  await page.evaluate(
    async ({ email, password }) => {
      const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } =
        await import('firebase/auth');
      const auth = getAuth();
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch {
        await signInWithEmailAndPassword(auth, email, password);
      }
    },
    { email: TEST_EMAIL, password: TEST_PASSWORD },
  );
  await seedSettings(page);
  await page.goto('/tracker');
  await page.waitForSelector('.bottom-tab-bar', { timeout: 10_000 });
}
