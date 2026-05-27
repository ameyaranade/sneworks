import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive, Flame, Pencil, Check, X, Plus } from 'lucide-react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { recomputeGroupCounts } from '../firebase/groupQueries';
import { recurrenceLabel } from '../firebase/routineSpawner';
import { Timestamp } from 'firebase/firestore';
import TodoRow from '../components/rows/TodoRow';
import type { RoutineGroup, TemplateItem } from '../types';
import './routine-detail-page.css';

export default function RoutineDetailPage() {
  const { routineId } = useParams<{ routineId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const uid = user?.uid ?? getCachedUid();

  // ── Store subscriptions ────────────────────────────────────────────────────

  const groups = useGroupsStore((s) => s.groups);
  const updateGroup = useGroupsStore((s) => s.updateGroup);

  const todos = useTodosStore((s) => s.todos);
  const addTodo = useTodosStore((s) => s.addTodo);
  const getTodosForGroup = useTodosStore((s) => s.getTodosForGroup);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayTasks = useMemo(() => getTodosForGroup(routineId ?? ''), [todos, routineId]);

  const routine = useMemo(
    () => groups.find((g) => g.id === routineId) as RoutineGroup | undefined,
    [groups, routineId],
  );

  // ── Today quick-add ────────────────────────────────────────────────────────

  const [quickAdd, setQuickAdd] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const handleQuickAdd = useCallback(async () => {
    const trimmed = quickAdd.trim();
    if (!trimmed || !uid || !routineId) return;
    setAddingTask(true);
    try {
      await addTodo(uid, {
        todoType: 'generic-task',
        title: trimmed,
        groupId: routineId,
        status: 'pending',
        sortOrder: todayTasks.length,
      });
      setQuickAdd('');
      recomputeGroupCounts(uid, routineId).catch(console.error);
    } catch {
      showToast('Could not add task', 'error');
    } finally {
      setAddingTask(false);
    }
  }, [quickAdd, uid, routineId, todayTasks.length, addTodo, showToast]);

  // ── Template editing ───────────────────────────────────────────────────────

  const [editingTemplate, setEditingTemplate] = useState(false);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [newTemplateItem, setNewTemplateItem] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const startEditTemplate = useCallback(() => {
    setDraftItems((routine?.templateChildren ?? []).map((i) => i.title));
    setNewTemplateItem('');
    setEditingTemplate(true);
  }, [routine]);

  const cancelEditTemplate = useCallback(() => {
    setEditingTemplate(false);
    setDraftItems([]);
    setNewTemplateItem('');
  }, []);

  const addDraftItem = useCallback(() => {
    const trimmed = newTemplateItem.trim();
    if (!trimmed) return;
    setDraftItems((prev) => [...prev, trimmed]);
    setNewTemplateItem('');
  }, [newTemplateItem]);

  const removeDraftItem = useCallback((idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const saveTemplate = useCallback(async () => {
    if (!uid || !routineId) return;
    setSavingTemplate(true);
    try {
      const templateChildren: TemplateItem[] = draftItems.map((title) => ({
        title,
        todoType: 'generic-task',
      }));
      await updateGroup(uid, routineId, {
        templateChildren,
        updatedAt: Timestamp.now(),
      } as Parameters<typeof updateGroup>[2]);
      showToast('Template saved', 'success');
      setEditingTemplate(false);
    } catch {
      showToast('Could not save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  }, [uid, routineId, draftItems, updateGroup, showToast]);

  // ── Archive ────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!uid || !routineId) return;
    try {
      await updateGroup(uid, routineId, {
        archivedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      showToast('Routine archived', 'success');
      navigate('/sandbox/routines');
    } catch {
      showToast('Could not archive', 'error');
    }
  }, [uid, routineId, updateGroup, showToast, navigate]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const sortedTasks = useMemo(
    () => [...todayTasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [todayTasks],
  );

  const pct = routine && routine.childCount > 0
    ? Math.round((routine.doneCount / routine.childCount) * 100)
    : 0;

  const allDone = routine ? routine.childCount > 0 && routine.doneCount >= routine.childCount : false;

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!routine) {
    return (
      <div className="sb-rtn-detail-page">
        <div className="sb-rtn-detail-header">
          <button
            type="button"
            className="sb-rtn-detail-back"
            onClick={() => navigate('/sandbox/routines')}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="sb-rtn-detail-notfound">Routine not found.</div>
      </div>
    );
  }

  return (
    <div className="sb-rtn-detail-page">

      {/* ── Header ── */}
      <div className="sb-rtn-detail-header">
        <button
          type="button"
          className="sb-rtn-detail-back"
          onClick={() => navigate('/sandbox/routines')}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        <div className="sb-rtn-detail-title-block">
          <h1 className="sb-rtn-detail-title">{routine.name}</h1>
          <span className="sb-rtn-detail-subtitle">
            {recurrenceLabel(routine.recurrence)} · {routine.spawnTime}
          </span>
        </div>

        <div className="sb-rtn-detail-header-right">
          {routine.streakCount > 0 && (
            <div className="sb-rtn-detail-streak">
              <Flame size={14} strokeWidth={2} />
              <span>{routine.streakCount}</span>
            </div>
          )}
          <button
            type="button"
            className="sb-rtn-detail-archive-btn"
            onClick={handleArchive}
            title="Archive routine"
          >
            <Archive size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {routine.childCount > 0 && (
        <div className="sb-rtn-detail-progress-wrap">
          <div className="sb-rtn-detail-progress-track">
            <div
              className={`sb-rtn-detail-progress-fill${allDone ? ' sb-rtn-detail-progress-fill--done' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="sb-rtn-detail-progress-label">
            {routine.doneCount}/{routine.childCount} done
          </span>
        </div>
      )}

      {/* ── Completion banner ── */}
      {allDone && (
        <div className="sb-rtn-detail-done-banner">
          <Check size={14} strokeWidth={2.5} />
          <span>All done for today!</span>
        </div>
      )}

      {/* ── Today section ── */}
      <div className="sb-rtn-detail-section">
        <div className="sb-rtn-detail-section-header">
          <span className="sb-rtn-detail-section-label">TODAY</span>
        </div>

        {sortedTasks.length === 0 ? (
          <p className="sb-rtn-detail-empty-meta">
            {routine.lastSpawnedAt ? 'No tasks for today.' : 'Routine hasn\'t spawned yet today.'}
          </p>
        ) : (
          <div className="sb-rtn-detail-task-list">
            {sortedTasks.map((todo) => (
              <TodoRow key={todo.id} todo={todo} />
            ))}
          </div>
        )}

        {/* Quick-add for today */}
        <div className="sb-rtn-detail-quick-add">
          <input
            type="text"
            className="sb-rtn-detail-quick-input"
            placeholder="Add task for today…"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
            disabled={addingTask}
          />
          {quickAdd.trim() && (
            <button
              type="button"
              className="sb-proj-add-btn"
              onClick={handleQuickAdd}
              disabled={addingTask}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Template section ── */}
      <div className="sb-rtn-detail-section">
        <div className="sb-rtn-detail-section-header">
          <span className="sb-rtn-detail-section-label">TEMPLATE</span>
          {!editingTemplate && (
            <button
              type="button"
              className="sb-rtn-detail-edit-btn"
              onClick={startEditTemplate}
            >
              <Pencil size={12} strokeWidth={2} />
              Edit
            </button>
          )}
        </div>

        {!editingTemplate ? (
          /* View mode */
          routine.templateChildren.length === 0 ? (
            <p className="sb-rtn-detail-empty-meta">No template items. Tap Edit to add some.</p>
          ) : (
            <div className="sb-rtn-detail-tmpl-list">
              {routine.templateChildren.map((item, i) => (
                <div key={i} className="sb-rtn-detail-tmpl-item">
                  <span className="sb-rtn-detail-tmpl-dot" />
                  <span className="sb-rtn-detail-tmpl-title">{item.title}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Edit mode */
          <div className="sb-rtn-detail-tmpl-edit">
            {draftItems.map((item, i) => (
              <div key={i} className="sb-rtn-detail-tmpl-edit-row">
                <span className="sb-rtn-detail-tmpl-edit-title">{item}</span>
                <button
                  type="button"
                  className="sb-rtn-detail-tmpl-remove"
                  onClick={() => removeDraftItem(i)}
                  aria-label="Remove"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}

            <div className="sb-rtn-detail-tmpl-add-row">
              <input
                type="text"
                className="sb-rtn-template-input"
                placeholder="New item…"
                value={newTemplateItem}
                onChange={(e) => setNewTemplateItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addDraftItem(); }}
                autoFocus
              />
              {newTemplateItem.trim() && (
                <button type="button" className="sb-proj-add-btn" onClick={addDraftItem}>
                  Add
                </button>
              )}
            </div>

            <div className="sb-rtn-detail-tmpl-actions">
              <button
                type="button"
                className="sb-compose-cancel-btn"
                onClick={cancelEditTemplate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sb-compose-save-btn"
                onClick={saveTemplate}
                disabled={savingTemplate}
              >
                {savingTemplate ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
