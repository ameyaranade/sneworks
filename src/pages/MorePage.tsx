import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ChevronRight, Heart, Settings, LogOut, Moon, Sun, Bell, Type } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useUI } from '../context/UIContext';
import { subscribeToSettings, updateSettings, DEFAULT_SETTINGS } from '../firebase/settingsQueries';
import type { AppSettings } from '../firebase/settingsQueries';
import BottomSheet from '../components/primitives/BottomSheet';
import type { ShoppingListGroup } from '../types';
import './more-page.css';

// ── New List Sheet ─────────────────────────────────────────────────────────────

interface NewListSheetProps {
  onClose: () => void;
}

function NewListSheet({ onClose }: NewListSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addGroup = useGroupsStore((s) => s.addGroup);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const uid = user?.uid ?? getCachedUid();

  const handleCreate = async () => {
    if (!uid || !name.trim()) return;
    setSaving(true);
    try {
      const groupId = await addGroup(uid, {
        groupKind: 'shopping-list',
        name: name.trim(),
        priceTrackingEnabled: false,
        totalSpent: 0,
        ancestorPath: [],
        showProgress: true,
        showSumMoney: false,
        childCount: 0,
        doneCount: 0,
        completed: false,
      } as Parameters<typeof addGroup>[1]);
      showToast('List created', 'success');
      onClose();
      navigate(`/groups/${groupId}`);
    } catch {
      showToast('Could not create list. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New shopping list">
      <div className="sn-new-list-form">
        <input
          type="text"
          className="sn-new-list-input"
          placeholder="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
          maxLength={80}
        />
        <div className="sn-new-list-actions">
          <button type="button" className="sn-compose-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sn-compose-save-btn"
            disabled={!name.trim() || saving}
            onClick={handleCreate}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Group card ─────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: ShoppingListGroup;
}

function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();
  const pct = group.childCount > 0
    ? Math.round((group.doneCount / group.childCount) * 100)
    : 0;

  return (
    <button
      type="button"
      className="sn-more-group-card"
      onClick={() => navigate(`/groups/${group.id}`)}
    >
      <div className="sn-more-group-card__icon">
        <ShoppingCart size={16} strokeWidth={2} />
      </div>
      <div className="sn-more-group-card__body">
        <span className="sn-more-group-card__name">{group.name}</span>
        <span className="sn-more-group-card__meta">
          {group.childCount === 0
            ? 'Empty'
            : `${group.doneCount}/${group.childCount} done${group.totalSpent > 0 ? ` · ₹${group.totalSpent}` : ''}`}
        </span>
        {group.showProgress && group.childCount > 0 && (
          <div className="sn-more-group-card__progress-track">
            <div
              className="sn-more-group-card__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <ChevronRight size={14} strokeWidth={2} className="sn-more-group-card__chevron" />
    </button>
  );
}

// ── Settings Sheet ────────────────────────────────────────────────────────────

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid ?? getCachedUid();
  const [settings, setSettings] = useState<Partial<AppSettings>>(DEFAULT_SETTINGS);
  const [toggling, setToggling] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSettings(uid, setSettings);
  }, [uid]);

  const handleDarkMode = () => {
    if (!uid) return;
    updateSettings(uid, { darkMode: !settings.darkMode }).catch(console.error);
  };

  const handleNotifications = async () => {
    if (!uid || toggling) return;
    setToggling(true);
    setNotifError(null);
    try {
      if (!settings.notificationsEnabled) {
        const { requestNotificationPermission } = await import('../firebase/messaging');
        const token = await requestNotificationPermission();
        if (!token) {
          setNotifError('Permission denied. Enable in browser settings.');
          return;
        }
        await updateSettings(uid, {
          notificationsEnabled: true,
          fcmToken: token,
          timezoneOffset: new Date().getTimezoneOffset(),
        });
      } else {
        await updateSettings(uid, { notificationsEnabled: false, fcmToken: '' });
      }
    } catch {
      setNotifError('Failed to update notification settings.');
    } finally {
      setToggling(false);
    }
  };

  const handleFontScale = (scale: 'small' | 'medium' | 'large') => {
    if (!uid) return;
    updateSettings(uid, { sbFontScale: scale }).catch(console.error);
  };

  const handleLogout = async () => {
    onClose();
    await signOut(auth);
    navigate('/login');
  };

  const fontScale = settings.sbFontScale ?? 'medium';

  return (
    <BottomSheet onClose={onClose} title="Settings">
      <div className="sn-settings-sheet">
        {/* Dark mode toggle */}
        <div className="sn-settings-row">
          <span className="sn-settings-row__icon">
            {settings.darkMode ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
          </span>
          <span className="sn-settings-row__label">Dark mode</span>
          <button
            type="button"
            className={`sn-settings-toggle${settings.darkMode ? ' sn-settings-toggle--on' : ''}`}
            onClick={handleDarkMode}
            aria-label="Toggle dark mode"
          >
            <span className="sn-settings-toggle__knob" />
          </button>
        </div>

        {/* Font size picker */}
        <div className="sn-settings-row">
          <span className="sn-settings-row__icon">
            <Type size={16} strokeWidth={2} />
          </span>
          <span className="sn-settings-row__label">Font size</span>
          <div className="sn-settings-font-picker">
            {(['small', 'medium', 'large'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`sn-settings-font-btn${fontScale === s ? ' sn-settings-font-btn--active' : ''}`}
                onClick={() => handleFontScale(s)}
                aria-label={`Font size ${s}`}
              >
                {s === 'small' ? 'A' : s === 'medium' ? 'A' : 'A'}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications toggle */}
        <div className="sn-settings-row">
          <span className="sn-settings-row__icon">
            <Bell size={16} strokeWidth={2} />
          </span>
          <span className="sn-settings-row__label">Notifications</span>
          <button
            type="button"
            className={`sn-settings-toggle${settings.notificationsEnabled ? ' sn-settings-toggle--on' : ''}`}
            onClick={handleNotifications}
            disabled={toggling}
            aria-label="Toggle notifications"
          >
            <span className="sn-settings-toggle__knob" />
          </button>
        </div>
        {notifError && <p className="sn-settings-error">{notifError}</p>}

        {/* Account */}
        <div className="sn-settings-divider" />
        {user && (
          <div className="sn-settings-account">
            <span className="sn-settings-account__name">
              {user.displayName ?? user.email}
            </span>
            <span className="sn-settings-account__email">
              {user.displayName ? user.email ?? '' : ''}
            </span>
          </div>
        )}
        <button type="button" className="sn-settings-logout" onClick={handleLogout}>
          <LogOut size={15} strokeWidth={2} />
          Log out
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MorePage() {
  const [newListOpen, setNewListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { openComposeTodo } = useUI();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid ?? getCachedUid();

  const groups = useGroupsStore((s) => s.groups);
  const getActiveShoppingLists = useGroupsStore((s) => s.getActiveShoppingLists);

  const todos = useTodosStore((s) => s.todos);
  const getUngroupedShoppingItems = useTodosStore((s) => s.getUngroupedShoppingItems);
  const completeTodo = useTodosStore((s) => s.completeTodo);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeLists = useMemo(() => getActiveShoppingLists(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ungroupedItems = useMemo(() => getUngroupedShoppingItems(), [todos]);

  const handleCheckUngrouped = async (todoId: string) => {
    if (!uid) return;
    try {
      await completeTodo(uid, todoId);
    } catch {
      showToast('Could not check item.', 'error');
    }
  };

  return (
    <div className="sn-more-page">
      {/* ── Shopping Lists ── */}
      <section className="sn-more-section">
        <div className="sn-more-section-header">
          <span className="sn-more-section-title">Shopping lists</span>
          <button
            type="button"
            className="sn-action-chip"
            onClick={() => setNewListOpen(true)}
            aria-label="New list"
          >
            <Plus size={14} strokeWidth={2.5} />
            New list
          </button>
        </div>

        {activeLists.length === 0 ? (
          <div className="sn-more-empty">
            <p>No active lists.</p>
            <p>Tap New list to create one, or check off a shopping item to auto-start a trip.</p>
          </div>
        ) : (
          <div className="sn-more-group-list">
            {activeLists.map((g) => (
              <GroupCard key={g.id} group={g as ShoppingListGroup} />
            ))}
          </div>
        )}
      </section>

      {/* ── Ungrouped shopping items ── */}
      {ungroupedItems.length > 0 && (
        <section className="sn-more-section">
          <div className="sn-more-section-header">
            <span className="sn-more-section-title">Items to buy</span>
            <button
              type="button"
              className="sn-action-chip"
              onClick={() => openComposeTodo('shopping-item')}
              aria-label="Add item"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add item
            </button>
          </div>
          <div className="sn-more-ungrouped-list">
            {ungroupedItems.map((item) => (
              <div key={item.id} className="sn-more-ungrouped-row">
                <button
                  type="button"
                  className="sn-shop-checkbox"
                  onClick={() => handleCheckUngrouped(item.id!)}
                  aria-label="Check off"
                />
                <span className="sn-more-ungrouped-title">{item.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ungroupedItems.length === 0 && (
        <section className="sn-more-section">
          <div className="sn-more-section-header">
            <span className="sn-more-section-title">Items to buy</span>
            <button
              type="button"
              className="sn-action-chip"
              onClick={() => openComposeTodo('shopping-item')}
              aria-label="Add item"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add item
            </button>
          </div>
          <div className="sn-more-empty">
            <p>No ungrouped items.</p>
          </div>
        </section>
      )}

      {/* ── Health ── */}
      <section className="sn-more-section">
        <div className="sn-more-section-header">
          <span className="sn-more-section-title">Health</span>
        </div>
        <button
          type="button"
          className="sn-more-nav-card"
          onClick={() => navigate('/health')}
        >
          <span className="sn-more-nav-card__icon sn-more-nav-card__icon--health">
            <Heart size={16} strokeWidth={2} />
          </span>
          <span className="sn-more-nav-card__body">
            <span className="sn-more-nav-card__label">Health logs</span>
            <span className="sn-more-nav-card__sub">Workouts, mood, weight</span>
          </span>
          <ChevronRight size={14} strokeWidth={2} className="sn-more-nav-card__chevron" />
        </button>
      </section>

      {/* ── Settings ── */}
      <section className="sn-more-section sn-more-section--settings">
        <button
          type="button"
          className="sn-more-settings-btn"
          onClick={() => setSettingsOpen(true)}
        >
          <span className="sn-more-settings-btn__icon">
            <Settings size={15} strokeWidth={2} />
          </span>
          Settings
        </button>
      </section>

      {newListOpen && <NewListSheet onClose={() => setNewListOpen(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
