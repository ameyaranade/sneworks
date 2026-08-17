import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Archive, Users, RefreshCw } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useSharedProjectsStore } from '../stores/useSharedProjectsStore';
import { useSharedProjectTodos } from '../stores/useSharedProjectTodos';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { updateSharedProject as fbUpdateSharedGroup } from '../firebase/sharedProjectQueries';
import { startPresenceHeartbeat } from '../firebase/presence';
import { RTDB_ENABLED } from '../firebase/config';
import { useUI } from '../context/UIContext';
import SwipeableRow, { SwipeAction } from '../components/swipe/SwipeableRow';
import SwipeGrip from '../components/swipe/SwipeGrip';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import ShareSheet from '../components/sheets/ShareSheet';
import SharedBadge from '../components/sharing/SharedBadge';
import PresenceAvatars, { usePresence } from '../components/sharing/PresenceAvatars';
import { Timestamp } from 'firebase/firestore';
import type { ShoppingListGroup, ShoppingItemTodo, Todo } from '../types';
import './group-detail-page.css';

// ── Shopping item row ──────────────────────────────────────────────────────────

interface ShopRowProps {
  todo: ShoppingItemTodo;
  priceTracking: boolean;
  onToggle: (todoId: string, isDone: boolean) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todoId: string) => void;
  remoteUpdated?: boolean;
}

