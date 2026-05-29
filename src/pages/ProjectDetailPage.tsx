import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Archive, FolderOpen, ChevronRight, Plus, Copy } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { useUI } from '../context/UIContext';
import BottomSheet from '../components/primitives/BottomSheet';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import TodoRow from '../components/rows/TodoRow';
import { Timestamp } from 'firebase/firestore';
import type { Group, Todo } from '../types';
import './project-detail-page.css';

// ── New Sub-project Sheet ─────────────────────────────────────────────────────

interface NewSubProjectSheetProps {
  parentGroupId: string;
  parentAncestorPath: string[];
  onClose: () => void;
}

function NewSubProjectSheet({ parentGroupId, parentAncestorPath, onClose }: NewSubProjectSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addGroup = useGroupsStore((s) => s.addGroup);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const uid = user?.uid ?? getCachedUid();

  const handleCreate = async () => {
    if (!uid || !name.trim()) return;
    setSaving(true);
    try {
      await addGroup(uid, {
        groupKind: 'project',
        name: name.trim(),
        ancestorPath: [...parentAncestorPath, parentGroupId],
        parentGroupId,
        showProgress: true,
        showSumMoney: false,
        childCount: 0,
        doneCount: 0,
        completed: false,
      } as Parameters<typeof addGroup>[1]);
      showToast('Sub-project created', 'success');
      recomputeGroupCounts(uid, parentGroupId).catch(console.error);
      onClose();
    } catch {
      showToast('Could not create sub-project. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="New sub-project">
      <div className="sn-proj-sheet-form">
        <input
          type="text"
          className="sn-proj-sheet-input"
          placeholder="Sub-project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          autoFocus
          maxLength={80}
        />
        <div className="sn-proj-sheet-actions">
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

// ── Sub-project card ──────────────────────────────────────────────────────────

interface SubProjectCardProps {
  group: Group;
}

function SubProjectCard({ group }: SubProjectCardProps) {
  const navigate = useNavigate();
  const pct = group.childCount > 0
    ? Math.round((group.doneCount / group.childCount) * 100)
    : 0;

  return (
    <button
      type="button"
      className={`sn-proj-sub-card${group.completed ? ' sn-proj-sub-card--done' : ''}`}
      onClick={() => navigate(`/projects/${group.id}`)}
    >
      <div className="sn-proj-sub-card__icon">
        <FolderOpen size={14} strokeWidth={2} />
      </div>
      <div className="sn-proj-sub-card__body">
        <span className="sn-proj-sub-card__name">{group.name}</span>
        {group.childCount > 0 && (
          <div className="sn-proj-sub-card__progress-track">
            <div
              className="sn-proj-sub-card__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      {group.completed ? (
        <span className="sn-proj-sub-card__done-badge">Done</span>
      ) : (
        <span className="sn-proj-sub-card__count">
          {group.doneCount}/{group.childCount}
        </span>
      )}
      <ChevronRight size={12} strokeWidth={2} className="sn-proj-sub-card__chevron" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openComposeForGroup } = useUI();

  const uid = user?.uid ?? getCachedUid();

  // ── Store subscriptions ──────────────────────────────────────────────────

  const groups = useGroupsStore((s) => s.groups);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const getSubGroups = useGroupsStore((s) => s.getSubGroups);

  const todos = useTodosStore((s) => s.todos);
  const addTodo = useTodosStore((s) => s.addTodo);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);

  const project = useMemo(() => groups.find((g) => g.id === projectId), [groups, projectId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subGroups = useMemo(() => getSubGroups(projectId ?? ''), [groups, projectId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGroupTasks = useMemo(() => getTodosForGroup(projectId ?? ''), [todos, projectId]);

  const sortedTasks = useMemo(() => {
    const pending = allGroupTasks.filter((t) => t.status === 'pending' || t.status === 'deferred');
    const done = allGroupTasks.filter((t) => t.status === 'done' || t.status === 'skipped');
    return [
      ...pending.sort((a, b) => a.sortOrder - b.sortOrder),
      ...done.sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0)),
    ];
  }, [allGroupTasks]);

  // ── New sub-project sheet ────────────────────────────────────────────────

  const [subProjectSheetOpen, setSubProjectSheetOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);


  // ── Inline add task ──────────────────────────────────────────────────────

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const handleAddTask = useCallback(async () => {
    if (!uid || !projectId || !newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await addTodo(uid, {
        todoType: 'generic-task',
        title: newTaskTitle.trim(),
        groupId: projectId,
        status: 'pending',
        sortOrder: Date.now(),
      } as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>);
      setNewTaskTitle('');
      recomputeGroupCounts(uid, projectId).catch(console.error);
    } catch {
      showToast('Could not add task. Try again.', 'error');
    } finally {
      setAddingTask(false);
    }
  }, [uid, projectId, newTaskTitle, addTodo, showToast]);

  // ── Archive ──────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !projectId) return;
    try {
      await updateGroup(uid, projectId, { archivedAt: Timestamp.now() });
      showToast('Project archived', 'info');
      const backTo = project?.parentGroupId
        ? `/projects/${project.parentGroupId}`
        : '/more';
      navigate(backTo);
    } catch {
      showToast('Could not archive. Try again.', 'error');
    }
  }, [uid, projectId, project, updateGroup, showToast, navigate]);

  // ── Back navigation ──────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
    } else if (project?.parentGroupId) {
      navigate(`/projects/${project.parentGroupId}`);
    } else {
      navigate('/projects');
    }
  }, [project, navigate, location]);

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!projectId || !uid) return null;

  if (!project) {
    return (
      <div className="sn-proj">
        <div className="sn-proj-header">
          <button
            type="button"
            className="sn-proj-back-btn"
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="sn-proj-loading">Loading…</div>
      </div>
    );
  }

  const isTopLevel = !project.parentGroupId;
  const doneTaskCount = allGroupTasks.filter(
    (t) => t.status === 'done' || t.status === 'skipped',
  ).length;
  const doneSubGroupCount = subGroups.filter((sg) => sg.completed).length;
  const totalItems = allGroupTasks.length + subGroups.length;
  const doneItems = doneTaskCount + doneSubGroupCount;

  const handleExport = () => {
    const lines: string[] = [
      project.name,
      project.description ?? '',
      `Progress: ${doneItems}/${totalItems}`,
      '',
    ];
    if (subGroups.length > 0) {
      lines.push('Sub-projects:');
      for (const sg of subGroups) {
        lines.push(`  ${sg.completed ? '✓' : '·'} ${sg.name} (${sg.doneCount}/${sg.childCount})`);
      }
      lines.push('');
    }
    if (sortedTasks.length > 0) {
      lines.push('Tasks:');
      for (const t of sortedTasks) {
        const done = t.status === 'done' || t.status === 'skipped';
        lines.push(`  ${done ? '✓' : '○'} ${t.title}`);
      }
    }
    const text = lines.filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied to clipboard', 'success'),
      () => showToast('Could not copy', 'error'),
    );
  };
  const progress = totalItems > 0 ? doneItems / totalItems : 0;

  return (
    <>
    {confirmArchive && (
      <ConfirmSheet
        title="Archive project?"
        message={`"${project.name}" will be archived.`}
        confirmLabel="Archive"
        danger={false}
        onConfirm={() => { setConfirmArchive(false); handleArchive(); }}
        onCancel={() => setConfirmArchive(false)}
      />
    )}
    <div className="sn-proj">
      {/* ── Header ── */}
      <div className="sn-proj-header">
        <button
          type="button"
          className="sn-proj-back-btn"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        <div className="sn-proj-title-wrap">
          <h1 className="sn-proj-title">{project.name}</h1>
          {project.description ? (
            <span className="sn-proj-subtitle">{project.description}</span>
          ) : totalItems > 0 ? (
            <span className="sn-proj-subtitle">{doneItems}/{totalItems} done</span>
          ) : null}
        </div>

        <button
          type="button"
          className="sn-proj-archive-btn"
          onClick={handleExport}
          aria-label="Copy project"
          title="Copy to clipboard"
        >
          <Copy size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="sn-proj-archive-btn"
          onClick={() => setConfirmArchive(true)}
          aria-label="Archive project"
          title="Archive project"
        >
          <Archive size={16} strokeWidth={2} />
        </button>
      </div>

      {/* ── Progress bar ── */}
      {totalItems > 0 && (
        <div className="sn-proj-progress-track">
          <div
            className={`sn-proj-progress-fill${project.completed ? ' sn-proj-progress-fill--complete' : ''}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* ── Completion banner ── */}
      {project.completed && (
        <div className="sn-proj-complete-banner">
          Project complete
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="sn-proj-body">

        {/* ── Sub-projects section ── */}
        {(isTopLevel) && (
          <section className="sn-proj-section">
            <div className="sn-proj-section-header">
              <span className="sn-proj-section-title">
                Sub-projects
                {subGroups.length > 0 && (
                  <span className="sn-proj-section-count">{subGroups.length}</span>
                )}
              </span>
              <button
                type="button"
                className="sn-action-chip"
                onClick={() => setSubProjectSheetOpen(true)}
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </button>
            </div>

            {subGroups.length === 0 ? (
              <p className="sn-proj-section-empty">No sub-projects yet.</p>
            ) : (
              <div className="sn-proj-sub-list">
                {subGroups.map((sg) => (
                  <SubProjectCard key={sg.id} group={sg} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Tasks section ── */}
        <section className="sn-proj-section">
          <div className="sn-proj-section-header">
            <span className="sn-proj-section-title">
              Tasks
              {allGroupTasks.length > 0 && (
                <span className="sn-proj-section-count">{allGroupTasks.length}</span>
              )}
            </span>
            <button
              type="button"
              className="sn-action-chip"
              onClick={() => openComposeForGroup(projectId, 'generic-task')}
            >
              <Plus size={13} strokeWidth={2.5} />
              Add
            </button>
          </div>

          {/* Inline quick-add row */}
          <div className="sn-proj-add-row">
            <input
              type="text"
              className="sn-proj-add-input"
              placeholder="Quick add task…"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
              disabled={addingTask}
            />
            {newTaskTitle.trim() && (
              <button
                type="button"
                className="sn-proj-add-btn"
                onClick={handleAddTask}
                disabled={addingTask}
              >
                Add
              </button>
            )}
          </div>

          {sortedTasks.length === 0 ? (
            <p className="sn-proj-section-empty">No tasks yet.</p>
          ) : (
            <div className="sn-proj-task-list">
              {sortedTasks.map((t) => (
                <TodoRow key={t.id} todo={t} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── New sub-project sheet ── */}
      {subProjectSheetOpen && (
        <NewSubProjectSheet
          parentGroupId={projectId}
          parentAncestorPath={project.ancestorPath}
          onClose={() => setSubProjectSheetOpen(false)}
        />
      )}
    </div>
    </>
  );
}
