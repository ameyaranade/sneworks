import { useMemo } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from '../utils';
import type { Entry } from '../types';
import SegmentedControl from '../components/primitives/SegmentedControl';
import EntryList from '../components/composites/EntryList';
import { useState } from 'react';
import './today-page.css';

type Range = 'today' | 'week' | 'month';

const RANGE_SEGMENTS = [
  { value: 'today' as Range, label: 'Today' },
  { value: 'week' as Range, label: 'Week' },
  { value: 'month' as Range, label: 'Month' },
];

function getDateRange(range: Range): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week': {
      const weekStart = startOfWeek(now);
      return { start: weekStart, end: endOfWeek(now) };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start: monthStart, end: monthEnd };
    }
  }
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="lg-section-header">
      <span className="lg-section-title">{title}</span>
      {count !== undefined && <span className="lg-section-count">{count}</span>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="lg-skeleton-row">
      <div className="lg-skeleton lg-skeleton--circle" />
      <div className="lg-skeleton-body">
        <div className="lg-skeleton lg-skeleton--line lg-skeleton--long" />
        <div className="lg-skeleton lg-skeleton--line lg-skeleton--short" />
      </div>
    </div>
  );
}

export default function TodayPage() {
  const [range, setRange] = useState<Range>('today');
  const allEntries = useEntriesStore((s) => s.entries);
  const loaded = useEntriesStore((s) => s.loaded);

  const { start, end } = useMemo(() => getDateRange(range), [range]);

  const filtered = useMemo(() => {
    const startMs = start.getTime();
    const endMs = end.getTime();
    return allEntries.filter((e) => {
      const ts = (e.occurredAt ?? e.dueAt ?? e.createdAt)?.toMillis?.();
      return ts !== undefined && ts >= startMs && ts <= endMs;
    });
  }, [allEntries, start, end]);

  // Split into sections
  const overdue = useMemo<Entry[]>(() => {
    if (range !== 'today') return [];
    const now = Date.now();
    return allEntries.filter(
      (e) => e.kind === 'todo' && e.status === 'pending' && e.dueAt && e.dueAt.toMillis() < now
        && e.dueAt.toMillis() < start.getTime(), // before today window
    );
  }, [allEntries, range, start]);

  const todos = useMemo(
    () => filtered.filter((e) => e.kind === 'todo'),
    [filtered],
  );
  const logs = useMemo(
    () => filtered.filter((e) => e.kind === 'log'),
    [filtered],
  );

  const pendingTodos = todos.filter((e) => e.status === 'pending');
  const doneTodos = todos.filter((e) => e.status === 'done' || e.status === 'skipped');

  const dateLabel = useMemo(() => {
    const now = new Date();
    if (range === 'today') {
      return now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (range === 'week') {
      return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    return now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [range, start, end]);

  return (
    <div className="lg-today-page">
      {/* Header */}
      <div className="lg-today-header">
        <div className="lg-today-date">{dateLabel}</div>
        <SegmentedControl
          segments={RANGE_SEGMENTS}
          value={range}
          onChange={setRange}
        />
      </div>

      {/* Content */}
      <div className="lg-today-content">
        {!loaded ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {/* Overdue section (today only) */}
            {overdue.length > 0 && (
              <section className="lg-today-section">
                <SectionHeader title="Overdue" count={overdue.length} />
                <EntryList entries={overdue} />
              </section>
            )}

            {/* Up next / pending todos */}
            {pendingTodos.length > 0 && (
              <section className="lg-today-section">
                <SectionHeader title={range === 'today' ? 'Up next' : 'To do'} count={pendingTodos.length} />
                <EntryList entries={pendingTodos} />
              </section>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <section className="lg-today-section">
                <SectionHeader title="Log" count={logs.length} />
                <EntryList entries={logs} showTime />
              </section>
            )}

            {/* Done todos */}
            {doneTodos.length > 0 && (
              <section className="lg-today-section lg-today-section--done">
                <SectionHeader title="Done" count={doneTodos.length} />
                <EntryList entries={doneTodos} />
              </section>
            )}

            {/* Empty state */}
            {filtered.length === 0 && overdue.length === 0 && (
              <div className="lg-today-empty">
                <div className="lg-today-empty-icon">✦</div>
                <p className="lg-today-empty-text">
                  {range === 'today' ? 'Nothing logged today. Tap + to start.' : 'Nothing in this period.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
