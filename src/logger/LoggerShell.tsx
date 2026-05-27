import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ToastProvider } from '../shared/components/Toast';
import { LoggerUIProvider, useLoggerUI } from './context/LoggerUIContext';
import LoggerBottomNav from './components/primitives/LoggerBottomNav';
import FAB from './components/primitives/FAB';
import ComposeSheet from './components/sheets/ComposeSheet';
import DeferSheet from './components/sheets/DeferSheet';
import { useEntriesStore } from './stores/useEntriesStore';
import { useTypesStore } from './stores/useTypesStore';
import { useGroupsStore } from './stores/useGroupsStore';
import { useRoutinesStore } from './stores/useRoutinesStore';
import { spawnDueRoutines } from './firebase/routineQueries';
import './logger-shell.css';
import './styles/logger-tokens.css';
import './styles/logger-typography.css';

function LoggerShellInner() {
  const { user } = useAuth();
  const initEntries = useEntriesStore((s) => s.init);
  const initTypes = useTypesStore((s) => s.init);
  const initGroups = useGroupsStore((s) => s.init);
  const initRoutines = useRoutinesStore((s) => s.init);
  const routines = useRoutinesStore((s) => s.routines);
  const routinesLoaded = useRoutinesStore((s) => s.loaded);
  const spawnerRanRef = useRef(false);

  const {
    openCompose,
    composeOpen, composeEntry, composeTypeId, composeDate, composeGroupId,
    closeCompose,
    deferOpen, deferEntryId,
    closeDefer,
  } = useLoggerUI();

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubs = [
      initTypes(uid),
      initEntries(uid),
      initGroups(uid),
      initRoutines(uid),
    ];
    return () => {
      unsubs.forEach((u) => u());
      spawnerRanRef.current = false;
    };
  }, [user, initEntries, initTypes, initGroups, initRoutines]);

  // Spawn recurring entries once per day on first load
  useEffect(() => {
    if (!user || !routinesLoaded || spawnerRanRef.current) return;
    spawnerRanRef.current = true;
    if (routines.length > 0) {
      spawnDueRoutines(user.uid, routines).catch(console.error);
    }
  }, [user, routines, routinesLoaded]);

  return (
    <div className="lg-shell" data-logger-theme="dark">
      <div className="lg-content">
        <Outlet />
      </div>
      <LoggerBottomNav />
      <FAB onClick={openCompose} />

      {composeOpen && (
        <ComposeSheet
          onClose={closeCompose}
          editEntry={composeEntry}
          preselectedTypeId={composeTypeId}
          preselectedDate={composeDate}
          preselectedGroupId={composeGroupId}
        />
      )}

      {deferOpen && deferEntryId && (
        <DeferSheet
          entryId={deferEntryId}
          onClose={closeDefer}
        />
      )}
    </div>
  );
}

export default function LoggerShell() {
  return (
    <LoggerUIProvider>
      <ToastProvider>
        <LoggerShellInner />
      </ToastProvider>
    </LoggerUIProvider>
  );
}
