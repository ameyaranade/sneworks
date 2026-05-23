import { useState, useMemo, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { TrackerProvider } from './context/TrackerProvider';
import { DrawerContext } from './context/DrawerContext';
import BottomTabBar from './components/BottomTabBar';
import AddEntryDrawer from './components/AddEntryDrawer';
import TrackerErrorBoundary from './components/TrackerErrorBoundary';
import { ToastProvider } from './components/Toast';
import type { Activity, ActivityType, GenericReminder } from './types';
import './tracker-shell.css';

export default function TrackerShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | undefined>();
  const [reminderToEdit, setReminderToEdit] = useState<GenericReminder | undefined>();
  const [initialType, setInitialType] = useState<ActivityType | undefined>();
  const [initialDate, setInitialDate] = useState<string | undefined>();

  const openDrawer = useCallback(() => {
    setActivityToEdit(undefined);
    setReminderToEdit(undefined);
    setInitialType(undefined);
    setInitialDate(undefined);
    setDrawerOpen(true);
  }, []);

  const openDrawerWithActivity = useCallback((activity: Activity) => {
    setActivityToEdit(activity);
    setReminderToEdit(undefined);
    setInitialType(undefined);
    setInitialDate(undefined);
    setDrawerOpen(true);
  }, []);

  const openDrawerWithReminder = useCallback((reminder: GenericReminder) => {
    setReminderToEdit(reminder);
    setActivityToEdit(undefined);
    setInitialType(undefined);
    setInitialDate(undefined);
    setDrawerOpen(true);
  }, []);

  const openDrawerWithType = useCallback((type: ActivityType) => {
    setActivityToEdit(undefined);
    setReminderToEdit(undefined);
    setInitialType(type);
    setInitialDate(undefined);
    setDrawerOpen(true);
  }, []);

  const openDrawerForDate = useCallback((date: string) => {
    setActivityToEdit(undefined);
    setReminderToEdit(undefined);
    setInitialType(undefined);
    setInitialDate(date);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActivityToEdit(undefined);
    setReminderToEdit(undefined);
    setInitialType(undefined);
    setInitialDate(undefined);
  }, []);

  const drawerContextValue = useMemo(
    () => ({ openDrawer, openDrawerWithActivity, openDrawerWithReminder, openDrawerWithType, openDrawerForDate, closeDrawer }),
    [openDrawer, openDrawerWithActivity, openDrawerWithReminder, openDrawerWithType, openDrawerForDate, closeDrawer],
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
                reminderToEdit={reminderToEdit}
                initialType={initialType}
                initialDate={initialDate}
              />
            )}
          </div>
        </DrawerContext.Provider>
      </ToastProvider>
    </TrackerProvider>
  );
}
