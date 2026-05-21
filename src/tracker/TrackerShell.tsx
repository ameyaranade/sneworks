import { useState, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { TrackerProvider } from './context/TrackerProvider';
import BottomTabBar from './components/BottomTabBar';
import AddEntryDrawer from './components/AddEntryDrawer';
import { ToastProvider } from './components/Toast';
import type { Activity, ActivityType } from './types';
import './tracker-shell.css';

interface DrawerContextType {
  openDrawer: () => void;
  openDrawerWithActivity: (activity: Activity) => void;
  openDrawerWithType: (type: ActivityType) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  openDrawerWithActivity: () => {},
  openDrawerWithType: () => {},
  closeDrawer: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}

export default function TrackerShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | undefined>();
  const [initialType, setInitialType] = useState<ActivityType | undefined>();

  const openDrawer = () => {
    setActivityToEdit(undefined);
    setInitialType(undefined);
    setDrawerOpen(true);
  };
  const openDrawerWithActivity = (activity: Activity) => {
    setActivityToEdit(activity);
    setInitialType(undefined);
    setDrawerOpen(true);
  };
  const openDrawerWithType = (type: ActivityType) => {
    setActivityToEdit(undefined);
    setInitialType(type);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setActivityToEdit(undefined);
    setInitialType(undefined);
  };

  return (
    <TrackerProvider>
      <ToastProvider>
        <DrawerContext.Provider value={{ openDrawer, openDrawerWithActivity, openDrawerWithType, closeDrawer }}>
          <div className="tracker-shell">
            <div className="tracker-content">
              <Outlet />
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
