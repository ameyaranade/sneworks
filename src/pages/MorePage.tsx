import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ChevronRight, FolderOpen, Settings, LogOut, Moon, Sun, Monitor, Bell, Type, RotateCcw, Trash2, Download, Sparkles, Mail, Wand2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useSharedProjectsStore } from '../stores/useSharedProjectsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useUI } from '../context/UIContext';
import { subscribeToSettings, updateSettings, DEFAULT_SETTINGS } from '../firebase/settingsQueries';
import {
  subscribeToMyPendingInvites,
  updateSharedProject as fbUpdateSharedGroup,
  deleteSharedProject as callDeleteSharedGroup,
} from '../firebase/sharedProjectQueries';
import { exportUserDataToFile, eraseAllUserData } from '../firebase/userDataRegistry';
import type { AppSettings } from '../firebase/settingsQueries';
import BottomSheet from '../components/primitives/BottomSheet';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import CollapsibleSection from '../components/primitives/CollapsibleSection';
import ProgressBar from '../components/primitives/ProgressBar';
import SheetFormActions from '../components/primitives/SheetFormActions';
import SharedBadge from '../components/sharing/SharedBadge';
import type { ShoppingListGroup, Group } from '../types';
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
          className="sn-sheet-title-input"
          placeholder="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
          maxLength={80}
        />
        <SheetFormActions
          onCancel={onClose}
          onSave={handleCreate}
          saveLabel="Create"
          saving={saving}
          disabled={!name.trim()}
        />
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
        <span className="sn-more-group-card__name-row">
          <span className="sn-more-group-card__name">{group.name}</span>
          {group.location === 'shared' && (group.memberCount ?? 1) > 1 && (
            <SharedBadge memberCount={group.memberCount ?? 1} />
          )}
        </span>
        <span className="sn-more-group-card__meta">
          {group.childCount === 0
            ? 'Empty'
            : `${group.doneCount}/${group.childCount} done${group.totalSpent > 0 ? ` · ₹${group.totalSpent}` : ''}`}
        </span>
        {group.showProgress && group.childCount > 0 && (
          <ProgressBar pct={pct} color="success" />
        )}
      </div>
      <ChevronRight size={14} strokeWidth={2} className="sn-more-group-card__chevron" />
    </button>
  );
}

// ── Archived list row ──────────────────────────────────────────────────────────

interface ArchivedListRowProps {
  group: Group;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

function ArchivedListRow({ group, onUnarchive, onDelete }: ArchivedListRowProps) {
  return (
    <div className="sn-more-archived-row">
      <div className="sn-more-archived-row__icon">
        <ShoppingCart size={14} strokeWidth={2} />
      </div>
      <span className="sn-more-archived-row__name">{group.name}</span>
      <button
        type="button"
        className="sn-more-archived-row__action"
        onClick={() => onUnarchive(group.id!)}
        aria-label="Unarchive list"
        title="Unarchive"
      >
        <RotateCcw size={13} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="sn-more-archived-row__action sn-more-archived-row__action--delete"
        onClick={() => onDelete(group.id!)}
        aria-label="Delete list"
        title="Delete"
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Settings Sheet ────────────────────────────────────────────────────────────

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const uid = user?.uid ?? getCachedUid();
  const [settings, setSettings] = useState<Partial<AppSettings>>(DEFAULT_SETTINGS);
  const [toggling, setToggling] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSettings(uid, setSettings);
  }, [uid]);

  const handleThemeMode = (mode: 'light' | 'system' | 'dark') => {
    if (!uid) return;
    updateSettings(uid, { themeMode: mode }).catch(console.error);
  };

  const handleSummaryToggle = () => {
    if (!uid) return;
    updateSettings(uid, { summaryEnabled: !settings.summaryEnabled }).catch(console.error);
  };

