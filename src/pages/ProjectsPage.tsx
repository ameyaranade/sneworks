import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, ChevronRight, RotateCcw } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useGroupsStore } from '../stores/useGroupsStore';
import BottomSheet from '../components/primitives/BottomSheet';
import EmptyState from '../components/primitives/EmptyState';
import CollapsibleSection from '../components/primitives/CollapsibleSection';
import ProgressBar from '../components/primitives/ProgressBar';
import SheetFormActions from '../components/primitives/SheetFormActions';
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
      navigate(`/projects/${groupId}`);
    } catch {
      showToast('Could not create project. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New project">
      <div className="sn-projects-sheet-form">
        <input
          type="text"
          className="sn-sheet-title-input"
          placeholder="Project name"
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
      className={`sn-projects-card${group.completed ? ' sn-projects-card--done' : ''}`}
      onClick={() => navigate(`/projects/${group.id}`)}
    >
      <div className="sn-projects-card__icon">
        <FolderOpen size={16} strokeWidth={2} />
      </div>
      <div className="sn-projects-card__body">
        <span className="sn-projects-card__name">{group.name}</span>
        <span className="sn-projects-card__meta">
          {group.childCount === 0
            ? 'No tasks'
            : `${group.doneCount}/${group.childCount} done`}
        </span>
        {group.showProgress && group.childCount > 0 && (
          <ProgressBar pct={pct} />
        )}
      </div>
      <ChevronRight size={14} strokeWidth={2} className="sn-projects-card__chevron" />
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
    <div className="sn-projects-archived-row">
      <button
        type="button"
        className="sn-projects-archived-row__name-btn"
        onClick={() => navigate(`/projects/${group.id}`)}
      >
        <FolderOpen size={13} strokeWidth={2} className="sn-projects-archived-row__icon" />
        <span className="sn-projects-archived-row__name">{group.name}</span>
        <span className="sn-projects-archived-row__meta">
          {group.childCount > 0 ? `${group.doneCount}/${group.childCount}` : 'No tasks'}
        </span>
      </button>
      <button
        type="button"
        className="sn-projects-archived-row__restore"
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
    <div className="sn-projects-page">
      <div className="sn-projects-header">
        <h1 className="sn-projects-title">Projects</h1>
        <button
          type="button"
          className="sn-action-chip"
          onClick={() => setNewProjectOpen(true)}
        >
          <Plus size={14} strokeWidth={2.5} />
          New project
        </button>
      </div>

      <div className="sn-projects-body">
        {activeProjects.length === 0 ? (
          <EmptyState
            glyph="◫"
            title="No active projects."
            sub="Tap New project to track tasks and goals."
          />
        ) : (
          <div className="sn-projects-list">
            {activeProjects.map((p) => (
              <ProjectCard key={p.id} group={p} />
            ))}
          </div>
        )}

        {completedProjects.length > 0 && (
          <CollapsibleSection
            label="Completed"
            count={completedProjects.length}
            className="sn-projects-completed"
          >
            <div className="sn-projects-list sn-projects-list--completed">
              {completedProjects.map((p) => (
                <ProjectCard key={p.id} group={p} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {archivedProjects.length > 0 && (
          <CollapsibleSection
            label="Archived"
            count={archivedProjects.length}
            className="sn-projects-completed"
          >
            <div className="sn-projects-archived-list">
              {archivedProjects.map((p) => (
                <ArchivedProjectRow key={p.id} group={p} onRestore={handleRestore} />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {newProjectOpen && <NewProjectSheet onClose={() => setNewProjectOpen(false)} />}
    </div>
  );
}
