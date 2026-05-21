import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// Realtime Database — initialized lazily so a missing databaseURL doesn't crash the app.
// Call getRtdb() only when you actually need RTDB.
export const getRtdb = () => getDatabase(app);
