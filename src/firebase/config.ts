import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getDatabase } from 'firebase/database';

// TODO: Replace with your Firebase config object from:
// Firebase Console > Project Settings > General > Your apps > Web app
const firebaseConfig = {
  apiKey: "AIzaSyDxSyLH6Q8lA8AlOQKf5CCYDEqWQ-RcMj8",
  authDomain: "sneworks-app.firebaseapp.com",
  projectId: "sneworks-app",
  storageBucket: "sneworks-app.firebasestorage.app",
  messagingSenderId: "609886492489",
  appId: "1:609886492489:web:51951d92ca430ec2a42c98",
  // Realtime Database — used only for ephemeral shared-project presence
  // (docs/SHAREABLE_PROJECTS_SPEC.md D9). RTDB_ENABLED below gates all presence code.
  databaseURL: "https://sneworks-app-default-rtdb.firebaseio.com" as string | undefined,
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const functions = getFunctions(app);

// Use memory cache — the logger already manages its own localStorage cache via writeCache/readCache.
// persistentLocalCache (IndexedDB) blocked the renderer on first write in Chrome.
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export { db };

// Connect to local emulators when running E2E tests (VITE_USE_EMULATOR=true)
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// Realtime Database — initialized lazily so a missing databaseURL doesn't crash the app.
// Call getRtdb() only when you actually need RTDB, and only after checking RTDB_ENABLED —
// presence (docs/SHAREABLE_PROJECTS_SPEC.md D9) is feature-flagged off until an instance exists.
export const RTDB_ENABLED = Boolean(firebaseConfig.databaseURL);
export const getRtdb = () => getDatabase(app);
