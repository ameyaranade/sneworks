import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Heart, ChevronDown, Clock, Repeat, FolderOpen, Search, X } from 'lucide-react';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useLogsStore } from '../stores/useLogsStore';
import TodoRow from '../components/rows/TodoRow';
import type { ShoppingListGroup, Group, Todo } from '../types';
import { startOfDay } from '../utils';
import './today-page.css';

function SectionHeader({ title, count, danger }: { title: string; count?: number; danger?: boolean }) {
  return (
    <div className={`sb-section-header${danger ? ' sb-section-header--danger' : ''}`}>
      <span className="sb-section-title">{title}</span>
      {count !== undefined && <span className="sb-section-count">{count}</span>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="sb-skeleton-row">
      <div className="sb-skeleton sb-skeleton--circle" />
      <div className="sb-skeleton-body">
        <div className="sb-skeleton sb-skeleton--line sb-skeleton--long" />
        <div className="sb-skeleton sb-skeleton--line sb-skeleton--short" />
      </div>
    </div>
  );
}

function ActiveGroupCard({ group }: { group: ShoppingListGroup }) {
  const navigate = useNavigate();
  const pct = group.childCount > 0
    ? Math.round((group.doneCount / group.childCount) * 100)
    : 0;
  return (
    <button
      type="button"
      className="sb-today-group-card"
      onClick={() => navigate(`/sandbox/groups/${group.id}`)}
    >
      <div className="sb-today-group-card__icon">
        <ShoppingCart size={14} strokeWidth={2} />
      </div>
      <div className="sb-today-group-card__body">
        <span className="sb-today-group-card__name">{group.name}</span>
        <div className="sb-today-group-card__progress-track">
          <div className="sb-today-group-card__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="sb-today-group-card__count">
        {group.doneCount}/{group.childCount}
      </span>
      <ChevronRight size={12} strokeWidth={2} className="sb-today-group-card__chevron" />
    </button>
  );
}

// ── Grouped todo block ────────────────────────────────────────────────────────

interface GroupedTodoBlockProps {
  todoGroup: TodoGroup;
  navigate: ReturnType<typeof useNavigate>;
}

function GroupedTodoBlock({ todoGroup, navigate }: GroupedTodoBlockProps) {
  const { group, groupId, todos } = todoGroup;

  const groupIcon = group
    ? group.groupKind === 'routine' ? <Repeat size={11} strokeWidth={2} />
    : group.groupKind === 'project' ? <FolderOpen size={11} strokeWidth={2} />
    : null
    : null;

  const groupPath = group
    ? group.groupKind === 'routine' ? `/sandbox/routines/${groupId}`
    : group.groupKind === 'project' ? `/sandbox/projects/${groupId}`
    : null
    : null;

  return (
    <div className="sb-today-group-block">
      {group && (
        <button
          type="button"
          className="sb-today-group-label"
          onClick={() => groupPath && navigate(groupPath)}
        >
          {groupIcon && <span className="sb-today-group-label__icon">{groupIcon}</span>}
          <span className="sb-today-group-label__name">{group.name}</span>
          <span className="sb-today-group-label__count">{todos.length}</span>
        </button>
      )}
      <div className="sb-todo-list">
        {todos.map((t) => (
          <TodoRow key={t.id} todo={t} />
        ))}
      </div>
    </div>
  );
}

// ── Group todos by their parent group ────────────────────────────────────────

interface TodoGroup {
  groupId: string | null;
  group: Group | null;
  todos: Todo[];
}

function buildGroupedTodos(
  todoList: Todo[],
  groupMap: Map<string, Group>,
): TodoGroup[] {
  const byGroup: Map<string | null, typeof todoList> = new Map();

  for (const t of todoList) {
    const key = t.groupId ?? null;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(t);
  }

  const result: TodoGroup[] = [];
  // Ungrouped first (no parent)
  if (byGroup.has(null)) {
    result.push({ groupId: null, group: null, todos: byGroup.get(null)! });
  }
  // Then grouped, sorted by group name
  for (const [gid, gtodos] of byGroup) {
    if (gid === null) continue;
    const g = groupMap.get(gid) ?? null;
    result.push({ groupId: gid, group: g, todos: gtodos });
  }
  return result;
}

export default function TodayPage() {
  const navigate = useNavigate();
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Subscribe to `todos` so the component re-renders on any state change.
  const todos = useTodosStore((s) => s.todos);
  const loaded = useTodosStore((s) => s.loaded);
  const getOverdueTodos = useTodosStore((s) => s.getOverdueTodos);
  const getTodayTodos = useTodosStore((s) => s.getTodayTodos);
  const getDoneTodayTodos = useTodosStore((s) => s.getDoneTodayTodos);

  const groups = useGroupsStore((s) => s.groups);
  const getActiveShoppingLists = useGroupsStore((s) => s.getActiveShoppingLists);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeShoppingLists = useMemo(() => getActiveShoppingLists(), [groups]);

  // Build groupId → Group map for quick lookups
  const groupMap = useMemo(
    () => new Map(groups.map((g) => [g.id!, g])),
    [groups],
  );

  const logs = useLogsStore((s) => s.logs);
  const todayHealthCount = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    return logs.filter((l) => l.logType === 'health-log' && l.occurredAt.toMillis() >= todayStart).length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overdue = useMemo(() => getOverdueTodos(), [todos]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const upNext = useMemo(() => getTodayTodos(), [todos]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doneToday = useMemo(() => getDoneTodayTodos(), [todos]);

  // Group "up next" and "overdue" by their parent group
  const groupedUpNext = useMemo(
    () => buildGroupedTodos(upNext, groupMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upNext, groupMap],
  );
  const groupedOverdue = useMemo(
    () => buildGroupedTodos(overdue, groupMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overdue, groupMap],
  );

  // Search: filter all pending/deferred todos by title
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return todos.filter(
      (t) =>
        (t.status === 'pending' || t.status === 'deferred') &&
        t.title.toLowerCase().includes(q),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, searchQuery]);

  const groupedSearch = useMemo(
    () => buildGroupedTodos(searchResults, groupMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchResults, groupMap],
  );

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const isEmpty = loaded && overdue.length === 0 && upNext.length === 0 && doneToday.length === 0;

  return (
    <div className="sb-today-page">
      {searchOpen ? (
        <div className="sb-today-search-bar">
          <Search size={15} strokeWidth={2} className="sb-today-search-icon" />
          <input
            type="text"
            className="sb-today-search-input"
            placeholder="Search todos…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="sb-today-search-close"
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            aria-label="Close search"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="sb-today-header">
          <h1 className="sb-today-date">{dateLabel}</h1>
          <button
            type="button"
            className="sb-today-timeline-btn"
            onClick={() => navigate('/sandbox/timeline')}
            aria-label="Open Timeline"
            title="Timeline"
          >
            <Clock size={15} strokeWidth={2} />
            <span>Timeline</span>
          </button>
          <button
            type="button"
            className="sb-today-search-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="sb-today-content">
        {!loaded ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {/* ── Search results ── */}
            {searchOpen && (
              <section className="sb-today-section">
                {searchQuery.trim() === '' ? (
                  <div className="sb-today-search-hint">Type to search pending todos</div>
                ) : searchResults.length === 0 ? (
                  <div className="sb-today-search-hint">No results for "{searchQuery}"</div>
                ) : (
                  <>
                    <SectionHeader title="Results" count={searchResults.length} />
                    {groupedSearch.map((tg) => (
                      <GroupedTodoBlock key={tg.groupId ?? 'ungrouped'} todoGroup={tg} navigate={navigate} />
                    ))}
                  </>
                )}
              </section>
            )}

            {/* ── Overdue ── */}
            {overdue.length > 0 && (
              <section className="sb-today-section">
                <SectionHeader title="Overdue" count={overdue.length} danger />
                {groupedOverdue.map((tg) => (
                  <GroupedTodoBlock key={tg.groupId ?? 'ungrouped'} todoGroup={tg} navigate={navigate} />
                ))}
              </section>
            )}

            {/* ── Up Next ── */}
            {upNext.length > 0 && (
              <section className="sb-today-section">
                <SectionHeader title="Up next" count={upNext.length} />
                {groupedUpNext.map((tg) => (
                  <GroupedTodoBlock key={tg.groupId ?? 'ungrouped'} todoGroup={tg} navigate={navigate} />
                ))}
              </section>
            )}

            {/* ── Active Shopping Lists ── */}
            {activeShoppingLists.length > 0 && activeShoppingLists.some((g) => g.doneCount > 0 || g.childCount > 0) && (
              <section className="sb-today-section">
                <SectionHeader title="Shopping" count={activeShoppingLists.length} />
                <div className="sb-today-group-list">
                  {activeShoppingLists.map((g) => (
                    <ActiveGroupCard key={g.id} group={g as ShoppingListGroup} />
                  ))}
                </div>
              </section>
            )}
            {/* ── Health Summary ── */}
            {todayHealthCount > 0 && (
              <section className="sb-today-section">
                <SectionHeader title="Health" />
                <button
                  type="button"
                  className="sb-today-health-card"
                  onClick={() => navigate('/sandbox/health')}
                >
                  <span className="sb-today-health-card__icon">
                    <Heart size={14} strokeWidth={2} />
                  </span>
                  <span className="sb-today-health-card__text">
                    {todayHealthCount} workout{todayHealthCount !== 1 ? 's' : ''} logged today
                  </span>
                  <ChevronRight size={12} strokeWidth={2} className="sb-today-health-card__chevron" />
                </button>
              </section>
            )}

            {/* ── Done Today ── */}
            {doneToday.length > 0 && (
              <section className="sb-today-section sb-today-section--done">
                <button
                  type="button"
                  className="sb-section-header sb-section-header--collapsible"
                  onClick={() => setDoneExpanded((v) => !v)}
                >
                  <span className="sb-section-title">Done today</span>
                  <span className="sb-section-count">{doneToday.length}</span>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className={`sb-section-chevron${doneExpanded ? ' sb-section-chevron--open' : ''}`}
                  />
                </button>
                {doneExpanded && (
                  <div className="sb-todo-list sb-todo-list--done">
                    {doneToday.map((t) => (
                      <TodoRow key={t.id} todo={t} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Phase 3: Today's Logs section */}

            {/* ── Empty state ── */}
            {isEmpty && (
              <div className="sb-today-empty">
                <span className="sb-today-empty-glyph">✦</span>
                <p className="sb-today-empty-text">Nothing planned today.</p>
                <p className="sb-today-empty-sub">Tap TODO to add a task.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
