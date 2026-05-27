import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ChevronRight, Heart, FolderOpen, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useTodosStore } from '../stores/useTodosStore';
import { useSandboxUI } from '../context/SandboxUIContext';
import { subscribeToSettings, updateSettings } from '../../tracker/firebase/trackerQueries';
import BottomSheet from '../components/primitives/BottomSheet';
import type { ShoppingListGroup } from '../types';
import type { TrackerSettings } from '../../tracker/types';
import { DEFAULT_SETTINGS } from '../../tracker/constants';
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
      navigate(`/sandbox/groups/${groupId}`);
    } catch {
      showToast('Could not create list. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New shopping list">
      <div className="sb-new-list-form">
        <input
          type="text"
          className="sb-new-list-input"
          placeholder="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
          maxLength={80}
        />
        <div className="sb-new-list-actions">
          <button type="button" className="sb-compose-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sb-compose-save-btn"
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
      className="sb-more-group-card"
      onClick={() => navigate(`/sandbox/groups/${group.id}`)}
    >
      <div className="sb-more-group-card__icon">
        <ShoppingCart size={16} strokeWidth={2} />
      </div>
      <div className="sb-more-group-card__body">
        <span className="sb-more-group-card__name">{group.name}</span>
        <span className="sb-more-group-card__meta">
          {group.childCount === 0
            ? 'Empty'
            : `${group.doneCount}/${group.childCount} done${group.totalSpent > 0 ? ` · ₹${group.totalSpent}` : ''}`}
        </span>
        {group.showProgress && group.childCount > 0 && (
          <div className="sb-more-group-card__progress-track">
            <div
              className="sb-more-group-card__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <ChevronRight size={14} strokeWidth={2} className="sb-more-group-card__chevron" />
    </button>
  );
}

// ── New Project Sheet ──────────────────────────────────────────────────────────

interface NewProjectSheetProps {
  onClose: () => void;
}

function NewProjectSheet({ onClose }: NewProjectSheetProps) {
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
        groupKind: 'project',
        name: name.trim(),
        ancestorPath: [],
        showProgress: true,
        showSumMoney: false,
        childCount: 0,
        doneCount: 0,
        completed: false,
      } as Parameters<typeof addGroup>[1]);
      showToast('Project created', 'success');
      onClose();
      navigate(`/sandbox/projects/${groupId}`);
    } catch {
      showToast('Could not create project. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New project">
      <div className="sb-new-list-form">
        <input
          type="text"
          className="sb-new-list-input"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
          maxLength={80}
        />
        <div className="sb-new-list-actions">
          <button type="button" className="sb-compose-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sb-compose-save-btn"
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

// ── Project card ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  group: ShoppingListGroup;
}

function ProjectCard({ group }: ProjectCardProps) {
  const navigate = useNavigate();
  const pct = group.childCount > 0
    ? Math.round((group.doneCount / group.childCount) * 100)
    : 0;

  return (
    <button
      type="button"
      className="sb-more-group-card"
      onClick={() => navigate(`/sandbox/projects/${group.id}`)}
    >
      <div className="sb-more-group-card__icon sb-more-group-card__icon--project">
        <FolderOpen size={16} strokeWidth={2} />
      </div>
      <div className="sb-more-group-card__body">
        <span className="sb-more-group-card__name">{group.name}</span>
        <span className="sb-more-group-card__meta">
          {group.childCount === 0
            ? 'No tasks'
            : `${group.doneCount}/${group.childCount} done`}
        </span>
        {group.showProgress && group.childCount > 0 && (
          <div className="sb-more-group-card__progress-track">
            <div
              className="sb-more-group-card__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <ChevronRight size={14} strokeWidth={2} className="sb-more-group-card__chevron" />
    </button>
  );
}

// ── Settings Sheet ────────────────────────────────────────────────────────────

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid ?? getCachedUid();
  const [settings, setSettings] = useState<Partial<TrackerSettings>>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSettings(uid, setSettings);
  }, [uid]);

  const handleDarkMode = () => {
    if (!uid) return;
    updateSettings(uid, { darkMode: !settings.darkMode }).catch(console.error);
  };

  const handleLogout = async () => {
    onClose();
    await signOut(auth);
    navigate('/login');
  };

  return (
    <BottomSheet onClose={onClose} title="Settings">
      <div className="sb-settings-sheet">
        {/* Dark mode toggle */}
        <div className="sb-settings-row">
          <span className="sb-settings-row__icon">
            {settings.darkMode ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
          </span>
          <span className="sb-settings-row__label">Dark mode</span>
          <button
            type="button"
            className={`sb-settings-toggle${settings.darkMode ? ' sb-settings-toggle--on' : ''}`}
            onClick={handleDarkMode}
            aria-label="Toggle dark mode"
          >
            <span className="sb-settings-toggle__knob" />
          </button>
        </div>

        {/* Account */}
        <div className="sb-settings-divider" />
        {user && (
          <div className="sb-settings-account">
            <span className="sb-settings-account__name">
              {user.displayName ?? user.email}
            </span>
            <span className="sb-settings-account__email">
              {user.displayName ? user.email ?? '' : ''}
            </span>
          </div>
        )}
        <button type="button" className="sb-settings-logout" onClick={handleLogout}>
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
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [completedProjectsOpen, setCompletedProjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { openComposeTodo } = useSandboxUI();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid ?? getCachedUid();

  const groups = useGroupsStore((s) => s.groups);
  const getActiveShoppingLists = useGroupsStore((s) => s.getActiveShoppingLists);
  const getActiveProjects = useGroupsStore((s) => s.getActiveProjects);
  const getCompletedProjects = useGroupsStore((s) => s.getCompletedProjects);

  const todos = useTodosStore((s) => s.todos);
  const getUngroupedShoppingItems = useTodosStore((s) => s.getUngroupedShoppingItems);
  const completeTodo = useTodosStore((s) => s.completeTodo);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeLists = useMemo(() => getActiveShoppingLists(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeProjects = useMemo(() => getActiveProjects(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const completedProjects = useMemo(() => getCompletedProjects(), [groups]);
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
    <div className="sb-more-page">
      {/* ── Projects ── */}
      <section className="sb-more-section">
        <div className="sb-more-section-header">
          <span className="sb-more-section-title">Projects</span>
          <button
            type="button"
            className="sb-more-new-btn"
            onClick={() => setNewProjectOpen(true)}
            aria-label="New project"
          >
            <Plus size={14} strokeWidth={2.5} />
            New project
          </button>
        </div>

        {activeProjects.length === 0 ? (
          <div className="sb-more-empty">
            <p>No active projects.</p>
            <p>Tap New project to track tasks and goals.</p>
          </div>
        ) : (
          <div className="sb-more-group-list">
            {activeProjects.map((p) => (
              <ProjectCard key={p.id} group={p as ShoppingListGroup} />
            ))}
          </div>
        )}

        {/* ── Completed projects toggle ── */}
        {completedProjects.length > 0 && (
          <div className="sb-more-completed-section">
            <button
              type="button"
              className="sb-more-completed-toggle"
              onClick={() => setCompletedProjectsOpen((v) => !v)}
            >
              <span>Completed</span>
              <span className="sb-more-completed-toggle__count">{completedProjects.length}</span>
              <svg
                className={`sb-more-completed-toggle__chevron${completedProjectsOpen ? ' sb-more-completed-toggle__chevron--open' : ''}`}
                viewBox="0 0 12 12" width="12" height="12" fill="none"
              >
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {completedProjectsOpen && (
              <div className="sb-more-group-list sb-more-group-list--completed">
                {completedProjects.map((p) => (
                  <ProjectCard key={p.id} group={p as ShoppingListGroup} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Shopping Lists ── */}
      <section className="sb-more-section">
        <div className="sb-more-section-header">
          <span className="sb-more-section-title">Shopping lists</span>
          <button
            type="button"
            className="sb-more-new-btn"
            onClick={() => setNewListOpen(true)}
            aria-label="New list"
          >
            <Plus size={14} strokeWidth={2.5} />
            New list
          </button>
        </div>

        {activeLists.length === 0 ? (
          <div className="sb-more-empty">
            <p>No active lists.</p>
            <p>Tap New list to create one, or check off a shopping item to auto-start a trip.</p>
          </div>
        ) : (
          <div className="sb-more-group-list">
            {activeLists.map((g) => (
              <GroupCard key={g.id} group={g as ShoppingListGroup} />
            ))}
          </div>
        )}
      </section>

      {/* ── Ungrouped shopping items ── */}
      {ungroupedItems.length > 0 && (
        <section className="sb-more-section">
          <div className="sb-more-section-header">
            <span className="sb-more-section-title">Items to buy</span>
            <button
              type="button"
              className="sb-more-new-btn"
              onClick={() => openComposeTodo('shopping-item')}
              aria-label="Add item"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add item
            </button>
          </div>
          <div className="sb-more-ungrouped-list">
            {ungroupedItems.map((item) => (
              <div key={item.id} className="sb-more-ungrouped-row">
                <button
                  type="button"
                  className="sb-shop-checkbox"
                  onClick={() => handleCheckUngrouped(item.id!)}
                  aria-label="Check off"
                />
                <span className="sb-more-ungrouped-title">{item.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ungroupedItems.length === 0 && (
        <section className="sb-more-section">
          <div className="sb-more-section-header">
            <span className="sb-more-section-title">Items to buy</span>
            <button
              type="button"
              className="sb-more-new-btn"
              onClick={() => openComposeTodo('shopping-item')}
              aria-label="Add item"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add item
            </button>
          </div>
          <div className="sb-more-empty">
            <p>No ungrouped items.</p>
          </div>
        </section>
      )}

      {/* ── Health ── */}
      <section className="sb-more-section">
        <div className="sb-more-section-header">
          <span className="sb-more-section-title">Health</span>
        </div>
        <button
          type="button"
          className="sb-more-nav-card"
          onClick={() => navigate('/sandbox/health')}
        >
          <span className="sb-more-nav-card__icon sb-more-nav-card__icon--health">
            <Heart size={16} strokeWidth={2} />
          </span>
          <span className="sb-more-nav-card__body">
            <span className="sb-more-nav-card__label">Health logs</span>
            <span className="sb-more-nav-card__sub">Workouts, mood, weight</span>
          </span>
          <ChevronRight size={14} strokeWidth={2} className="sb-more-nav-card__chevron" />
        </button>
      </section>

      {/* ── Settings ── */}
      <section className="sb-more-section sb-more-section--settings">
        <button
          type="button"
          className="sb-more-settings-btn"
          onClick={() => setSettingsOpen(true)}
        >
          <span className="sb-more-settings-btn__icon">
            <Settings size={15} strokeWidth={2} />
          </span>
          Settings
        </button>
      </section>

      {newListOpen && <NewListSheet onClose={() => setNewListOpen(false)} />}
      {newProjectOpen && <NewProjectSheet onClose={() => setNewProjectOpen(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
