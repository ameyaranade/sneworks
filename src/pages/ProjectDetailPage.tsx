import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Archive, FolderOpen, ChevronRight, Plus, Copy, Users, RefreshCw } from 'lucide-react';
import { useAuth, getCachedUid } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useSharedProjectsStore } from '../stores/useSharedProjectsStore';
import { useSharedProjectTodos } from '../stores/useSharedProjectTodos';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { addSharedSubProject, updateSharedProject as fbUpdateSharedProject } from '../firebase/sharedProjectQueries';
import { startPresenceHeartbeat, setEditingTask } from '../firebase/presence';
import { RTDB_ENABLED } from '../firebase/config';
import { useUI } from '../context/UIContext';
import BottomSheet from '../components/primitives/BottomSheet';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import ProgressBar from '../components/primitives/ProgressBar';
import SheetFormActions from '../components/primitives/SheetFormActions';
import TodoRow from '../components/rows/TodoRow';
import ShareSheet from '../components/sheets/ShareSheet';
import SharedBadge from '../components/sharing/SharedBadge';
import PresenceAvatars, { usePresence, EditingIndicator } from '../components/sharing/PresenceAvatars';
import { Timestamp } from 'firebase/firestore';
import type { Group, ProjectGroup, Todo } from '../types';
import './project-detail-page.css';

// ── New Sub-project Sheet ─────────────────────────────────────────────────────

interface NewSubProjectSheetProps {
  parent: ProjectGroup;
  isShared: boolean;
  onClose: () => void;
}

