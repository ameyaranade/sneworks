import { createContext, useContext } from 'react';
import type { Activity, ActivityType, GenericReminder } from '../types';

export interface DrawerContextType {
  openDrawer: () => void;
  openDrawerWithActivity: (activity: Activity) => void;
  openDrawerWithReminder: (reminder: GenericReminder) => void;
  openDrawerWithType: (type: ActivityType) => void;
  openDrawerForDate: (date: string) => void;
  closeDrawer: () => void;
}

export const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  openDrawerWithActivity: () => {},
  openDrawerWithReminder: () => {},
  openDrawerWithType: () => {},
  openDrawerForDate: () => {},
  closeDrawer: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}
