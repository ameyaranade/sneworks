import { useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, CalendarCheck } from 'lucide-react';
import type { Todo } from '../../types';
import { formatDueLabel } from '../../utils';
import SwipeableRow, { SwipeAction } from '../swipe/SwipeableRow';
import SwipeGrip from '../swipe/SwipeGrip';
import { useTodosStore } from '../../stores/useTodosStore';
import { tomorrowAt9 } from '../../stores/useTodosStore';
import { useUI } from '../../context/UIContext';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import ConfirmSheet from '../primitives/ConfirmSheet';
import './todo-row.css';

/**
 * Action surface TodoRow needs. Defaults to useTodosStore (personal todos);
 * ProjectDetailPage injects a shared-project-backed implementation
 * (useSharedProjectTodos) when rendering a shared project's task list —
 * see docs/SHAREABLE_PROJECTS_SPEC.md.
 */
export interface TodoRowActions {
  completeTodo: (uid: string, id: string) => Promise<void>;
  skipTodo: (uid: string, id: string) => Promise<void>;
  deleteTodo: (uid: string, id: string) => Promise<Todo | undefined>;
  restoreTodo: (uid: string, todo: Todo) => Promise<string>;
  markPending: (uid: string, id: string) => Promise<void>;
  deferTodo: (uid: string, id: string, newDate: Date) => Promise<void>;
  deferTodoPlusHours: (uid: string, id: string, hours: number) => Promise<void>;
}

interface TodoRowProps {
  todo: Todo;
  /** Overrides the default personal-store actions (shared-project task lists). */
  actions?: TodoRowActions;
  /** Fired with the todo id when its edit sheet is about to open, null when it's known to close (presence). */
  onEditingChange?: (todoId: string | null) => void;
  /** Extra content rendered under the title — used for the shared-project "X is editing…" indicator. */
  belowTitle?: ReactNode;
  /** True for a few seconds after another member's write lands (spec §5.3 remote-update affordance). */
  remoteUpdated?: boolean;
}