function ShopRow({ todo, priceTracking, onToggle, onEdit, onDelete, remoteUpdated }: ShopRowProps) {
  const isDone = todo.status === 'done' || todo.status === 'skipped';
  const id = todo.id!;

  const leftActions: SwipeAction[] = [
    { label: 'Edit', className: 'sn-swipe-action--edit', onTrigger: () => onEdit(todo) },
    { label: 'Delete', className: 'sn-swipe-action--delete', onTrigger: () => onDelete(id) },
  ];

  return (
    <SwipeableRow leftActions={leftActions} rightActions={[]} disabled={false}>
      <div className={`sn-shop-row${isDone ? ' sn-shop-row--done' : ''}${remoteUpdated ? ' sn-shop-row--remote-updated' : ''}`}>
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

        <SwipeGrip />
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
  const groupsLoaded = useGroupsStore((s) => s.loaded);
  const updateGroup = useGroupsStore((s) => s.updateGroup);

  const sharedGroups = useSharedProjectsStore((s) => s.sharedProjects);
  const sharedGroupsLoaded = useSharedProjectsStore((s) => s.loaded);

  const todos = useTodosStore((s) => s.todos);
  const completeTodo = useTodosStore((s) => s.completeTodo);
  const markPending = useTodosStore((s) => s.markPending);
  const deleteTodo = useTodosStore((s) => s.deleteTodo);
  const restoreTodo = useTodosStore((s) => s.restoreTodo);
  const addTodo = useTodosStore((s) => s.addTodo);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);

  // ── Personal vs shared detection ──────────────────────────────────────────

  const personalGroup = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);
  const sharedGroupDoc = useMemo(
    () => sharedGroups.find((g) => g.id === groupId) as ShoppingListGroup | undefined,
    [sharedGroups, groupId],
  );
  const group = (sharedGroupDoc ?? personalGroup) as ShoppingListGroup | undefined;
  const isShared = !!sharedGroupDoc;
  const memberCount = isShared ? (sharedGroupDoc?.memberCount ?? 1) : 1;

  // Tracks whether the group was ever resolved as *shared* — lets the guard
  // distinguish "access revoked" from "migrating personal→shared" (D12).
  // A personal group disappearing doesn't mean revoked access; only a shared
  // group disappearing does.
  const hadSharedAccessRef = useRef(false);
  useEffect(() => {
    if (sharedGroupDoc) hadSharedAccessRef.current = true;
  }, [sharedGroupDoc]);

  // ── Shared todos hook (only when shared) ──────────────────────────────────

  const sharedTasksHook = useSharedProjectTodos(isShared ? groupId : undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const personalGroupItems = useMemo(() => getTodosForGroup(groupId ?? ''), [todos, groupId]);
  const allGroupItems = isShared ? sharedTasksHook.todos : personalGroupItems;

  const shoppingItems = useMemo(() => {
    const items = allGroupItems.filter((t): t is ShoppingItemTodo => t.todoType === 'shopping-item');
    const pending = items.filter((t) => t.status === 'pending' || t.status === 'deferred');
    const done = items.filter((t) => t.status === 'done' || t.status === 'skipped');
    return [
      ...pending.sort((a, b) => a.sortOrder - b.sortOrder),
      ...done.sort((a, b) => a.sortOrder - b.sortOrder),
    ];
  }, [allGroupItems]);

  // ── Presence (spec §5.2) — only for shared groups ─────────────────────────

  const presence = usePresence(isShared ? groupId : undefined);

  useEffect(() => {
    if (!isShared || !groupId || !uid || !RTDB_ENABLED) return;
    const name = user?.displayName ?? user?.email ?? 'Someone';
    return startPresenceHeartbeat(groupId, uid, name);
  }, [isShared, groupId, uid, user]);

  // ── Share sheet ────────────────────────────────────────────────────────────

  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // ── Pending delete confirmation ───────────────────────────────────────────

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteConfirmed = useCallback(async () => {
    const todoId = pendingDeleteId;
    setPendingDeleteId(null);
    if (!todoId || !uid || !groupId) return;

    if (isShared) {
      const deleted = await sharedTasksHook.deleteTodo(uid, todoId).catch(() => {
        showToast('Could not delete. Try again.', 'error');
        return undefined;
      });
      if (deleted) {
        showToast('Deleted', 'info', {
          action: {
            label: 'Undo',
            onClick: () =>
              sharedTasksHook.restoreTodo(uid, deleted).catch(() => showToast('Could not restore.', 'error')),
          },
          duration: 5000,
        });
      }
    } else {
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
    }
  }, [pendingDeleteId, uid, groupId, isShared, deleteTodo, restoreTodo, sharedTasksHook, showToast]);

  // ── Inline add ────────────────────────────────────────────────────────────

  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddItem = useCallback(async () => {
    if (!uid || !groupId || !newTitle.trim()) return;
    setAdding(true);
    try {
      const taskInput = {
        todoType: 'shopping-item',
        title: newTitle.trim(),
        groupId,
        status: 'pending',
        sortOrder: Date.now(),
      } as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>;

      if (isShared) {
        await sharedTasksHook.addTodo(uid, taskInput);
      } else {
        await addTodo(uid, taskInput);
        recomputeGroupCounts(uid, groupId).catch(console.error);
      }
      setNewTitle('');
    } catch {
      showToast('Could not add item. Try again.', 'error');
    } finally {
      setAdding(false);
    }
  }, [uid, groupId, newTitle, isShared, addTodo, sharedTasksHook, showToast]);

  // ── Item actions ──────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (todoId: string, isDone: boolean) => {
    if (!uid || !groupId) return;
    try {
      if (isShared) {
        if (isDone) {
          await sharedTasksHook.markPending(uid, todoId);
        } else {
          await sharedTasksHook.completeTodo(uid, todoId);
        }
      } else {
        if (isDone) {
          await markPending(uid, todoId);
        } else {
          await completeTodo(uid, todoId);
        }
      }
    } catch {
      showToast('Could not update item.', 'error');
    }
  }, [uid, groupId, isShared, completeTodo, markPending, sharedTasksHook, showToast]);

  const handleDelete = useCallback((todoId: string) => {
    setPendingDeleteId(todoId);
  }, []);

  // ── Archive ────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !groupId) return;
    try {
      if (isShared) {
        await fbUpdateSharedGroup(groupId, { archivedAt: Timestamp.now() });
      } else {
        await updateGroup(uid, groupId, { archivedAt: Timestamp.now() });
      }
      showToast('List archived', 'info');
      navigate('/more');
    } catch {
      showToast('Could not archive. Try again.', 'error');
    }
  }, [uid, groupId, isShared, updateGroup, showToast, navigate]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!groupId || !uid) return null;

  if (!group) {
    if (hadSharedAccessRef.current) {
      return (
        <div className="sn-gdp">
          <DetailPageHeader onBack={() => navigate('/more')} title="" />
          <div className="sn-gdp-gone">
            <p className="sn-gdp-gone__title">You no longer have access to this list.</p>
            <p className="sn-gdp-gone__sub">The owner may have removed you or deleted it.</p>
            <button type="button" className="sn-gdp-gone__home-btn" onClick={() => navigate('/more')}>
              Go back
            </button>
          </div>
        </div>
      );
    }

    if (groupsLoaded && sharedGroupsLoaded) {
      return (
        <div className="sn-gdp">
          <DetailPageHeader onBack={() => navigate('/more')} title="" />
          <div className="sn-gdp-loading">Not found.</div>
        </div>
      );
    }

    return (
      <div className="sn-gdp">
        <DetailPageHeader onBack={() => navigate('/more')} title="" />
        <div className="sn-gdp-loading">Loading…</div>
      </div>
    );
  }

  const isShopping = group.groupKind === 'shopping-list';
  const priceTracking = isShopping && group.priceTrackingEnabled === true;
  const progress = group.childCount > 0 ? group.doneCount / group.childCount : 0;
  const totalSpent = isShopping ? group.totalSpent ?? 0 : 0;

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
        subtitle={
          isShared && memberCount > 1 ? (
            <span className="sn-gdp-subtitle-row">
              {group.childCount > 0 ? `${group.doneCount}/${group.childCount} done` : null}
              <SharedBadge memberCount={memberCount} />
            </span>
          ) : (
            group.childCount > 0 ? `${group.doneCount}/${group.childCount} done` : undefined
          )
        }
        rightSlot={
          <>
            {isShared && <PresenceAvatars presence={presence} selfUid={uid ?? ''} />}
            <button
              type="button"
              className="sn-gdp-archive-btn"
              onClick={() => setShareSheetOpen(true)}
              aria-label="Share list"
              title="Share list"
            >
              <Users size={16} strokeWidth={2} />
            </button>
            {isShared && (
              <button
                type="button"
                className="sn-gdp-archive-btn"
                onClick={sharedTasksHook.refresh}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw size={15} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              className="sn-gdp-archive-btn"
              onClick={handleArchive}
              aria-label="Archive list"
              title="Archive list"
            >
              <Archive size={16} strokeWidth={2} />
            </button>
          </>
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
              remoteUpdated={isShared && !!item.id && sharedTasksHook.remoteUpdatedIds.has(item.id)}
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

    {/* ── Share sheet ── */}
    {shareSheetOpen && (
      <ShareSheet project={group} onClose={() => setShareSheetOpen(false)} />
    )}
    </>
  );
}