function NewSubProjectSheet({ parent, isShared, onClose }: NewSubProjectSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addGroup = useGroupsStore((s) => s.addGroup);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const uid = user?.uid ?? getCachedUid();

  const handleCreate = async () => {
    if (!uid || !name.trim() || !parent.id) return;
    setSaving(true);
    try {
      if (isShared) {
        // Server-side count recompute handles this via the onSharedTaskWrite trigger's
        // parent walk once the sub-project gets its first task; no client recompute needed.
        await addSharedSubProject(parent, name.trim());
      } else {
        await addGroup(uid, {
          groupKind: 'project',
          name: name.trim(),
          ancestorPath: [...parent.ancestorPath, parent.id],
          parentGroupId: parent.id,
          showProgress: true,
          showSumMoney: false,
          childCount: 0,
          doneCount: 0,
          completed: false,
        } as Parameters<typeof addGroup>[1]);
        recomputeGroupCounts(uid, parent.id).catch(console.error);
      }
      showToast('Sub-project created', 'success');
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
          className="sn-sheet-title-input"
          placeholder="Sub-project name"
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
          <ProgressBar pct={pct} color={group.completed ? 'success' : 'accent'} />
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
  const { openComposeForGroup, composeOpen } = useUI();

  const uid = user?.uid ?? getCachedUid();

  // ── Store subscriptions ──────────────────────────────────────────────────

  const groups = useGroupsStore((s) => s.groups);
  const groupsLoaded = useGroupsStore((s) => s.loaded);
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const getSubGroups = useGroupsStore((s) => s.getSubGroups);

  const sharedProjects = useSharedProjectsStore((s) => s.sharedProjects);
  const sharedProjectsLoaded = useSharedProjectsStore((s) => s.loaded);
  const getSharedSubGroups = useSharedProjectsStore((s) => s.getSharedSubGroups);

  const todos = useTodosStore((s) => s.todos);
  const addTodo = useTodosStore((s) => s.addTodo);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);

  // A project is either personal (users/{uid}/groups) or shared (top-level
  // sharedProjects/{pid}) — never both. See docs/SHAREABLE_PROJECTS_SPEC.md D8.
  const personalProject = useMemo(() => groups.find((g) => g.id === projectId), [groups, projectId]);
  const sharedProjectDoc = useMemo(
    () => sharedProjects.find((g) => g.id === projectId) as ProjectGroup | undefined,
    [sharedProjects, projectId],
  );
  const project = (sharedProjectDoc ?? personalProject) as ProjectGroup | undefined;
  const isShared = !!sharedProjectDoc;
  const isOwner = !isShared || sharedProjectDoc?.ownerUid === uid;
  const memberCount = isShared ? sharedProjectDoc?.memberCount ?? 1 : 1;

  // Tracks whether this view ever successfully resolved the project — lets the
  // guard below distinguish "still loading" from "access was just revoked"
  // (spec §5.3 permission-revoked state: owner removes a member mid-view).
  const hadAccessRef = useRef(false);
  useEffect(() => {
    if (project) hadAccessRef.current = true;
  }, [project]);

  const sharedTasksHook = useSharedProjectTodos(isShared ? projectId : undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const personalSubGroups = useMemo(() => getSubGroups(projectId ?? ''), [groups, projectId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sharedSubGroups = useMemo(() => getSharedSubGroups(projectId ?? ''), [sharedProjects, projectId]);
  const subGroups = isShared ? sharedSubGroups : personalSubGroups;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const personalGroupTasks = useMemo(() => getTodosForGroup(projectId ?? ''), [todos, projectId]);
  const allGroupTasks = isShared ? sharedTasksHook.todos : personalGroupTasks;

  const sortedTasks = useMemo(() => {
    const pending = allGroupTasks.filter((t) => t.status === 'pending' || t.status === 'deferred');
    const done = allGroupTasks.filter((t) => t.status === 'done' || t.status === 'skipped');
    return [
      ...pending.sort((a, b) => a.sortOrder - b.sortOrder),
      ...done.sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0)),
    ];
  }, [allGroupTasks]);

  // ── Presence (spec §5.2) — only for shared projects, only once RTDB exists ──
  const presence = usePresence(isShared ? projectId : undefined);
  const editingTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isShared || !projectId || !uid || !RTDB_ENABLED) return;
    const name = user?.displayName ?? user?.email ?? 'Someone';
    return startPresenceHeartbeat(projectId, uid, name);
  }, [isShared, projectId, uid, user]);

  // Clear the "editing" flag once the compose sheet (opened from a TodoRow) closes again.
  useEffect(() => {
    if (!isShared || !projectId || !uid || !RTDB_ENABLED) return;
    if (!composeOpen && editingTaskIdRef.current) {
      setEditingTask(projectId, uid, null);
      editingTaskIdRef.current = null;
    }
  }, [composeOpen, isShared, projectId, uid]);

  const handleEditingChange = useCallback(
    (todoId: string | null) => {
      if (!isShared || !projectId || !uid || !RTDB_ENABLED) return;
      editingTaskIdRef.current = todoId;
      setEditingTask(projectId, uid, todoId);
    },
    [isShared, projectId, uid],
  );

  // ── Sharing ────────────────────────────────────────────────────────────────

  const [shareSheetOpen, setShareSheetOpen] = useState(false);

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
      const taskInput = {
        todoType: 'generic-task',
        title: newTaskTitle.trim(),
        groupId: projectId,
        status: 'pending',
        sortOrder: Date.now(),
      } as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>;
      if (isShared) {
        // Server-side recompute (onSharedTaskWrite Cloud Function) handles counts.
        await sharedTasksHook.addTodo(uid, taskInput);
      } else {
        await addTodo(uid, taskInput);
        recomputeGroupCounts(uid, projectId).catch(console.error);
      }
      setNewTaskTitle('');
    } catch {
      showToast('Could not add task. Try again.', 'error');
    } finally {
      setAddingTask(false);
    }
  }, [uid, projectId, newTaskTitle, addTodo, showToast, isShared, sharedTasksHook]);

  // ── Archive ──────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !projectId) return;
    try {
      if (isShared) {
        await fbUpdateSharedProject(projectId, { archivedAt: Timestamp.now() });
      } else {
        await updateGroup(uid, projectId, { archivedAt: Timestamp.now() });
      }
      showToast('Project archived', 'info');
      const backTo = project?.parentGroupId
        ? `/projects/${project.parentGroupId}`
        : '/more';
      navigate(backTo);
    } catch {
      showToast('Could not archive. Try again.', 'error');
    }
  }, [uid, projectId, project, updateGroup, showToast, navigate, isShared]);

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
    // Access was revoked (owner removed us / unshared / deleted) while we were
    // viewing this project — distinct from the transient first-load state.
    if (hadAccessRef.current) {
      return (
        <div className="sn-proj">
          <DetailPageHeader onBack={() => navigate('/projects')} title="" />
          <div className="sn-proj-gone">
            <p className="sn-proj-gone__title">You no longer have access to this project.</p>
            <p className="sn-proj-gone__sub">The owner may have removed you or deleted it.</p>
            <button type="button" className="sn-proj-gone__home-btn" onClick={() => navigate('/projects')}>
              Go to Projects
            </button>
          </div>
        </div>
      );
    }

    // Both stores have loaded and we still can't find it — genuinely not found,
    // not still loading.
    if (groupsLoaded && sharedProjectsLoaded) {
      return (
        <div className="sn-proj">
          <DetailPageHeader onBack={() => navigate('/projects')} title="" />
          <div className="sn-proj-gone">
            <p className="sn-proj-gone__title">Project not found.</p>
            <p className="sn-proj-gone__sub">It may have been deleted, or you don't have access.</p>
            <button type="button" className="sn-proj-gone__home-btn" onClick={() => navigate('/projects')}>
              Go to Projects
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="sn-proj">
        <DetailPageHeader onBack={() => navigate('/projects')} title="" />
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
      <DetailPageHeader
        onBack={handleBack}
        title={project.name}
        subtitle={
          project.description || totalItems > 0 || (isShared && memberCount > 1) ? (
            <span className="sn-proj-subtitle-row">
              {project.description
                ? project.description
                : totalItems > 0
                  ? `${doneItems}/${totalItems} done`
                  : null}
              {isShared && memberCount > 1 && <SharedBadge memberCount={memberCount} />}
            </span>
          ) : undefined
        }
        rightSlot={
          <>
            {isShared && <PresenceAvatars presence={presence} selfUid={uid} />}
            <button
              type="button"
              className="sn-proj-archive-btn"
              onClick={() => setShareSheetOpen(true)}
              aria-label="Share project"
              title="Share project"
            >
              <Users size={16} strokeWidth={2} />
            </button>
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
          </>
        }
      />

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
              {isOwner && (
                <button
                  type="button"
                  className="sn-action-chip"
                  onClick={() => setSubProjectSheetOpen(true)}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Add
                </button>
              )}
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
            <div className="sn-proj-section-actions">
              {isShared && (
                <button
                  type="button"
                  className="sn-action-chip sn-action-chip--ghost"
                  onClick={sharedTasksHook.refresh}
                  aria-label="Refresh tasks"
                  title="Refresh"
                >
                  <RefreshCw size={13} strokeWidth={2.5} />
                </button>
              )}
              <button
                type="button"
                className="sn-action-chip"
                onClick={() => openComposeForGroup(projectId, 'generic-task')}
              >
                <Plus size={13} strokeWidth={2.5} />
                Add
              </button>
            </div>
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
                className="sn-inline-add-btn"
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
                <TodoRow
                  key={t.id}
                  todo={t}
                  actions={isShared ? sharedTasksHook : undefined}
                  onEditingChange={isShared ? handleEditingChange : undefined}
                  remoteUpdated={isShared && !!t.id && sharedTasksHook.remoteUpdatedIds.has(t.id)}
                  belowTitle={
                    isShared && t.id ? (
                      <EditingIndicator presence={presence} taskId={t.id} selfUid={uid} />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── New sub-project sheet ── */}
      {subProjectSheetOpen && (
        <NewSubProjectSheet
          parent={project}
          isShared={isShared}
          onClose={() => setSubProjectSheetOpen(false)}
        />
      )}

      {/* ── Share sheet ── */}
      {shareSheetOpen && (
        <ShareSheet project={project} onClose={() => setShareSheetOpen(false)} />
      )}
    </div>
    </>
  );
}