  const handleAssistantToggle = () => {
    if (!uid) return;
    updateSettings(uid, { assistantEnabled: !settings.assistantEnabled }).catch(console.error);
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

  const handleExport = async () => {
    if (!uid || exporting) return;
    setExporting(true);
    try {
      await exportUserDataToFile(uid);
      showToast('Projects exported', 'success');
    } catch {
      showToast('Could not export. Try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleEraseConfirmed = async () => {
    if (!uid || erasing) return;
    setConfirmErase(false);
    setErasing(true);
    try {
      await eraseAllUserData(uid);
      onClose();
      await signOut(auth);
      navigate('/login');
    } catch {
      showToast('Could not delete data. Try again.', 'error');
      setErasing(false);
    }
  };

  const fontScale = settings.sbFontScale ?? 'medium';
  const themeMode = settings.themeMode ?? 'system';

  return (
    <>
    {confirmErase && (
      <ConfirmSheet
        title="Delete all your data?"
        message="Every todo, log, list, project and routine will be permanently deleted from your account. This cannot be undone. Export your projects first if you want a copy."
        confirmLabel="Delete everything"
        danger
        onConfirm={handleEraseConfirmed}
        onCancel={() => setConfirmErase(false)}
      />
    )}
    <BottomSheet onClose={onClose} title="Settings">
      <div className="sn-settings-sheet">
        {/* Theme mode — Light / System / Dark */}
        <div className="sn-settings-row">
          <span className="sn-settings-row__icon">
            {themeMode === 'dark'
              ? <Moon size={16} strokeWidth={2} />
              : themeMode === 'light'
              ? <Sun size={16} strokeWidth={2} />
              : <Monitor size={16} strokeWidth={2} />}
          </span>
          <span className="sn-settings-row__label">Theme</span>
          <div className="sn-settings-theme-seg" role="group" aria-label="Theme">
            {([
              { value: 'light', label: 'Light', icon: <Sun size={14} strokeWidth={2} /> },
              { value: 'system', label: 'System', icon: <Monitor size={14} strokeWidth={2} /> },
              { value: 'dark', label: 'Dark', icon: <Moon size={14} strokeWidth={2} /> },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sn-settings-theme-btn${themeMode === opt.value ? ' sn-settings-theme-btn--active' : ''}`}
                onClick={() => handleThemeMode(opt.value)}
                aria-pressed={themeMode === opt.value}
                aria-label={opt.label}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Daily summary toggle */}
        <div className="sn-settings-row">
          <span className="sn-settings-row__icon">
            <Sparkles size={16} strokeWidth={2} />
          </span>
          <span className="sn-settings-row__label">Daily summary</span>
          <button
            type="button"
            className={`sn-settings-toggle${settings.summaryEnabled !== false ? ' sn-settings-toggle--on' : ''}`}
            onClick={handleSummaryToggle}
            aria-label="Toggle daily summary"
          >
            <span className="sn-settings-toggle__knob" />
          </button>
        </div>

        {/* Assistant (chat agent) toggle — opt-in, off by default */}
        <div className="sn-settings-row">
          <span className="sn-settings-row__icon">
            <Wand2 size={16} strokeWidth={2} />
          </span>
          <span className="sn-settings-row__label">Assistant (beta)</span>
          <button
            type="button"
            className={`sn-settings-toggle${settings.assistantEnabled ? ' sn-settings-toggle--on' : ''}`}
            onClick={handleAssistantToggle}
            aria-label="Toggle assistant"
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

        {/* Your data */}
        <div className="sn-settings-divider" />
        <span className="sn-settings-section-label">Your data</span>
        <button
          type="button"
          className="sn-settings-data-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download size={15} strokeWidth={2} />
          {exporting ? 'Exporting…' : 'Export projects (JSON)'}
        </button>
        <button
          type="button"
          className="sn-settings-data-btn sn-settings-data-btn--danger"
          onClick={() => setConfirmErase(true)}
          disabled={erasing}
        >
          <Trash2 size={15} strokeWidth={2} />
          {erasing ? 'Deleting…' : 'Delete all my data'}
        </button>

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
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MorePage() {
  const [newListOpen, setNewListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const navigate = useNavigate();
  const { openComposeTodo } = useUI();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid ?? getCachedUid();

  const groups = useGroupsStore((s) => s.groups);
  const getActiveShoppingLists = useGroupsStore((s) => s.getActiveShoppingLists);
  const getArchivedShoppingLists = useGroupsStore((s) => s.getArchivedShoppingLists);
  const getActiveProjects = useGroupsStore((s) => s.getActiveProjects);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);

  const sharedGroups = useSharedProjectsStore((s) => s.sharedProjects);
  const getActiveSharedProjects = useSharedProjectsStore((s) => s.getActiveSharedProjects);
  const getActiveSharedShoppingLists = useSharedProjectsStore((s) => s.getActiveSharedShoppingLists);
  const getArchivedSharedShoppingLists = useSharedProjectsStore((s) => s.getArchivedSharedShoppingLists);

  const todos = useTodosStore((s) => s.todos);
  const getUngroupedShoppingItems = useTodosStore((s) => s.getUngroupedShoppingItems);
  const completeTodo = useTodosStore((s) => s.completeTodo);

  // Merge personal + shared shopping lists (shared lists live in sharedProjects).
  const activeLists = useMemo(
    () => [...getActiveShoppingLists(), ...getActiveSharedShoppingLists()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, sharedGroups],
  );
  // Merge personal + shared projects so counts/list match ProjectsPage (D8).
  const activeProjects = useMemo(
    () => [...getActiveProjects(), ...getActiveSharedProjects()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, sharedGroups],
  );
  const archivedLists = useMemo(
    () => [...getArchivedShoppingLists(), ...getArchivedSharedShoppingLists()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, sharedGroups],
  );

  const handleUnarchiveList = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      const isShared = sharedGroups.some((g) => g.id === id);
      if (isShared) {
        await fbUpdateSharedGroup(id, { archivedAt: undefined });
      } else {
        await updateGroup(uid, id, { archivedAt: undefined });
      }
      showToast('List restored', 'success');
    } catch {
      showToast('Could not restore list', 'error');
    }
  }, [uid, sharedGroups, updateGroup, showToast]);

  const handleDeleteListConfirmed = useCallback(async () => {
    const id = confirmDeleteListId;
    setConfirmDeleteListId(null);
    if (!id || !uid) return;
    try {
      const isShared = sharedGroups.some((g) => g.id === id);
      if (isShared) {
        await callDeleteSharedGroup(id);
      } else {
        await deleteGroup(uid, id);
      }
      showToast('List deleted', 'success');
    } catch {
      showToast('Could not delete list', 'error');
    }
  }, [confirmDeleteListId, uid, sharedGroups, deleteGroup, showToast]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ungroupedItems = useMemo(() => getUngroupedShoppingItems(), [todos]);

  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    return subscribeToMyPendingInvites(email, (invites) => setPendingInviteCount(invites.length));
  }, [user?.email]);

  // Assistant entry point is gated on the opt-in setting (off by default).
  useEffect(() => {
    if (!uid) return;
    return subscribeToSettings(uid, (s) => setAssistantEnabled(s.assistantEnabled === true));
  }, [uid]);

  const handleCheckUngrouped = async (todoId: string) => {
    if (!uid) return;
    try {
      await completeTodo(uid, todoId);
    } catch {
      showToast('Could not check item.', 'error');
    }
  };

  return (
    <>
    {confirmDeleteListId && (
      <ConfirmSheet
        title="Delete list?"
        message="This archived list and all its items will be permanently deleted."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteListConfirmed}
        onCancel={() => setConfirmDeleteListId(null)}
      />
    )}
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

        {archivedLists.length > 0 && (
          <CollapsibleSection
            label="Archived"
            count={archivedLists.length}
            className="sn-more-archived-section"
          >
            <div className="sn-more-archived-list">
              {archivedLists.map((g) => (
                <ArchivedListRow
                  key={g.id}
                  group={g}
                  onUnarchive={handleUnarchiveList}
                  onDelete={setConfirmDeleteListId}
                />
              ))}
            </div>
          </CollapsibleSection>
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

      {/* ── Projects ── */}
      <section className="sn-more-section">
        <div className="sn-more-section-header">
          <button
            type="button"
            className="sn-more-section-expand-btn"
            onClick={() => setProjectsOpen((v) => !v)}
            aria-expanded={projectsOpen}
          >
            <FolderOpen size={14} strokeWidth={2} />
            <span className="sn-more-section-title">Projects</span>
            {activeProjects.length > 0 && (
              <span className="sn-more-section-count">{activeProjects.length}</span>
            )}
            <svg
              className={`sn-collapsible-toggle__chevron${projectsOpen ? ' sn-collapsible-toggle__chevron--open' : ''}`}
              viewBox="0 0 12 12" width="12" height="12" fill="none"
            >
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {projectsOpen && (
          <div className="sn-more-group-list">
            <div className="sn-more-projects-actions">
              <button
                type="button"
                className="sn-action-chip"
                onClick={() => navigate('/projects')}
              >
                View all
              </button>
              <button
                type="button"
                className="sn-action-chip"
                onClick={() => navigate('/projects', { state: { openAdd: true } })}
              >
                <Plus size={13} strokeWidth={2.5} />
                New project
              </button>
            </div>
            {activeProjects.length === 0 ? (
              <div className="sn-more-empty">
                <p>No active projects.</p>
              </div>
            ) : (
              activeProjects.map((p) => {
                const pct = p.childCount > 0 ? Math.round((p.doneCount / p.childCount) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="sn-more-group-card"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className="sn-more-group-card__icon">
                      <FolderOpen size={16} strokeWidth={2} />
                    </div>
                    <div className="sn-more-group-card__body">
                      <span className="sn-more-group-card__name-row">
                        <span className="sn-more-group-card__name">{p.name}</span>
                        {(p as { location?: string }).location === 'shared'
                          && ((p as { memberCount?: number }).memberCount ?? 1) > 1 && (
                          <SharedBadge memberCount={(p as { memberCount?: number }).memberCount ?? 1} />
                        )}
                      </span>
                      <span className="sn-more-group-card__meta">
                        {p.childCount === 0 ? 'No tasks' : `${p.doneCount}/${p.childCount} done`}
                      </span>
                      {p.childCount > 0 && <ProgressBar pct={pct} color="accent" />}
                    </div>
                    <ChevronRight size={14} strokeWidth={2} className="sn-more-group-card__chevron" />
                  </button>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* ── Invites ── */}
      <section className="sn-more-section sn-more-section--settings">
        <button
          type="button"
          className="sn-more-settings-btn"
          onClick={() => navigate('/invites')}
        >
          <span className="sn-more-settings-btn__icon">
            <Mail size={15} strokeWidth={2} />
          </span>
          Invites
          {pendingInviteCount > 0 && (
            <span className="sn-more-invite-badge">{pendingInviteCount}</span>
          )}
        </button>
      </section>

      {/* ── Assistant (gated on opt-in setting) ── */}
      {assistantEnabled && (
        <section className="sn-more-section sn-more-section--settings">
          <button
            type="button"
            className="sn-more-settings-btn"
            onClick={() => navigate('/assistant')}
          >
            <span className="sn-more-settings-btn__icon">
              <Wand2 size={15} strokeWidth={2} />
            </span>
            Assistant
          </button>
        </section>
      )}

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
    </>
  );
}
