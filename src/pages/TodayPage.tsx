import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Heart, ChevronDown, Clock, Repeat, FolderOpen, Search, X } from 'lucide-react';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useLogsStore } from '../stores/useLogsStore';
import { useUI } from '../context/UIContext';
import TodoRow from '../components/rows/TodoRow';
import EmptyState from '../components/primitives/EmptyState';
import ProgressBar from '../components/primitives/ProgressBar';
import type { ShoppingListGroup, ProjectGroup, Group, Todo, RecurringTodoGroup } from '../types';
import { startOfDay } from '../utils';
import './today-page.css';

function SectionHeader({ title, count, danger }: { title: string; count?: number; danger?: boolean }) {
  return (
    <div className={`sn-section-header${danger ? ' sn-section-header--danger' : ''}`}>
      <span className="sn-section-title">{title}</span>
      {count !== undefined && <span className="sn-section-count">{count}</span>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="sn-skeleton-row">
      <div className="sn-skeleton sn-skeleton--circle" />
      <div className="sn-skeleton-body">
        <div className="sn-skeleton sn-skeleton--line sn-skeleton--long" />
        <div className="sn-skeleton sn-skeleton--line sn-skeleton--short" />
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
      className="sn-today-group-card"
      onClick={() => navigate(`/groups/${group.id}`)}
    >
      <div className="sn-today-group-card__icon">
        <ShoppingCart size={14} strokeWidth={2} />
      </div>
      <div className="sn-today-group-card__body">
        <span className="sn-today-group-card__name">{group.name}</span>
        <ProgressBar pct={pct} color="success" />
      </div>
      <span className="sn-today-group-card__count">
        {group.doneCount}/{group.childCount}
      </span>
      <ChevronRight size={12} strokeWidth={2} className="sn-today-group-card__chevron" />
    </button>
  );
}

function ActiveProjectCard({ group }: { group: ProjectGroup }) {
  const navigate = useNavigate();
  const pct = group.childCount > 0
    ? Math.round((group.doneCount / group.childCount) * 100)
    : 0;
  return (
    <button
      type="button"
      className="sn-today-group-card"
      onClick={() => navigate(`/projects/${group.id}`)}
    >
      <div className="sn-today-group-card__icon">
        <FolderOpen size={14} strokeWidth={2} />
      </div>
      <div className="sn-today-group-card__body">
        <span className="sn-today-group-card__name">{group.name}</span>
        <ProgressBar pct={pct} color="accent" />
      </div>
      <span className="sn-today-group-card__count">
        {group.doneCount}/{group.childCount}
      </span>
      <ChevronRight size={12} strokeWidth={2} className="sn-today-group-card__chevron" />
    </button>
  );
}

// ── Grouped todo block ────────────────────────────────────────────────────────

interface GroupedTodoBlockProps {
  todoGroup: TodoGroup;
  navigate: ReturnType<typeof useNavigate>;
  onEditRecurring: (group: RecurringTodoGroup) => void;
}

function GroupedTodoBlock({ todoGroup, navigate, onEditRecurring }: GroupedTodoBlockProps) {
  const { group, groupId, todos } = todoGroup;
  const [expanded, setExpanded] = useState(false);

  // Ungrouped items — plain flat list, no card wrapper
  if (!group) {
    return (
      <div className="sn-today-group-block">
        <div className="sn-todo-list">
          {todos.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </div>
      </div>
    );
  }

  const isRoutine  = group.groupKind === 'routine';
  const isProject  = group.groupKind === 'project';
  const isRecurring = group.groupKind === 'recurring-todo';

  const iconEl = (isRoutine || isRecurring)
    ? <Repeat size={14} strokeWidth={2} />
    : isProject
    ? <FolderOpen size={14} strokeWidth={2} />
    : <ShoppingCart size={14} strokeWidth={2} />;

  const iconClass = (isRoutine || isRecurring)
    ? 'sn-today-grouped-card__icon--routine'
    : 'sn-today-grouped-card__icon--project';

  const groupPath = isRoutine || isRecurring
    ? `/routines/${groupId}`
    : isProject
    ? `/projects/${groupId}`
    : `/groups/${groupId}`;

  const { doneCount, childCount } = group;
  const pct = childCount > 0 ? Math.round((doneCount / childCount) * 100) : 0;
  const meta = childCount > 0
    ? `${todos.length} pending · ${doneCount}/${childCount} done`
    : `${todos.length} pending`;

  return (
    <div className="sn-today-grouped-card">
      <div className="sn-today-grouped-card__header">
        <button
          type="button"
          className="sn-today-grouped-card__toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={`sn-today-grouped-card__icon ${iconClass}`}>
            {iconEl}
          </span>
          <div className="sn-today-grouped-card__body">
            <div className="sn-today-grouped-card__top">
              <span className="sn-today-grouped-card__name">{group.name}</span>
            </div>
            {childCount > 0 && <ProgressBar pct={pct} />}
            <span className="sn-today-grouped-card__meta">{meta}</span>
          </div>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={`sn-today-grouped-card__chevron${expanded ? ' sn-today-grouped-card__chevron--open' : ''}`}
          />
        </button>
        <button
          type="button"
          className="sn-today-grouped-card__nav"
          onClick={() => isRecurring
            ? onEditRecurring(group as RecurringTodoGroup)
            : navigate(groupPath)
          }
          aria-label={isRecurring ? `Edit ${group.name}` : `Open ${group.name}`}
        >
          <ChevronRight size={13} strokeWidth={2} />
        </button>
      </div>

      {expanded && (
        <div className="sn-today-grouped-card__rows">
          {todos.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </div>
      )}
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
  const { openEditRecurring } = useUI();
  // Subscribe to `todos` so the component re-renders on any state change.
  const todos = useTodosStore((s) => s.todos);
  const loaded = useTodosStore((s) => s.loaded);
  const getOverdueTodos = useTodosStore((s) => s.getOverdueTodos);
  const getTodayTodos = useTodosStore((s) => s.getTodayTodos);
  const getDoneTodayTodos = useTodosStore((s) => s.getDoneTodayTodos);

  const groups = useGroupsStore((s) => s.groups);
  const getActiveShoppingLists = useGroupsStore((s) => s.getActiveShoppingLists);
  const getActiveProjects = useGroupsStore((s) => s.getActiveProjects);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeShoppingLists = useMemo(() => getActiveShoppingLists(), [groups]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeProjects = useMemo(() => getActiveProjects(), [groups]);

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
    <div className="sn-today-page">
      {searchOpen ? (
        <div className="sn-today-search-bar">
          <Search size={15} strokeWidth={2} className="sn-today-search-icon" />
          <input
            type="text"
            className="sn-today-search-input"
            placeholder="Search todos…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="sn-today-search-close"
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            aria-label="Close search"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="sn-today-header">
          <h1 className="sn-today-date">{dateLabel}</h1>
          <button
            type="button"
            className="sn-today-timeline-btn"
            onClick={() => navigate('/timeline')}
            aria-label="Open Timeline"
            title="Timeline"
          >
            <Clock size={15} strokeWidth={2} />
            <span>Timeline</span>
          </button>
          <button
            type="button"
            className="sn-today-search-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="sn-today-content">
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
              <section className="sn-today-section">
                {searchQuery.trim() === '' ? (
                  <div className="sn-today-search-hint">Type to search pending todos</div>
                ) : searchResults.length === 0 ? (
                  <div className="sn-today-search-hint">No results for "{searchQuery}"</div>
                ) : (
                  <>
                    <SectionHeader title="Results" count={searchResults.length} />
                    {groupedSearch.map((tg) => (
                      <GroupedTodoBlock key={tg.groupId ?? 'ungrouped'} todoGroup={tg} navigate={navigate} onEditRecurring={openEditRecurring} />
                    ))}
                  </>
                )}
              </section>
            )}

            {/* ── Overdue ── */}
            {overdue.length > 0 && (
              <section className="sn-today-section">
                <SectionHeader title="Overdue" count={overdue.length} danger />
                {groupedOverdue.map((tg) => (
                  <GroupedTodoBlock key={tg.groupId ?? 'ungrouped'} todoGroup={tg} navigate={navigate} onEditRecurring={openEditRecurring} />
                ))}
              </section>
            )}

            {/* ── Up Next ── */}
            {upNext.length > 0 && (
              <section className="sn-today-section">
                <SectionHeader title="Up next" count={upNext.length} />
                {groupedUpNext.map((tg) => (
                  <GroupedTodoBlock key={tg.groupId ?? 'ungrouped'} todoGroup={tg} navigate={navigate} onEditRecurring={openEditRecurring} />
                ))}
              </section>
            )}

            {/* ── Active Shopping Lists ── */}
            {activeShoppingLists.length > 0 && activeShoppingLists.some((g) => g.doneCount > 0 || g.childCount > 0) && (
              <section className="sn-today-section">
                <SectionHeader title="Shopping" count={activeShoppingLists.length} />
                <div className="sn-today-group-list">
                  {activeShoppingLists.map((g) => (
                    <ActiveGroupCard key={g.id} group={g as ShoppingListGroup} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Active Projects ── */}
            {activeProjects.length > 0 && (
              <section className="sn-today-section">
                <SectionHeader title="Projects" count={activeProjects.length} />
                <div className="sn-today-group-list">
                  {activeProjects.map((p) => (
                    <ActiveProjectCard key={p.id} group={p as ProjectGroup} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Health Summary ── */}
            {todayHealthCount > 0 && (
              <section className="sn-today-section">
                <SectionHeader title="Health" />
                <button
                  type="button"
                  className="sn-today-health-card"
                  onClick={() => navigate('/health')}
                >
                  <span className="sn-today-health-card__icon">
                    <Heart size={14} strokeWidth={2} />
                  </span>
                  <span className="sn-today-health-card__text">
                    {todayHealthCount} workout{todayHealthCount !== 1 ? 's' : ''} logged today
                  </span>
                  <ChevronRight size={12} strokeWidth={2} className="sn-today-health-card__chevron" />
                </button>
              </section>
            )}

            {/* ── Done Today ── */}
            {doneToday.length > 0 && (
              <section className="sn-today-section sn-today-section--done">
                <button
                  type="button"
                  className="sn-section-header sn-section-header--collapsible"
                  onClick={() => setDoneExpanded((v) => !v)}
                >
                  <span className="sn-section-title">Done today</span>
                  <span className="sn-section-count">{doneToday.length}</span>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className={`sn-section-chevron${doneExpanded ? ' sn-section-chevron--open' : ''}`}
                  />
                </button>
                {doneExpanded && (
                  <div className="sn-todo-list sn-todo-list--done">
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
              <EmptyState glyph="✦" title="Nothing planned today." sub="Tap TODO to add a task." />
            )}
          </>
        )}
      </div>

    </div>
  );
}
