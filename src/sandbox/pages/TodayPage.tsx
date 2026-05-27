import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Heart, ChevronDown } from 'lucide-react';
import { useTodosStore } from '../stores/useTodosStore';
import { useGroupsStore } from '../stores/useGroupsStore';
import { useLogsStore } from '../stores/useLogsStore';
import TodoRow from '../components/rows/TodoRow';
import type { ShoppingListGroup } from '../types';
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

export default function TodayPage() {
  const navigate = useNavigate();
  const [doneExpanded, setDoneExpanded] = useState(false);
  // Subscribe to `todos` so the component re-renders on any state change.
  // Use it as the useMemo key so derived lists stay fresh. Stable output
  // references prevent downstream unnecessary re-renders.
  const todos = useTodosStore((s) => s.todos);
  const loaded = useTodosStore((s) => s.loaded);
  const getOverdueTodos = useTodosStore((s) => s.getOverdueTodos);
  const getTodayTodos = useTodosStore((s) => s.getTodayTodos);
  const getDoneTodayTodos = useTodosStore((s) => s.getDoneTodayTodos);

  const groups = useGroupsStore((s) => s.groups);
  const getActiveShoppingLists = useGroupsStore((s) => s.getActiveShoppingLists);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeShoppingLists = useMemo(() => getActiveShoppingLists(), [groups]);

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

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const isEmpty = loaded && overdue.length === 0 && upNext.length === 0 && doneToday.length === 0;

  return (
    <div className="sb-today-page">
      <div className="sb-today-header">
        <h1 className="sb-today-date">{dateLabel}</h1>
      </div>

      <div className="sb-today-content">
        {!loaded ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {/* ── Overdue ── */}
            {overdue.length > 0 && (
              <section className="sb-today-section">
                <SectionHeader title="Overdue" count={overdue.length} danger />
                <div className="sb-todo-list">
                  {overdue.map((t) => (
                    <TodoRow key={t.id} todo={t} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Up Next ── */}
            {upNext.length > 0 && (
              <section className="sb-today-section">
                <SectionHeader title="Up next" count={upNext.length} />
                <div className="sb-todo-list">
                  {upNext.map((t) => (
                    <TodoRow key={t.id} todo={t} />
                  ))}
                </div>
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
