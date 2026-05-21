import { useState, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { TrackerProvider } from './context/TrackerProvider';
import BottomTabBar from './components/BottomTabBar';
import AddEntryDrawer from './components/AddEntryDrawer';
import GoToMenu from './components/GoToMenu';
import { ToastProvider } from './components/Toast';
import type { Activity } from './types';
import './tracker-shell.css';

interface DrawerContextType {
  openDrawer: () => void;
  openDrawerWithActivity: (activity: Activity) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  openDrawerWithActivity: () => {},
  closeDrawer: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}

export default function TrackerShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | undefined>();
  const [goToOpen, setGoToOpen] = useState(false);

  const openDrawer = () => {
    setActivityToEdit(undefined);
    setDrawerOpen(true);
  };
  const openDrawerWithActivity = (activity: Activity) => {
    setActivityToEdit(activity);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setActivityToEdit(undefined);
  };

  return (
    <TrackerProvider>
      <ToastProvider>
        <DrawerContext.Provider value={{ openDrawer, openDrawerWithActivity, closeDrawer }}>
          <div className="tracker-shell">
            <div className="tracker-content">
              <Outlet />
            </div>
            <BottomTabBar onAddClick={openDrawer} onGoToClick={() => setGoToOpen(true)} />

            {drawerOpen && <AddEntryDrawer onClose={closeDrawer} activityToEdit={activityToEdit} />}
            {goToOpen && <GoToMenu onClose={() => setGoToOpen(false)} />}
          </div>
        </DrawerContext.Provider>
      </ToastProvider>
    </TrackerProvider>
  );
}
