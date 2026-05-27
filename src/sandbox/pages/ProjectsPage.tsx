import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, ChevronRight, RotateCcw } from 'lucide-react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import BottomSheet from '../components/primitives/BottomSheet';
import type { Group } from '../types';
import './projects-page.css';

// ── New Project Sheet ─────────────────────────────────────────────────────────

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
      <div className="sb-projects-sheet-form">
        <input
          type="text"
          className="sb-projects-sheet-input"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
          maxLength={80}
        />
        <div className="sb-projects-sheet-actions">
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

// ── Project card ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  group: Group;
}

function ProjectCard({ group }: ProjectCardProps) {
  const navigate = useNavigate();
  const pct = group.childCount > 0
    ? Math.round((group.doneCount / group.childCount) * 100)
    : 0;

  return (
    <button
      type="button"
      className={`sb-projects-card${group.completed ? ' sb-projects-card--done' : ''}`}
      onClick={() => navigate(`/sandbox/projects/${group.id}`)}
    >
      <div className="sb-projects-card__icon">
        <FolderOpen size={16} strokeWidth={2} />
      </div>
      <div className="sb-projects-card__body">
        <span className="sb-projects-card__name">{group.name}</span>
        <span className="sb-projects-card__meta">
          {group.childCount === 0
            ? 'No tasks'
            : `${group.doneCount}/${group.childCount} done`}
        </span>
        {group.showProgress && group.childCount > 0 && (
          <div className="sb-projects-card__progress-track">
            <div
              className="sb-projects-card__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <ChevronRight size={14} strokeWidth={2} className="sb-projects-card__chevron" />
    </button>
  );
}

// ── Archived project row ──────────────────────────────────────────────────────

interface ArchivedProjectRowProps {
  group: Group;
  onRestore: (id: string) => void;
}

function ArchivedProjectRow({ group, onRestore }: ArchivedProjectRowProps) {
  const navigate = useNavigate();
  return (
    <div className="sb-projects-archived-row">
      <button
        type="button"
        className="sb-projects-archived-row__name-btn"
        onClick={() => navigate(`/sandbox/projects/${group.id}`)}
      >
        <FolderOpen size={13} strokeWidth={2} className="sb-projects-archived-row__icon" />
        <span className="sb-projects-archived-row__name">{group.name}</span>
        <span className="sb-projects-archived-row__meta">
          {group.childCount > 0 ? `${group.doneCount}/${group.childCount}` : 'No tasks'}
        </span>
      </button>
      <button
        type="button"
        className="sb-projects-archived-row__restore"
        onClick={() => onRestore(group.id!)}
        aria-label="Restore project"
        title="Restore"
      >
        <RotateCcw size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const groups = useGroupsStore((s) => s.groups);
  const getActiveProjects = useGroupsStore((s) => s.getActiveProjects);
  const getCompletedProjects = useGroupsStore((s) => s.getCompletedProjects);
  const getArchivedProjects = useGroupsStore((s) => s.getArchivedProjects);
  const updateGroup = useGroupsStore((s) => s.updateGroup);

  const uid = user?.uid ?? getCachedUid();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeProjects = useMemo(() => getActiveProjects(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const completedProjects = useMemo(() => getCompletedProjects(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const archivedProjects = useMemo(() => getArchivedProjects(), [groups]);

  const handleRestore = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      await updateGroup(uid, id, { archivedAt: undefined });
      showToast('Project restored', 'success');
    } catch {
      showToast('Could not restore project', 'error');
    }
  }, [uid, updateGroup, showToast]);

  return (
    <div className="sb-projects-page">
      <div className="sb-projects-header">
        <h1 className="sb-projects-title">Projects</h1>
        <button
          type="button"
          className="sb-action-chip"
          onClick={() => setNewProjectOpen(true)}
        >
          <Plus size={14} strokeWidth={2.5} />
          New project
        </button>
      </div>

      <div className="sb-projects-body">
        {activeProjects.length === 0 ? (
          <div className="sb-projects-empty">
            <span className="sb-projects-empty__glyph">◫</span>
            <p className="sb-projects-empty__title">No active projects.</p>
            <p className="sb-projects-empty__sub">Tap New project to track tasks and goals.</p>
          </div>
        ) : (
          <div className="sb-projects-list">
            {activeProjects.map((p) => (
              <ProjectCard key={p.id} group={p} />
            ))}
          </div>
        )}

        {completedProjects.length > 0 && (
          <div className="sb-projects-completed">
            <button
              type="button"
              className="sb-projects-completed-toggle"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              <span>Completed</span>
              <span className="sb-projects-completed-toggle__count">{completedProjects.length}</span>
              <svg
                className={`sb-projects-completed-toggle__chevron${completedOpen ? ' sb-projects-completed-toggle__chevron--open' : ''}`}
                viewBox="0 0 12 12" width="12" height="12" fill="none"
              >
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {completedOpen && (
              <div className="sb-projects-list sb-projects-list--completed">
                {completedProjects.map((p) => (
                  <ProjectCard key={p.id} group={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {archivedProjects.length > 0 && (
          <div className="sb-projects-completed">
            <button
              type="button"
              className="sb-projects-completed-toggle"
              onClick={() => setArchivedOpen((v) => !v)}
            >
              <span>Archived</span>
              <span className="sb-projects-completed-toggle__count">{archivedProjects.length}</span>
              <svg
                className={`sb-projects-completed-toggle__chevron${archivedOpen ? ' sb-projects-completed-toggle__chevron--open' : ''}`}
                viewBox="0 0 12 12" width="12" height="12" fill="none"
              >
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {archivedOpen && (
              <div className="sb-projects-archived-list">
                {archivedProjects.map((p) => (
                  <ArchivedProjectRow key={p.id} group={p} onRestore={handleRestore} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {newProjectOpen && <NewProjectSheet onClose={() => setNewProjectOpen(false)} />}
    </div>
  );
}
