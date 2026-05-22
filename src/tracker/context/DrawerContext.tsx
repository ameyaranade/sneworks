import { createContext, useContext } from 'react';
import type { Activity, ActivityType } from '../types';

export interface DrawerContextType {
  openDrawer: () => void;
  openDrawerWithActivity: (activity: Activity) => void;
  openDrawerWithType: (type: ActivityType) => void;
  closeDrawer: () => void;
}

export const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  openDrawerWithActivity: () => {},
  openDrawerWithType: () => {},
  closeDrawer: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}
