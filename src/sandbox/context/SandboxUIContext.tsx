import { createContext, useCallback, useContext, useState, useMemo, ReactNode } from 'react';
import type { SandboxUIContextType, Todo, Log, TodoType, LogType, ComposeMode } from '../types';

const SandboxUIContext = createContext<SandboxUIContextType>({
  composeOpen: false,
  composeMode: 'todo',
  openComposeTodo: () => {},
  openComposeLog: () => {},
  openComposeForEdit: () => {},
  openComposeForGroup: () => {},
  closeCompose: () => {},
  deferOpen: false,
  openDefer: () => {},
  closeDefer: () => {},
});

export function useSandboxUI() {
  return useContext(SandboxUIContext);
}

export function SandboxUIProvider({ children }: { children: ReactNode }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('todo');
  const [composeTodoType, setComposeTodoType] = useState<TodoType | undefined>();
  const [composeLogType, setComposeLogType] = useState<LogType | undefined>();
  const [composeEntry, setComposeEntry] = useState<Todo | Log | undefined>();
  const [composeGroupId, setComposeGroupId] = useState<string | undefined>();

  const [deferOpen, setDeferOpen] = useState(false);
  const [deferTodoId, setDeferTodoId] = useState<string | undefined>();

  const resetCompose = useCallback(() => {
    setComposeEntry(undefined);
    setComposeTodoType(undefined);
    setComposeLogType(undefined);
    setComposeGroupId(undefined);
  }, []);

  const openComposeTodo = useCallback((todoType?: TodoType) => {
    resetCompose();
    setComposeMode('todo');
    setComposeTodoType(todoType);
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeLog = useCallback((logType?: LogType) => {
    resetCompose();
    setComposeMode('log');
    setComposeLogType(logType);
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeForEdit = useCallback((entry: Todo | Log) => {
    resetCompose();
    setComposeMode('todoType' in entry ? 'todo' : 'log');
    setComposeEntry(entry);
    setComposeOpen(true);
  }, [resetCompose]);

  const openComposeForGroup = useCallback((groupId: string, todoType?: TodoType) => {
    resetCompose();
    setComposeMode('todo');
    setComposeGroupId(groupId);
    if (todoType) setComposeTodoType(todoType);
    setComposeOpen(true);
  }, [resetCompose]);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setTimeout(resetCompose, 300);
  }, [resetCompose]);

  const openDefer = useCallback((todoId: string) => {
    setDeferTodoId(todoId);
    setDeferOpen(true);
  }, []);

  const closeDefer = useCallback(() => {
    setDeferOpen(false);
    setTimeout(() => setDeferTodoId(undefined), 300);
  }, []);

  const value = useMemo(
    () => ({
      composeOpen, composeMode, composeTodoType, composeLogType, composeEntry, composeGroupId,
      openComposeTodo, openComposeLog, openComposeForEdit, openComposeForGroup, closeCompose,
      deferOpen, deferTodoId, openDefer, closeDefer,
    }),
    [
      composeOpen, composeMode, composeTodoType, composeLogType, composeEntry, composeGroupId,
      openComposeTodo, openComposeLog, openComposeForEdit, openComposeForGroup, closeCompose,
      deferOpen, deferTodoId, openDefer, closeDefer,
    ],
  );

  return (
    <SandboxUIContext.Provider value={value}>
      {children}
    </SandboxUIContext.Provider>
  );
}

export { SandboxUIContext };
