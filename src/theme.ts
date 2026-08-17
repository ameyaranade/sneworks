// ─── Theme mode ───────────────────────────────────────────────────────────────
// Three-way theme: 'dark' | 'light' | 'system'. 'system' follows the OS
// prefers-color-scheme and reacts live to OS changes. The resolved value
// ('dark' | 'light') is what gets written to the [data-theme] attribute.
//
// Persisted to localStorage so the very first paint (index.html inline script,
// AppShell, and the pre-auth LoginPage) is correct without waiting on Firestore.

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'sneworks-theme-mode';

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export function getStoredThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch { /* ignore */ }
  return 'system';
}

export function storeThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* ignore */ }
}

/** Subscribe to OS theme changes. Caller decides whether to react (only when
 *  the active mode is 'system'). Returns an unsubscribe function. */
export function onSystemThemeChange(cb: () => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  } catch {
    return () => {};
  }
}
