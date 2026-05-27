import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive } from 'lucide-react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { useSandboxUI } from '../context/SandboxUIContext';
import SwipeableRow, { SwipeAction } from '../components/swipe/SwipeableRow';
import { Timestamp } from 'firebase/firestore';
import type { ShoppingItemTodo, Todo } from '../types';
import './group-detail-page.css';

// ── Shopping item row ──────────────────────────────────────────────────────────

interface ShopRowProps {
  todo: ShoppingItemTodo;
  priceTracking: boolean;
  onToggle: (todoId: string, isDone: boolean) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todoId: string) => void;
}

function ShopRow({ todo, priceTracking, onToggle, onEdit, onDelete }: ShopRowProps) {
  const isDone = todo.status === 'done' || todo.status === 'skipped';
  const id = todo.id!;

  const leftActions: SwipeAction[] = [
    { label: 'Edit', className: 'sb-swipe-action--edit', onTrigger: () => onEdit(todo) },
    { label: 'Delete', className: 'sb-swipe-action--delete', onTrigger: () => onDelete(id) },
  ];

  return (
    <SwipeableRow leftActions={leftActions} rightActions={[]} disabled={false}>
      <div className={`sb-shop-row${isDone ? ' sb-shop-row--done' : ''}`}>
        <button
          type="button"
          className={`sb-shop-checkbox${isDone ? ' sb-shop-checkbox--done' : ''}`}
          onClick={() => onToggle(id, isDone)}
          aria-label={isDone ? 'Uncheck' : 'Check off'}
        >
          {isDone && (
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="sb-shop-row-body">
          <span className={`sb-shop-row-title${isDone ? ' sb-shop-row-title--done' : ''}`}>
            {todo.title}
          </span>
          {todo.quantity !== undefined && todo.quantity > 1 && (
            <span className="sb-shop-row-qty">×{todo.quantity}</span>
          )}
          {todo.categoryTag && (
            <span className="sb-shop-row-tag">{todo.categoryTag}</span>
          )}
        </div>

        {priceTracking && todo.price !== undefined && (
          <span className="sb-shop-row-price">₹{todo.price}</span>
        )}
      </div>
    </SwipeableRow>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openComposeForEdit } = useSandboxUI();

  const uid = user?.uid ?? getCachedUid();

  // ── Store subscriptions ────────────────────────────────────────────────────

  const groups = useGroupsStore((s) => s.groups);
  const updateGroup = useGroupsStore((s) => s.updateGroup);

  const todos = useTodosStore((s) => s.todos);
  const completeTodo = useTodosStore((s) => s.completeTodo);
  const markPending = useTodosStore((s) => s.markPending);
  const deleteTodo = useTodosStore((s) => s.deleteTodo);
  const restoreTodo = useTodosStore((s) => s.restoreTodo);
  const addTodo = useTodosStore((s) => s.addTodo);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGroupItems = useMemo(() => getTodosForGroup(groupId ?? ''), [todos, groupId]);

  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);

  // Sort: pending first, then done; each bucket by sortOrder
  const sortedItems = useMemo(() => {
    const pending = allGroupItems.filter((t) => t.status === 'pending' || t.status === 'deferred');
    const done = allGroupItems.filter((t) => t.status === 'done' || t.status === 'skipped');
    return [
      ...pending.sort((a, b) => a.sortOrder - b.sortOrder),
      ...done.sort((a, b) => a.sortOrder - b.sortOrder),
    ];
  }, [allGroupItems]);

  const shoppingItems = sortedItems.filter(
    (t): t is ShoppingItemTodo => t.todoType === 'shopping-item',
  );

  // ── Inline add ────────────────────────────────────────────────────────────

  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddItem = useCallback(async () => {
    if (!uid || !groupId || !newTitle.trim()) return;
    setAdding(true);
    try {
      await addTodo(uid, {
        todoType: 'shopping-item',
        title: newTitle.trim(),
        groupId,
        status: 'pending',
        sortOrder: Date.now(),
      } as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>);
      setNewTitle('');
      recomputeGroupCounts(uid, groupId).catch(console.error);
    } catch {
      showToast('Could not add item. Try again.', 'error');
    } finally {
      setAdding(false);
    }
  }, [uid, groupId, newTitle, addTodo, showToast]);

  // ── Item actions ──────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (todoId: string, isDone: boolean) => {
    if (!uid || !groupId) return;
    try {
      if (isDone) {
        await markPending(uid, todoId);
      } else {
        await completeTodo(uid, todoId);
      }
      // recomputeGroupCounts is called inside completeTodo/markPending for grouped items
    } catch {
      showToast('Could not update item.', 'error');
    }
  }, [uid, groupId, completeTodo, markPending, showToast]);

  const handleDelete = useCallback(async (todoId: string) => {
    if (!uid || !groupId) return;
    const deleted = await deleteTodo(uid, todoId).catch(() => {
      showToast('Could not delete. Try again.', 'error');
      return undefined;
    });
    if (deleted) {
      recomputeGroupCounts(uid, groupId).catch(console.error);
      showToast('Deleted', 'info', {
        action: {
          label: 'Undo',
          onClick: () =>
            restoreTodo(uid, deleted).catch(() => showToast('Could not restore.', 'error')),
        },
        duration: 5000,
      });
    }
  }, [uid, groupId, deleteTodo, restoreTodo, showToast]);

  // ── Archive ────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !groupId) return;
    try {
      await updateGroup(uid, groupId, { archivedAt: Timestamp.now() });
      showToast('List archived', 'info');
      navigate('/sandbox/more');
    } catch {
      showToast('Could not archive. Try again.', 'error');
    }
  }, [uid, groupId, updateGroup, showToast, navigate]);

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!groupId || !uid) return null;

  // Group not found (might still be loading from Firestore)
  if (!group) {
    return (
      <div className="sb-gdp">
        <div className="sb-gdp-header">
          <button type="button" className="sb-gdp-back-btn" onClick={() => navigate('/sandbox/more')}>
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="sb-gdp-loading">Loading…</div>
      </div>
    );
  }

  const isShopping = group.groupKind === 'shopping-list';
  const priceTracking = isShopping && (group as { priceTrackingEnabled?: boolean }).priceTrackingEnabled === true;
  const progress = group.childCount > 0 ? group.doneCount / group.childCount : 0;
  const totalSpent = isShopping ? (group as { totalSpent?: number }).totalSpent ?? 0 : 0;

  return (
    <div className="sb-gdp">
      {/* ── Header ── */}
      <div className="sb-gdp-header">
        <button
          type="button"
          className="sb-gdp-back-btn"
          onClick={() => navigate('/sandbox/more')}
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        <div className="sb-gdp-title-wrap">
          <h1 className="sb-gdp-title">{group.name}</h1>
          {group.childCount > 0 && (
            <span className="sb-gdp-subtitle">
              {group.doneCount}/{group.childCount} done
            </span>
          )}
        </div>

        <button
          type="button"
          className="sb-gdp-archive-btn"
          onClick={handleArchive}
          aria-label="Archive list"
          title="Archive list"
        >
          <Archive size={16} strokeWidth={2} />
        </button>
      </div>

      {/* ── Progress bar ── */}
      {group.showProgress && group.childCount > 0 && (
        <div className="sb-gdp-progress-track">
          <div
            className="sb-gdp-progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* ── Inline add ── */}
      <div className="sb-gdp-add-row">
        <input
          type="text"
          className="sb-gdp-add-input"
          placeholder="Add item…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddItem();
          }}
          disabled={adding}
        />
        <button
          type="button"
          className="sb-gdp-add-btn"
          onClick={handleAddItem}
          disabled={!newTitle.trim() || adding}
        >
          Add
        </button>
      </div>

      {/* ── Item list ── */}
      <div className="sb-gdp-list">
        {shoppingItems.length === 0 ? (
          <div className="sb-gdp-empty">
            <p>No items yet.</p>
            <p>Add one above or use the form for details.</p>
          </div>
        ) : (
          shoppingItems.map((item) => (
            <ShopRow
              key={item.id}
              todo={item}
              priceTracking={priceTracking}
              onToggle={handleToggle}
              onEdit={openComposeForEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* ── Footer (price summary) ── */}
      {priceTracking && group.doneCount > 0 && (
        <div className="sb-gdp-footer">
          <span className="sb-gdp-footer-label">Total spent</span>
          <span className="sb-gdp-footer-total">₹{totalSpent.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
