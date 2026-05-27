import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
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
  // databaseURL: "https://sneworks-app-default-rtdb.firebaseio.com", // Add when Realtime Database is needed
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Use memory cache — the logger already manages its own localStorage cache via writeCache/readCache.
// persistentLocalCache (IndexedDB) blocked the renderer on first write in Chrome.
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export { db };

// Connect to local emulators when running E2E tests (VITE_USE_EMULATOR=true)
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}

// Realtime Database — initialized lazily so a missing databaseURL doesn't crash the app.
// Call getRtdb() only when you actually need RTDB.
export const getRtdb = () => getDatabase(app);
