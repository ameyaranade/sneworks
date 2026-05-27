import { useState } from 'react';
import { CheckSquare, IndianRupee, ShoppingCart, Clock } from 'lucide-react';
import type { Todo } from '../../types';
import { formatDueLabel } from '../../utils';
import SwipeableRow, { SwipeAction } from '../swipe/SwipeableRow';
import { useTodosStore } from '../../stores/useTodosStore';
import { tomorrowAt9 } from '../../stores/useTodosStore';
import { useSandboxUI } from '../../context/SandboxUIContext';
import { useAuth, getCachedUid } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import ConfirmSheet from '../primitives/ConfirmSheet';
import './todo-row.css';

interface TodoRowProps {
  todo: Todo;
}

function TodoTypeIcon({ todoType }: { todoType: Todo['todoType'] }) {
  switch (todoType) {
    case 'money-reminder': return <IndianRupee size={13} strokeWidth={2} />;
    case 'shopping-item': return <ShoppingCart size={13} strokeWidth={2} />;
    case 'generic-task': return <CheckSquare size={13} strokeWidth={2} />;
  }
}

export default function TodoRow({ todo }: TodoRowProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openComposeForEdit, openDefer } = useSandboxUI();

  const completeTodo = useTodosStore((s) => s.completeTodo);
  const skipTodo = useTodosStore((s) => s.skipTodo);
  const deleteTodo = useTodosStore((s) => s.deleteTodo);
  const restoreTodo = useTodosStore((s) => s.restoreTodo);
  const markPending = useTodosStore((s) => s.markPending);
  const deferTodo = useTodosStore((s) => s.deferTodo);
  const deferTodoPlusHours = useTodosStore((s) => s.deferTodoPlusHours);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const uid = user?.uid ?? getCachedUid();
  if (!uid || !todo.id) return null;
  const id = todo.id;
  const isDone = todo.status === 'done' || todo.status === 'skipped';
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

  const rightActions: SwipeAction[] = isDone
    ? []
    : [
        { label: '+1h', className: 'sb-swipe-action--plus1h', onTrigger: handleDefer1h },
        { label: 'Tomorrow', className: 'sb-swipe-action--tomorrow', onTrigger: handleDeferTomorrow },
        { label: 'Pick', className: 'sb-swipe-action--pick', onTrigger: () => openDefer(id) },
      ];

  const leftActions: SwipeAction[] = isDone
    ? [
        { label: 'Unmark', className: 'sb-swipe-action--unmark', onTrigger: handleUnmark },
        { label: 'Edit', className: 'sb-swipe-action--edit', onTrigger: () => openComposeForEdit(todo) },
        { label: 'Delete', className: 'sb-swipe-action--delete', onTrigger: () => setConfirmDelete(true) },
      ]
    : [
        { label: 'Edit', className: 'sb-swipe-action--edit', onTrigger: () => openComposeForEdit(todo) },
        { label: 'Skip', className: 'sb-swipe-action--skip', onTrigger: handleSkip },
        { label: 'Delete', className: 'sb-swipe-action--delete', onTrigger: () => setConfirmDelete(true) },
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
      disabled={isDone && todo.todoType === 'shopping-item'}
    >
      <div
        className={[
          'sb-todo-row',
          isDone ? 'sb-todo-row--done' : '',
          isOverdue ? 'sb-todo-row--overdue' : '',
        ].filter(Boolean).join(' ')}
      >
        {/* Checkbox */}
        <button
          type="button"
          className={`sb-todo-checkbox${isDone ? ' sb-todo-checkbox--done' : ''}`}
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
        <div className="sb-todo-body" onClick={() => openComposeForEdit(todo)} role="button" tabIndex={0}>
          {breadcrumb && (
            <span className="sb-todo-breadcrumb">{breadcrumb}</span>
          )}
          <span className={`sb-todo-title${isDone ? ' sb-todo-title--done' : ''}`}>
            {todo.title}
          </span>
          {todo.notes && !isDone && (
            <span className="sb-todo-notes">{todo.notes}</span>
          )}
        </div>

        {/* Right meta */}
        <div className="sb-todo-meta">
          {dueLabel && !isDone && (
            <span className={`sb-todo-due${isOverdue ? ' sb-todo-due--overdue' : ''}`}>
              <Clock size={10} strokeWidth={2} />
              {dueLabel}
            </span>
          )}
          <span className="sb-todo-type-icon">
            <TodoTypeIcon todoType={todo.todoType} />
          </span>
        </div>
      </div>
    </SwipeableRow>
    </>
  );
}
