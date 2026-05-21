import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from '../context/TrackerProvider';
import { useAuth } from '../../auth/AuthContext';
import { deleteActivity, updateActivity, subscribeToActivitiesForDateRange } from '../firebase/trackerQueries';
import { ACTIVITY_TYPE_META, FINANCE_CATEGORIES } from '../constants';
import { formatCurrency, formatDate } from '../utils';
import type { DateRange, Activity, FinanceActivity, ExerciseActivity, PaymentActivity } from '../types';
import { useDrawer } from '../TrackerShell';
import { useToast } from '../components/Toast';
import PriorityBanner from '../components/PriorityBanner';
import './today-dashboard.css';

// ─── Period helpers ───

function getPeriodRange(range: DateRange, offset: number): { start: string; end: string } {
  const today = new Date();
  if (range === 'today') {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const ds = formatDate(d);
    return { start: ds, end: ds };
  }
  // week: Mon–Sun
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

function getPeriodLabel(range: DateRange, offset: number): string {
  const today = new Date();
  if (range === 'today') {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  const monStr = monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(!sameYear ? { year: 'numeric' } : {}) });
  const sunStr = sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${monStr} – ${sunStr}`;
}

export default function TodayDashboard() {
  const [range, setRange] = useState<DateRange>('today');
  const [offset, setOffset] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');
  const { settings, loading } = useTracker();
  const { user } = useAuth();
  const { openDrawerWithActivity } = useDrawer();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleRangeChange = (newRange: DateRange) => {
    setRange(newRange);
    setOffset(0);
  };

  useEffect(() => {
    if (!user) return;
    setActivitiesLoading(true);
    const { start, end } = getPeriodRange(range, offset);
    return subscribeToActivitiesForDateRange(user.uid, start, end, (newActivities) => {
      setActivities(newActivities);
      setActivitiesLoading(false);
    });
  }, [user, range, offset]);

  const dateStr = getPeriodLabel(range, offset);

  const financeActivities = activities.filter((e): e is FinanceActivity => e.type === 'finance');
  const exerciseActivities = activities.filter((e): e is ExerciseActivity => e.type === 'exercise');
  const paymentActivities = activities.filter((e): e is PaymentActivity => e.type === 'payment');

  const totalExpense = financeActivities.filter((e) => e.direction === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = financeActivities.filter((e) => e.direction === 'income').reduce((sum, e) => sum + e.amount, 0);

  const latestExercise = exerciseActivities[0];
  const workoutDone = exerciseActivities.some((e) => e.workout.completed);

  const handleDelete = async (activityId: string) => {
    if (!user) return;
    try {
      await deleteActivity(user.uid, activityId);
    } catch (e) {
      console.error('Delete activity failed:', e);
      showToast('Failed to delete entry');
    }
  };

  const handleSaveNotes = async (activityId: string) => {
    if (!user) return;
    try {
      await updateActivity(user.uid, activityId, { notes: editingNotesValue });
    } catch (e) {
      console.error('Save notes failed:', e);
      showToast('Failed to save notes');
    }
    setEditingNotesId(null);
  };

  const getCategoryLabel = (val: string) =>
    FINANCE_CATEGORIES.find((c) => c.value === val)?.emoji ?? '';

  if (loading || activitiesLoading) {
    return <div className="dashboard"><p className="empty-text">Loading...</p></div>;
  }

  return (
    <div className="dashboard">
      <PriorityBanner />
      <div className="dashboard-header">
        <h2 className="dashboard-date">{dateStr}</h2>
        <div className="dashboard-nav-row">
          <div className="range-toggle">
            <button
              className={`range-btn ${range === 'today' ? 'active' : ''}`}
              onClick={() => handleRangeChange('today')}
            >
              Today
            </button>
            <button
              className={`range-btn ${range === 'week' ? 'active' : ''}`}
              onClick={() => handleRangeChange('week')}
            >
              This Week
            </button>
          </div>
          <div className="period-nav">
            <button className="period-nav-btn" onClick={() => setOffset((o) => o - 1)}>‹</button>
            <button className="period-nav-btn" onClick={() => setOffset((o) => o + 1)} disabled={offset === 0}>›</button>
          </div>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="dashboard-empty">
          <p className="empty-text">No activity for this period.</p>
          {offset === 0 && <p className="empty-hint">Tap + to add your first entry.</p>}
        </div>
      ) : (
        <div className="dashboard-cards">
          {financeActivities.length > 0 && (
            <div
              className="summary-card"
              style={{ '--card-accent': ACTIVITY_TYPE_META.finance.color } as React.CSSProperties}
              onClick={() => navigate('/tracker/finances')}
            >
              <div className="summary-card-header">
                <span>{ACTIVITY_TYPE_META.finance.emoji} {ACTIVITY_TYPE_META.finance.label}</span>
                <span className="summary-count">{financeActivities.length} entries</span>
              </div>
              <div className="summary-card-body">
                {totalExpense > 0 && (
                  <div className="summary-stat expense">
                    <span className="stat-label">Spent</span>
                    <span className="stat-value">{formatCurrency(totalExpense, settings.currencySymbol)}</span>
                  </div>
                )}
                {totalIncome > 0 && (
                  <div className="summary-stat income">
                    <span className="stat-label">Earned</span>
                    <span className="stat-value">{formatCurrency(totalIncome, settings.currencySymbol)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {exerciseActivities.length > 0 && (
            <div
              className="summary-card"
              style={{ '--card-accent': ACTIVITY_TYPE_META.exercise.color } as React.CSSProperties}
              onClick={() => navigate('/tracker/exercise')}
            >
              <div className="summary-card-header">
                <span>{ACTIVITY_TYPE_META.exercise.emoji} {ACTIVITY_TYPE_META.exercise.label}</span>
              </div>
              <div className="summary-card-body">
                <div className="summary-stat">
                  <span className="stat-label">Workout</span>
                  <span className={`stat-value ${workoutDone ? 'done' : 'missed'}`}>
                    {workoutDone ? 'Done' : 'Not yet'}
                  </span>
                </div>
                {latestExercise?.health?.mood && (
                  <div className="summary-stat">
                    <span className="stat-label">Mood</span>
                    <span className="stat-value">
                      {['', '😞', '😕', '😐', '🙂', '😄'][latestExercise.health.mood]}
                    </span>
                  </div>
                )}
                {latestExercise?.health?.weightKg && (
                  <div className="summary-stat">
                    <span className="stat-label">Weight</span>
                    <span className="stat-value">{latestExercise.health.weightKg} kg</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {paymentActivities.length > 0 && (
            <div
              className="summary-card"
              style={{ '--card-accent': ACTIVITY_TYPE_META.payment.color } as React.CSSProperties}
              onClick={() => navigate('/tracker/finances')}
            >
              <div className="summary-card-header">
                <span>{ACTIVITY_TYPE_META.payment.emoji} {ACTIVITY_TYPE_META.payment.label}</span>
                <span className="summary-count">{paymentActivities.length} entries</span>
              </div>
              <div className="summary-card-body">
                <div className="summary-stat">
                  <span className="stat-label">Paid</span>
                  <span className="stat-value done">{paymentActivities.filter((e) => e.status === 'paid').length}</span>
                </div>
                {paymentActivities.some((e) => e.status === 'skipped') && (
                  <div className="summary-stat">
                    <span className="stat-label">Skipped</span>
                    <span className="stat-value" style={{ color: '#999' }}>
                      {paymentActivities.filter((e) => e.status === 'skipped').length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="entries-list">
            <h3 className="entries-list-title">
              {range === 'today'
                ? offset === 0 ? "Today's Log" : offset === -1 ? "Yesterday's Log" : 'Log'
                : offset === 0 ? "This Week's Log" : offset === -1 ? "Last Week's Log" : 'Log'}
            </h3>
            {activities.map((entry) => (
              <div key={entry.id} className="entry-row">
                <span className="entry-type-badge" style={{ background: ACTIVITY_TYPE_META[entry.type].color }}>
                  {ACTIVITY_TYPE_META[entry.type].emoji}
                </span>
                <div className="entry-details">
                  {entry.type === 'finance' && (
                    <>
                      <span className={`entry-amount ${entry.direction}`}>
                        {entry.direction === 'expense' ? '-' : '+'}
                        {formatCurrency(entry.amount, settings.currencySymbol)}
                      </span>
                      <span className="entry-meta">
                        {getCategoryLabel(entry.category)} {entry.notes || entry.category}
                      </span>
                    </>
                  )}
                  {entry.type === 'exercise' && (
                    <>
                      <span className="entry-primary">
                        {entry.workout.completed
                          ? `Workout${entry.workout.durationMinutes ? ` — ${entry.workout.durationMinutes}min` : ''}`
                          : 'Rest day'}
                      </span>
                      <span className="entry-meta">
                        {[
                          entry.workout.workoutType,
                          entry.health?.mood && `Mood: ${['', '😞', '😕', '😐', '🙂', '😄'][entry.health.mood]}`,
                          entry.health?.weightKg && `${entry.health.weightKg}kg`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || entry.notes || ''}
                      </span>
                    </>
                  )}
                  {entry.type === 'payment' && (
                    <>
                      {editingNotesId === entry.id ? (
                        <input
                          className="form-input"
                          value={editingNotesValue}
                          onChange={(e) => setEditingNotesValue(e.target.value)}
                          onBlur={() => entry.id && handleSaveNotes(entry.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') entry.id && handleSaveNotes(entry.id);
                            if (e.key === 'Escape') setEditingNotesId(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="entry-primary entry-notes-editable"
                          title="Tap to edit notes"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNotesId(entry.id!);
                            setEditingNotesValue(entry.notes);
                          }}
                        >
                          {entry.notes || 'Payment'}
                        </span>
                      )}
                      <span className="entry-meta">
                        {entry.status === 'paid' ? '✓ Paid' : '⟳ Skipped'} · {formatCurrency(entry.amount, settings.currencySymbol)}
                      </span>
                    </>
                  )}
                  {entry.type === 'generic' && (
                    <span className="entry-primary">{entry.notes || 'Note'}</span>
                  )}
                  {(range === 'week' || offset !== 0) && (
                    <span className="entry-date-label">{entry.date}</span>
                  )}
                </div>
                <div className="entry-actions">
                  {(entry.type === 'finance' || entry.type === 'exercise') && (
                    <button
                      className="entry-edit"
                      onClick={(e) => { e.stopPropagation(); openDrawerWithActivity(entry); }}
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}
                  {entry.type === 'payment' && (
                    <button
                      className="entry-unmark"
                      onClick={(e) => { e.stopPropagation(); entry.id && handleDelete(entry.id); }}
                      title="Unmark payment"
                    >
                      Unmark
                    </button>
                  )}
                  <button
                    className="entry-delete"
                    onClick={(e) => { e.stopPropagation(); entry.id && handleDelete(entry.id); }}
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
