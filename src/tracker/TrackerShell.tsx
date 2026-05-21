import { useState, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { TrackerProvider } from './context/TrackerProvider';
import BottomTabBar from './components/BottomTabBar';
import AddEntryDrawer from './components/AddEntryDrawer';
import GoToMenu from './components/GoToMenu';
import { ToastProvider } from './components/Toast';
import type { TrackerEntry } from './types';
import './tracker-shell.css';

interface DrawerContextType {
  openDrawer: () => void;
  openDrawerWithEntry: (entry: TrackerEntry) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  openDrawerWithEntry: () => {},
  closeDrawer: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}

export default function TrackerShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<TrackerEntry | undefined>();
  const [goToOpen, setGoToOpen] = useState(false);

  const openDrawer = () => {
    setEntryToEdit(undefined);
    setDrawerOpen(true);
  };
  const openDrawerWithEntry = (entry: TrackerEntry) => {
    setEntryToEdit(entry);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setEntryToEdit(undefined);
  };

  return (
    <TrackerProvider>
      <ToastProvider>
        <DrawerContext.Provider value={{ openDrawer, openDrawerWithEntry, closeDrawer }}>
          <div className="tracker-shell">
            <div className="tracker-content">
              <Outlet />
            </div>
            <BottomTabBar onAddClick={openDrawer} onGoToClick={() => setGoToOpen(true)} />

            {drawerOpen && <AddEntryDrawer onClose={closeDrawer} entryToEdit={entryToEdit} />}
            {goToOpen && <GoToMenu onClose={() => setGoToOpen(false)} />}
          </div>
        </DrawerContext.Provider>
      </ToastProvider>
    </TrackerProvider>
  );
}