export default function TodoRow({ todo, actions, onEditingChange, belowTitle, remoteUpdated }: TodoRowProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openComposeForEdit, openDefer } = useUI();

  // Hooks always run (rules of hooks) — `actions` (shared projects) overrides the default.
  const storeCompleteTodo = useTodosStore((s) => s.completeTodo);
  const storeSkipTodo = useTodosStore((s) => s.skipTodo);
  const storeDeleteTodo = useTodosStore((s) => s.deleteTodo);
  const storeRestoreTodo = useTodosStore((s) => s.restoreTodo);
  const storeMarkPending = useTodosStore((s) => s.markPending);
  const storeDeferTodo = useTodosStore((s) => s.deferTodo);
  const storeDeferTodoPlusHours = useTodosStore((s) => s.deferTodoPlusHours);

  const completeTodo = actions?.completeTodo ?? storeCompleteTodo;
  const skipTodo = actions?.skipTodo ?? storeSkipTodo;
  const deleteTodo = actions?.deleteTodo ?? storeDeleteTodo;
  const restoreTodo = actions?.restoreTodo ?? storeRestoreTodo;
  const markPending = actions?.markPending ?? storeMarkPending;
  const deferTodo = actions?.deferTodo ?? storeDeferTodo;
  const deferTodoPlusHours = actions?.deferTodoPlusHours ?? storeDeferTodoPlusHours;

  const [confirmDelete, setConfirmDelete] = useState(false);

  const uid = user?.uid ?? getCachedUid();
  if (!uid || !todo.id) return null;
  const id = todo.id;
  const isDone = todo.status === 'done' || todo.status === 'skipped';
  // Done shopping items are the one non-swipeable case — no grip there (see below).
  const swipeDisabled = isDone && todo.todoType === 'shopping-item';
  const isOverdue =
    (todo.status === 'pending' || todo.status === 'deferred') &&
    !!todo.dueAt &&
    todo.dueAt.toMillis() < Date.now();

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleComplete = async () => {
    try {
      await completeTodo(uid, id);
    } catch {
      showToast('Could not complete. Try again.', 'error');
    }
  };

  const handleSkip = async () => {
    try {
      await skipTodo(uid, id);
      showToast('Skipped', 'info', {
        action: {
          label: 'Undo',
          onClick: () => markPending(uid, id).catch(() => showToast('Could not undo.', 'error')),
        },
        duration: 5000,
      });
    } catch {
      showToast('Could not skip. Try again.', 'error');
    }
  };

  const handleDelete = async () => {
    const deleted = await deleteTodo(uid, id).catch(() => {
      showToast('Could not delete. Try again.', 'error');
      return undefined;
    });
    if (deleted) {
      showToast('Deleted', 'info', {
        action: {
          label: 'Undo',
          onClick: () =>
            restoreTodo(uid, deleted).catch(() => showToast('Could not restore.', 'error')),
        },
        duration: 5000,
      });
    }
  };

  const handleUnmark = async () => {
    try {
      await markPending(uid, id);
    } catch {
      showToast('Could not unmark. Try again.', 'error');
    }
  };

  const handleDefer1h = async () => {
    try {
      await deferTodoPlusHours(uid, id, 1);
      showToast('+1 hour', 'info', {
        action: {
          label: 'Undo',
          onClick: () => markPending(uid, id).catch(console.error),
        },
        duration: 5000,
      });
    } catch {
      showToast('Could not defer. Try again.', 'error');
    }
  };

  const handleDeferTomorrow = async () => {
    try {
      await deferTodo(uid, id, tomorrowAt9());
      showToast('Moved to tomorrow', 'info', {
        action: {
          label: 'Undo',
          onClick: () => markPending(uid, id).catch(console.error),
        },
        duration: 5000,
      });
    } catch {
      showToast('Could not defer. Try again.', 'error');
    }
  };

  // ── Swipe config ───────────────────────────────────────────────────────────

  const handleOpenEdit = () => {
    onEditingChange?.(id);
    openComposeForEdit(todo);
  };

  const rightActions: SwipeAction[] = isDone
    ? []
    : [
        { label: '+1h', className: 'sn-swipe-action--plus1h', onTrigger: handleDefer1h },
        { label: 'Tomorrow', className: 'sn-swipe-action--tomorrow', onTrigger: handleDeferTomorrow },
        { label: 'Pick', className: 'sn-swipe-action--pick', onTrigger: () => openDefer(id) },
      ];

  const leftActions: SwipeAction[] = isDone
    ? [
        { label: 'Unmark', className: 'sn-swipe-action--unmark', onTrigger: handleUnmark },
        { label: 'Edit', className: 'sn-swipe-action--edit', onTrigger: handleOpenEdit },
        { label: 'Delete', className: 'sn-swipe-action--delete', onTrigger: () => setConfirmDelete(true) },
      ]
    : [
        { label: 'Edit', className: 'sn-swipe-action--edit', onTrigger: handleOpenEdit },
        { label: 'Skip', className: 'sn-swipe-action--skip', onTrigger: handleSkip },
        { label: 'Delete', className: 'sn-swipe-action--delete', onTrigger: () => setConfirmDelete(true) },
      ];

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const breadcrumb =
    todo.groupPath && todo.groupPath.length > 0
      ? todo.groupPath.join(' › ')
      : null;

  // ── Due label ─────────────────────────────────────────────────────────────
  const dueLabel = todo.dueAt ? formatDueLabel(todo.dueAt) : null;

  return (
    <>
    {confirmDelete && (
      <ConfirmSheet
        title="Delete task?"
        message={`"${todo.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    <SwipeableRow
      leftActions={leftActions}
      rightActions={rightActions}
      disabled={swipeDisabled}
    >
      <div
        className={[
          'sn-todo-row',
          isDone ? 'sn-todo-row--done' : '',
          isOverdue ? 'sn-todo-row--overdue' : '',
          remoteUpdated ? 'sn-todo-row--remote-updated' : '',
        ].filter(Boolean).join(' ')}
      >
        {/* Checkbox */}
        <button
          type="button"
          className={`sn-todo-checkbox${isDone ? ' sn-todo-checkbox--done' : ''}`}
          onClick={isDone ? handleUnmark : handleComplete}
          aria-label={isDone ? 'Mark pending' : 'Mark done'}
        >
          {isDone && (
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Body */}
        <div className="sn-todo-body" onClick={handleOpenEdit} role="button" tabIndex={0}>
          {breadcrumb && (
            <span className="sn-todo-breadcrumb">{breadcrumb}</span>
          )}
          <span className={`sn-todo-title${isDone ? ' sn-todo-title--done' : ''}`}>
            {todo.title}
          </span>
          {todo.notes && !isDone && (
            <span className="sn-todo-notes">{todo.notes}</span>
          )}
          {/* AI-assist outcome (functions/src/ai/processAiTask.ts) */}
          {todo.aiResult?.htmlLink ? (
            <a
              className="sn-todo-ai-link"
              href={todo.aiResult.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarCheck size={11} strokeWidth={2} />
              Calendar reminder created
            </a>
          ) : todo.aiAssist && !todo.aiProcessedAt ? (
            <span className="sn-todo-ai-pending">AI scheduling reminder…</span>
          ) : todo.aiError && todo.aiProcessedAt ? (
            <span className="sn-todo-ai-error">AI: {todo.aiError}</span>
          ) : null}
          {belowTitle}
        </div>

        {/* Right meta */}
        {dueLabel && !isDone && (
          <div className="sn-todo-meta">
            <span className={`sn-todo-due${isOverdue ? ' sn-todo-due--overdue' : ''}`}>
              <Clock size={10} strokeWidth={2} />
              {dueLabel}
            </span>
          </div>
        )}

        {/* Swipe affordance — only when the row is actually swipeable */}
        {!swipeDisabled && <SwipeGrip />}
      </div>
    </SwipeableRow>
    </>
  );
}
