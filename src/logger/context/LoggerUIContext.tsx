import { createContext, useCallback, useContext, useState, useMemo, ReactNode } from 'react';
import type { Entry, LoggerUIContextType } from '../types';

const LoggerUIContext = createContext<LoggerUIContextType>({
  composeOpen: false,
  openCompose: () => {},
  openComposeWithType: () => {},
  openComposeForEdit: () => {},
  openComposeForDate: () => {},
  openComposeForGroup: () => {},
  closeCompose: () => {},
  deferOpen: false,
  openDefer: () => {},
  closeDefer: () => {},
});

export function useLoggerUI() {
  return useContext(LoggerUIContext);
}

export function LoggerUIProvider({ children }: { children: ReactNode }) {
  // Compose sheet state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeEntry, setComposeEntry] = useState<Entry | undefined>();
  const [composeTypeId, setComposeTypeId] = useState<string | undefined>();
  const [composeDate, setComposeDate] = useState<Date | undefined>();
  const [composeGroupId, setComposeGroupId] = useState<string | undefined>();

  // Defer sheet state
  const [deferOpen, setDeferOpen] = useState(false);
  const [deferEntryId, setDeferEntryId] = useState<string | undefined>();

  const resetCompose = useCallback(() => {
    setComposeEntry(undefined);
    setComposeTypeId(undefined);
    setComposeDate(undefined);
    setComposeGroupId(undefined);
  }, []);

  const openCompose = useCallback(() => {
    resetCompose();
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeWithType = useCallback((typeId: string) => {
    resetCompose();
    setComposeTypeId(typeId);
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeForEdit = useCallback((entry: Entry) => {
    resetCompose();
    setComposeEntry(entry);
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeForDate = useCallback((date: Date) => {
    resetCompose();
    setComposeDate(date);
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeForGroup = useCallback((groupId: string) => {
    resetCompose();
    setComposeGroupId(groupId);
    setComposeOpen(true);
  }, [resetCompose]);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setTimeout(resetCompose, 300); // clear after animation
  }, [resetCompose]);

  const openDefer = useCallback((entryId: string) => {
    setDeferEntryId(entryId);
    setDeferOpen(true);
  }, []);

  const closeDefer = useCallback(() => {
    setDeferOpen(false);
    setTimeout(() => setDeferEntryId(undefined), 300);
  }, []);

  const value = useMemo(
    () => ({
      composeOpen,
      composeEntry,
      composeTypeId,
      composeDate,
      composeGroupId,
      openCompose,
      openComposeWithType,
      openComposeForEdit,
      openComposeForDate,
      openComposeForGroup,
      closeCompose,
      deferOpen,
      deferEntryId,
      openDefer,
      closeDefer,
    }),
    [
      composeOpen, composeEntry, composeTypeId, composeDate, composeGroupId,
      openCompose, openComposeWithType, openComposeForEdit, openComposeForDate, openComposeForGroup, closeCompose,
      deferOpen, deferEntryId, openDefer, closeDefer,
    ],
  );

  return (
    <LoggerUIContext.Provider value={value}>
      {children}
    </LoggerUIContext.Provider>
  );
}

export { LoggerUIContext };
