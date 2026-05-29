import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Archive } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { useUI } from '../context/UIContext';
import SwipeableRow, { SwipeAction } from '../components/swipe/SwipeableRow';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
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
    { label: 'Edit', className: 'sn-swipe-action--edit', onTrigger: () => onEdit(todo) },
    { label: 'Delete', className: 'sn-swipe-action--delete', onTrigger: () => onDelete(id) },
  ];

  return (
    <SwipeableRow leftActions={leftActions} rightActions={[]} disabled={false}>
      <div className={`sn-shop-row${isDone ? ' sn-shop-row--done' : ''}`}>
        <button
          type="button"
          className={`sn-shop-checkbox${isDone ? ' sn-shop-checkbox--done' : ''}`}
          onClick={() => onToggle(id, isDone)}
          aria-label={isDone ? 'Uncheck' : 'Check off'}
        >
          {isDone && (
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="sn-shop-row-body">
          <span className={`sn-shop-row-title${isDone ? ' sn-shop-row-title--done' : ''}`}>
            {todo.title}
          </span>
          {todo.quantity !== undefined && todo.quantity > 1 && (
            <span className="sn-shop-row-qty">×{todo.quantity}</span>
          )}
          {todo.categoryTag && (
            <span className="sn-shop-row-tag">{todo.categoryTag}</span>
          )}
        </div>

        {priceTracking && todo.price !== undefined && (
          <span className="sn-shop-row-price">₹{todo.price}</span>
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
  const { openComposeForEdit } = useUI();

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

  // ── Pending delete confirmation ───────────────────────────────────────────

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteConfirmed = useCallback(async () => {
    const todoId = pendingDeleteId;
    setPendingDeleteId(null);
    if (!todoId || !uid || !groupId) return;
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
  }, [pendingDeleteId, uid, groupId, deleteTodo, restoreTodo, showToast]);

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

  const handleDelete = useCallback((todoId: string) => {
    setPendingDeleteId(todoId);
  }, []);

  // ── Archive ────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !groupId) return;
    try {
      await updateGroup(uid, groupId, { archivedAt: Timestamp.now() });
      showToast('List archived', 'info');
      navigate('/more');
    } catch {
      showToast('Could not archive. Try again.', 'error');
    }
  }, [uid, groupId, updateGroup, showToast, navigate]);

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!groupId || !uid) return null;

  // Group not found (might still be loading from Firestore)
  if (!group) {
    return (
      <div className="sn-gdp">
        <DetailPageHeader onBack={() => navigate('/more')} title="" />
        <div className="sn-gdp-loading">Loading…</div>
      </div>
    );
  }

  const isShopping = group.groupKind === 'shopping-list';
  const priceTracking = isShopping && (group as { priceTrackingEnabled?: boolean }).priceTrackingEnabled === true;
  const progress = group.childCount > 0 ? group.doneCount / group.childCount : 0;
  const totalSpent = isShopping ? (group as { totalSpent?: number }).totalSpent ?? 0 : 0;

  return (
    <>
    {pendingDeleteId && (
      <ConfirmSheet
        title="Delete item?"
        message="This item will be removed from the list."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDeleteId(null)}
      />
    )}
    <div className="sn-gdp">
      {/* ── Header ── */}
      <DetailPageHeader
        onBack={() => navigate('/more')}
        title={group.name}
        subtitle={group.childCount > 0 ? `${group.doneCount}/${group.childCount} done` : undefined}
        rightSlot={
          <button
            type="button"
            className="sn-gdp-archive-btn"
            onClick={handleArchive}
            aria-label="Archive list"
            title="Archive list"
          >
            <Archive size={16} strokeWidth={2} />
          </button>
        }
      />

      {/* ── Progress bar ── */}
      {group.showProgress && group.childCount > 0 && (
        <div className="sn-gdp-progress-track">
          <div
            className="sn-gdp-progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* ── Inline add ── */}
      <div className="sn-gdp-add-row">
        <input
          type="text"
          className="sn-gdp-add-input"
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
          className="sn-inline-add-btn"
          onClick={handleAddItem}
          disabled={!newTitle.trim() || adding}
        >
          Add
        </button>
      </div>

      {/* ── Item list ── */}
      <div className="sn-gdp-list">
        {shoppingItems.length === 0 ? (
          <div className="sn-gdp-empty">
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
        <div className="sn-gdp-footer">
          <span className="sn-gdp-footer-label">Total spent</span>
          <span className="sn-gdp-footer-total">₹{totalSpent.toFixed(2)}</span>
        </div>
      )}
    </div>
    </>
  );
}
