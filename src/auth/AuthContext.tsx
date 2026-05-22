import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

// ─── Auth hint cache ───
// Stores the last-known uid + timestamp so ProtectedRoute can render optimistically
// on refresh without waiting for Firebase to confirm the session.

const AUTH_HINT_KEY = 'sneworks_auth_hint';
const AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readAuthHint(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_HINT_KEY);
    if (!raw) return null;
    const { uid, lastCheck } = JSON.parse(raw) as { uid: string; lastCheck: number };
    if (Date.now() - lastCheck > AUTH_TTL_MS) {
      localStorage.removeItem(AUTH_HINT_KEY);
      return null;
    }
    return uid;
  } catch {
    return null;
  }
}

function saveAuthHint(uid: string): void {
  try {
    localStorage.setItem(AUTH_HINT_KEY, JSON.stringify({ uid, lastCheck: Date.now() }));
  } catch (_) {}
}

// Returns the cached uid without TTL-clearing side effects — safe to call any time.
export function getCachedUid(): string | null {
  return readAuthHint();
}

// Clears all sneworks-prefixed localStorage keys — called on logout or session expiry.
export function clearAllCache(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sneworks'))
      .forEach(k => localStorage.removeItem(k));
  } catch (_) {}
}

// ─── Context ───

type AuthContextType = {
  user: User | null;
  loading: boolean;
  // True while Firebase hasn't responded yet but the local hint says user was logged in.
  // ProtectedRoute uses this to skip the loading screen on refresh.
  optimistic: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, optimistic: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimistic] = useState(() => readAuthHint() !== null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        saveAuthHint(u.uid); // refresh lastCheck timestamp on every confirmed login
      } else {
        clearAllCache(); // logout or expired session — wipe everything
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, optimistic }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
