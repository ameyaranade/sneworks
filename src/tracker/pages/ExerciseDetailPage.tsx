import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useDrawer } from '../TrackerShell';
import { subscribeToActivitiesByType, deleteActivity } from '../firebase/trackerQueries';
import { MOOD_OPTIONS } from '../constants';
import { formatDate } from '../utils';
import type { ExerciseActivity } from '../types';
import './exercise-detail-page.css';

const PAGE_SIZE = 20;

function getMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function formatEntryDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function computeStreak(entries: ExerciseActivity[]): number {
  const workoutDates = new Set(entries.filter((e) => e.workout.completed).map((e) => e.date));
  let streak = 0;
  const check = new Date();
  check.setHours(0, 0, 0, 0);
  while (workoutDates.has(formatDate(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

type ListRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'entry'; entry: ExerciseActivity };

function buildRows(entries: ExerciseActivity[]): ListRow[] {
  const rows: ListRow[] = [];
  let lastMonth = '';
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      rows.push({ kind: 'header', key: `hdr-${month}`, label: getMonthLabel(month) });
    }
    rows.push({ kind: 'entry', entry });
  }
  return rows;
}

function ExerciseSkeleton() {
  return (
    <div className="exercise-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="exercise-skeleton-row">
          <div className="skeleton-block skeleton-date" style={{ width: 40, height: 12, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton-block skeleton-status" style={{ maxWidth: `${120 + (i % 3) * 40}px` }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="skeleton-block skeleton-chip" />
              {i % 2 === 0 && <div className="skeleton-block skeleton-chip" />}
            </div>
          </div>
          <div className="skeleton-block" style={{ width: 14, height: 18, borderRadius: 3, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export default function ExerciseDetailPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openDrawerWithActivity } = useDrawer();
  const [allEntries, setAllEntries] = useState<ExerciseActivity[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeToActivitiesByType<ExerciseActivity>(user.uid, 'exercise', (entries) => {
      setAllEntries(entries);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (loading || !sentinelRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { threshold: 0.1 },
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, allEntries.length]);

  const handleDelete = async (activityId: string) => {
    if (!user) return;
    setExpandedId(null);
    try {
      await deleteActivity(user.uid, activityId);
    } catch (e) {
      console.error('Delete exercise activity failed:', e);
      showToast('Failed to delete entry');
    }
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthEntries = allEntries.filter((e) => e.date.startsWith(currentMonth));
  const monthWorkouts = monthEntries.filter((e) => e.workout.completed).length;
  const streak = computeStreak(allEntries);

  const visibleEntries = allEntries.slice(0, visibleCount);
  const hasMore = visibleCount < allEntries.length;
  const rows = buildRows(visibleEntries);

  return (
    <div className="exercise-page">
      <div className="exercise-header">
        <h2 className="page-title">💪 Exercise & Health</h2>
      </div>

      {!loading && allEntries.length > 0 && (
        <div className="exercise-summary-card">
          <div className="exercise-stat">
            <span className="exercise-stat-value">{streak}</span>
            <span className="exercise-stat-label">Day streak</span>
          </div>
          <div className="exercise-stat-divider" />
          <div className="exercise-stat">
            <span className="exercise-stat-value">{monthWorkouts}</span>
            <span className="exercise-stat-label">Workouts this month</span>
          </div>
        </div>
      )}

      {loading ? (
        <ExerciseSkeleton />
      ) : allEntries.length === 0 ? (
        <div className="exercise-empty">
          <p className="empty-text">No exercise entries yet.</p>
          <p className="empty-hint">Tap + to log your first session.</p>
        </div>
      ) : (
        <div className="exercise-list">
          <p className="exercise-total-count">
            {allEntries.length} {allEntries.length === 1 ? 'entry' : 'entries'} total
          </p>
          {rows.map((row) => {
            if (row.kind === 'header') {
              return <div key={row.key} className="exercise-month-header">{row.label}</div>;
            }
            const { entry } = row;
            const isExpanded = expandedId === entry.id;
            const mood = entry.health?.mood;
            const weight = entry.health?.weightKg;
            const moodOption = MOOD_OPTIONS.find((o) => o.value === mood);

            return (
              <div key={entry.id} className={`exercise-entry ${isExpanded ? 'expanded' : ''}`}>
                <button
                  className="exercise-entry-row"
                  onClick={() => setExpandedId(isExpanded ? null : (entry.id ?? null))}
                >
                  <div className="exercise-entry-date">{formatEntryDate(entry.date)}</div>
                  <div className="exercise-entry-main">
                    {entry.workout.completed ? (
                      <span className="exercise-entry-status workout">
                        {entry.workout.workoutType || 'Workout'}
                        {entry.workout.durationMinutes ? ` · ${entry.workout.durationMinutes}min` : ''}
                      </span>
                    ) : (
                      <span className="exercise-entry-status rest">Rest day</span>
                    )}
                    <div className="exercise-entry-chips">
                      {moodOption && <span className="exercise-chip">{moodOption.emoji}</span>}
                      {weight && <span className="exercise-chip">{weight}kg</span>}
                    </div>
                  </div>
                  <span className={`exercise-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                </button>

                {isExpanded && (
                  <div className="exercise-entry-detail">
                    <div className="exercise-detail-rows">
                      <div className="exercise-detail-row">
                        <span className="exercise-detail-label">Workout</span>
                        <span className="exercise-detail-value">
                          {entry.workout.completed
                            ? [
                                'Done',
                                entry.workout.durationMinutes && `${entry.workout.durationMinutes}min`,
                                entry.workout.workoutType,
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : 'Rest day'}
                        </span>
                      </div>
                      {weight && (
                        <div className="exercise-detail-row">
                          <span className="exercise-detail-label">Weight</span>
                          <span className="exercise-detail-value">{weight} kg</span>
                        </div>
                      )}
                      {moodOption && (
                        <div className="exercise-detail-row">
                          <span className="exercise-detail-label">Mood</span>
                          <span className="exercise-detail-value">
                            {moodOption.emoji} {moodOption.label}
                          </span>
                        </div>
                      )}
                      {entry.notes && (
                        <div className="exercise-detail-row">
                          <span className="exercise-detail-label">Notes</span>
                          <span className="exercise-detail-value">{entry.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="exercise-entry-actions">
                      <button
                        className="exercise-entry-edit"
                        onClick={() => entry.id && openDrawerWithActivity(entry)}
                      >
                        Edit entry
                      </button>
                      <button
                        className="exercise-entry-delete"
                        onClick={() => entry.id && handleDelete(entry.id)}
                      >
                        Delete entry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {hasMore && <div ref={sentinelRef} className="exercise-load-sentinel" />}
          {!hasMore && allEntries.length > PAGE_SIZE && (
            <p className="exercise-end-label">All {allEntries.length} entries loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
