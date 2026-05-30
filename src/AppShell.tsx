import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth, getCachedUid } from './auth/AuthContext';
import { ToastProvider } from './shared/components/Toast';
import { UIProvider, useUI } from './context/UIContext';
import { useTodosStore } from './stores/useTodosStore';
import { useGroupsStore } from './stores/useGroupsStore';
import { useLogsStore } from './stores/useLogsStore';
import { spawnDueRoutines, spawnDueRecurringTodos } from './firebase/routineSpawner';
import { subscribeToSettings } from './firebase/settingsQueries';
import BottomNav from './components/nav/BottomNav';
import ComposeSheet from './components/sheets/ComposeSheet';
import DeferSheet from './components/sheets/DeferSheet';
import EditRecurringSheet from './components/sheets/EditRecurringSheet';
import './app-shell.css';
import './styles/app-tokens.css';
import './styles/app-shared.css';

// Read the persisted dark-mode hint written by TrackerProvider on login
function getInitialDark(): boolean {
  try { return localStorage.getItem('sneworks-dark') === '1'; } catch { return true; }
}

function getInitialFontScale(): string {
  try { return localStorage.getItem('sneworks-font-scale') ?? 'medium'; } catch { return 'medium'; }
}

function AppShellInner() {
  const { user } = useAuth();
  const initTodos = useTodosStore((s) => s.init);
  const initGroups = useGroupsStore((s) => s.init);
  const initLogs = useLogsStore((s) => s.init);
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
    ];
    return () => {
      unsubs.forEach((u) => u());
      initRanRef.current = false;
    };
  }, [user, initTodos, initGroups, initLogs]);

  // ── Spawn due routines once per session ─────────────────────────────────────
  const spawnRanRef = useRef(false);
  const groupsLoaded = useGroupsStore((s) => s.loaded);
  useEffect(() => {
    if (!user || !groupsLoaded || spawnRanRef.current) return;
    spawnRanRef.current = true;
    spawnDueRoutines(user.uid).catch(console.error);
    spawnDueRecurringTodos(user.uid).catch(console.error);
  }, [user, groupsLoaded]);

  // ── Dark mode — subscribe to the same settings doc as Tracker ───────────────
  const themeRef = useRef<HTMLDivElement>(null);
  const cachedUid = user?.uid ?? getCachedUid();

  // Seed from localStorage immediately so first paint is correct
  useEffect(() => {
    if (!themeRef.current) return;
    themeRef.current.dataset.theme = getInitialDark() ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    if (!cachedUid) return;
    const unsub = subscribeToSettings(cachedUid, (s) => {
      if (!themeRef.current) return;
      themeRef.current.dataset.theme = s.darkMode ? 'dark' : 'light';
      try { localStorage.setItem('sneworks-dark', s.darkMode ? '1' : '0'); } catch (_) {}
      const scale = s.sbFontScale ?? 'medium';
      themeRef.current.dataset.font = scale;
      try { localStorage.setItem('sneworks-font-scale', scale); } catch (_) {}
    });
    return unsub;
  }, [cachedUid]);

  return (
    <div
      ref={themeRef}
      className="sn-shell"
      data-theme={getInitialDark() ? 'dark' : 'light'}
      data-font={getInitialFontScale()}
    >
      <div className="sn-content">
        <Outlet />
      </div>

      <BottomNav />

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
    </div>
  );
}

export default function AppShell() {
  return (
    <UIProvider>
      <ToastProvider>
        <AppShellInner />
      </ToastProvider>
    </UIProvider>
  );
}
