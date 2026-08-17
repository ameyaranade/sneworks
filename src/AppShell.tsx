import { useEffect, useRef, useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import PageSkeleton from './components/primitives/PageSkeleton';
import { useAuth, getCachedUid } from './auth/AuthContext';
import { ToastProvider } from './shared/components/Toast';
import { UIProvider, useUI } from './context/UIContext';
import { useTodosStore } from './stores/useTodosStore';
import { useGroupsStore } from './stores/useGroupsStore';
import { useLogsStore } from './stores/useLogsStore';
import { useSharedProjectsStore } from './stores/useSharedProjectsStore';
import { spawnDueRoutines, spawnDueRecurringTodos } from './firebase/routineSpawner';
import { subscribeToSettings, updateSettings } from './firebase/settingsQueries';
import { resolveTheme, getStoredThemeMode, storeThemeMode, onSystemThemeChange, type ThemeMode } from './theme';
import BottomNav from './components/nav/BottomNav';
import OnboardingSheet from './components/sheets/OnboardingSheet';
import ComposeSheet from './components/sheets/ComposeSheet';
import DeferSheet from './components/sheets/DeferSheet';
import EditRecurringSheet from './components/sheets/EditRecurringSheet';
import './app-shell.css';
import './styles/app-tokens.css';
import './styles/app-shared.css';

// Resolve the persisted theme mode to a concrete theme for first paint.
function getInitialTheme(): 'dark' | 'light' {
  return resolveTheme(getStoredThemeMode());
}

function getInitialFontScale(): string {
  try { return localStorage.getItem('sneworks-font-scale') ?? 'medium'; } catch { return 'medium'; }
}

function AppShellInner() {
  const { user } = useAuth();
  const initTodos = useTodosStore((s) => s.init);
  const initGroups = useGroupsStore((s) => s.init);
  const initLogs = useLogsStore((s) => s.init);
  const initSharedProjects = useSharedProjectsStore((s) => s.init);
  const initRanRef = useRef(false);

  const {
    composeOpen, composeMode, composeTodoType, composeLogType, composeEntry, composeGroupId,
    composeHealthPrefill,
    closeCompose,
    deferOpen, deferTodoId,
    closeDefer,
    editRecurringGroup, closeEditRecurring,
  } = useUI();

  // ── Store init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    initRanRef.current = true;
    const unsubs = [
      initTodos(uid),
      initGroups(uid),
      initLogs(uid),
      initSharedProjects(uid),
    ];
    return () => {
      unsubs.forEach((u) => u());
      initRanRef.current = false;
    };
  }, [user, initTodos, initGroups, initLogs, initSharedProjects]);

  // ── Spawn due routines once per session ─────────────────────────────────────
  const spawnRanRef = useRef(false);
  const groupsLoaded = useGroupsStore((s) => s.loaded);
  useEffect(() => {
    if (!user || !groupsLoaded || spawnRanRef.current) return;
    spawnRanRef.current = true;
    spawnDueRoutines(user.uid).catch(console.error);
    spawnDueRecurringTodos(user.uid).catch(console.error);
  }, [user, groupsLoaded]);

  // ── Onboarding — show once for users who haven't seen it ────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardingCheckedRef = useRef(false);

  const handleOnboardingDone = async () => {
    setShowOnboarding(false);
    const uid = user?.uid ?? getCachedUid();
    if (uid) {
      updateSettings(uid, { onboardingDone: true }).catch(console.error);
    }
  };

  // ── Theme — resolve mode (dark/light/system) and apply [data-theme] ──────────
  const themeRef = useRef<HTMLDivElement>(null);
  const themeModeRef = useRef<ThemeMode>(getStoredThemeMode());
  const cachedUid = user?.uid ?? getCachedUid();

  // Seed from localStorage immediately so first paint is correct
  useEffect(() => {
    if (!themeRef.current) return;
    themeRef.current.dataset.theme = getInitialTheme();
  }, []);

  // When in 'system' mode, follow live OS theme changes
  useEffect(() => {
    return onSystemThemeChange(() => {
      if (themeModeRef.current === 'system' && themeRef.current) {
        themeRef.current.dataset.theme = resolveTheme('system');
      }
    });
  }, []);

  useEffect(() => {
    if (!cachedUid) return;
    const unsub = subscribeToSettings(cachedUid, (s) => {
      if (!themeRef.current) return;
      const mode: ThemeMode = s.themeMode ?? 'system';
      themeModeRef.current = mode;
      storeThemeMode(mode);
      themeRef.current.dataset.theme = resolveTheme(mode);
      const scale = s.sbFontScale ?? 'medium';
      themeRef.current.dataset.font = scale;
      try { localStorage.setItem('sneworks-font-scale', scale); } catch (_) {}

      if (!onboardingCheckedRef.current) {
        onboardingCheckedRef.current = true;
        if (!s.onboardingDone) setShowOnboarding(true);
      }
    });
    return unsub;
  }, [cachedUid]);

  return (
    <div
      ref={themeRef}
      className="sn-shell"
      data-theme={getInitialTheme()}
      data-font={getInitialFontScale()}
    >
      <ToastProvider>
        <div className="sn-content">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>

        <BottomNav />

        {/* Portal target — sheets rendered here stay inside [data-theme] */}
        <div id="sn-portal" />

        {showOnboarding && cachedUid && (
          <OnboardingSheet uid={cachedUid} onDone={handleOnboardingDone} />
        )}

        {composeOpen && (
          <ComposeSheet
            onClose={closeCompose}
            mode={composeMode}
            editEntry={composeEntry}
            preselectedTodoType={composeTodoType}
            preselectedLogType={composeLogType}
            preselectedGroupId={composeGroupId}
            healthPrefill={composeHealthPrefill}
          />
        )}

        {deferOpen && deferTodoId && (
          <DeferSheet todoId={deferTodoId} onClose={closeDefer} />
        )}

        {editRecurringGroup && (
          <EditRecurringSheet group={editRecurringGroup} onClose={closeEditRecurring} />
        )}
      </ToastProvider>
    </div>
  );
}

export default function AppShell() {
  return (
    <UIProvider>
      <AppShellInner />
    </UIProvider>
  );
}
