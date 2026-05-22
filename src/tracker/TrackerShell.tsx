import { useState, useMemo, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { TrackerProvider } from './context/TrackerProvider';
import { DrawerContext } from './context/DrawerContext';
import BottomTabBar from './components/BottomTabBar';
import AddEntryDrawer from './components/AddEntryDrawer';
import TrackerErrorBoundary from './components/TrackerErrorBoundary';
import { ToastProvider } from './components/Toast';
import type { Activity, ActivityType } from './types';
import './tracker-shell.css';

export default function TrackerShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | undefined>();
  const [initialType, setInitialType] = useState<ActivityType | undefined>();

  const openDrawer = useCallback(() => {
    setActivityToEdit(undefined);
    setInitialType(undefined);
    setDrawerOpen(true);
  }, []);

  const openDrawerWithActivity = useCallback((activity: Activity) => {
    setActivityToEdit(activity);
    setInitialType(undefined);
    setDrawerOpen(true);
  }, []);

  const openDrawerWithType = useCallback((type: ActivityType) => {
    setActivityToEdit(undefined);
    setInitialType(type);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActivityToEdit(undefined);
    setInitialType(undefined);
  }, []);

  const drawerContextValue = useMemo(
    () => ({ openDrawer, openDrawerWithActivity, openDrawerWithType, closeDrawer }),
    [openDrawer, openDrawerWithActivity, openDrawerWithType, closeDrawer],
  );

  return (
    <TrackerProvider>
      <ToastProvider>
        <DrawerContext.Provider value={drawerContextValue}>
          <div className="tracker-shell">
            <div className="tracker-content">
              <TrackerErrorBoundary>
                <Outlet />
              </TrackerErrorBoundary>
            </div>
            <BottomTabBar />

            {drawerOpen && (
              <AddEntryDrawer
                onClose={closeDrawer}
                activityToEdit={activityToEdit}
                initialType={initialType}
              />
            )}
          </div>
        </DrawerContext.Provider>
      </ToastProvider>
    </TrackerProvider>
  );
}
