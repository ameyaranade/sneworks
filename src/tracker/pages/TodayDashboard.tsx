import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from '../context/TrackerProvider';
import { useAuth } from '../../auth/AuthContext';
import { deleteActivity, updateActivity, subscribeToActivitiesForDateRange } from '../firebase/trackerQueries';
import { ACTIVITY_TYPE_META, FINANCE_CATEGORIES } from '../constants';
import { formatCurrency, formatDate } from '../utils';
import type { Activity, FinanceActivity, ExerciseActivity, PaymentActivity, GroceryActivity } from '../types';
import { useDrawer } from '../TrackerShell';
import { useToast } from '../components/Toast';
import PriorityBanner from '../components/PriorityBanner';
import './today-dashboard.css';

// ─── Types & constants ───

type DashRange = 'today' | 'month';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const QUICK_ADD: { label: string; path: string; icon: React.ReactNode }[] = [
  {
    label: 'Money',
    path: '/tracker/finances',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: 'Health',
    path: '/tracker/exercise',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        <polyline points="3 12 6 12 8 8 10 16 12 12 14 12 16 9 18 15 20 12 21 12" />
      </svg>
    ),
  },
  {
    label: 'Shopping',
    path: '/tracker/groceries',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    label: 'Reminder',
    path: '/tracker/reminders',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

// ─── Helpers ───

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getPeriodRange(range: DashRange, offset: number): { start: string; end: string } {
  if (range === 'today') {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const ds = formatDate(d);
    return { start: ds, end: ds };
  }
  // month
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const y = base.getFullYear();
  const m = base.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(dim)}` };
}

function getPeriodLabel(range: DashRange, offset: number): string {
  if (range === 'today') {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  return base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getCalendarInfo(offset: number) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return { year, month, cells };
}

// ─── Component ───

export default function TodayDashboard() {
  const [range, setRange] = useState<DashRange>('today');
  const [offset, setOffset] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { settings, loading } = useTracker();
  const { user } = useAuth();
  const { openDrawerWithActivity } = useDrawer();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const today = new Date();
  const todayStr = toYMD(today.getFullYear(), today.getMonth(), today.getDate());

  const handleRangeChange = (newRange: DashRange) => {
    setRange(newRange);
    setOffset(0);
    setSelectedDay(null);
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

  // Close popover on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const dateStr = getPeriodLabel(range, offset);

  // Calendar grid data (month mode only)
  const { year: calYear, month: calMonth, cells } = useMemo(
    () => (range === 'month' ? getCalendarInfo(offset) : { year: 0, month: 0, cells: [] as (number | null)[] }),
    [range, offset],
  );

  const dayActivityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (range !== 'month') return map;
    for (const a of activities) {
      if (!map.has(a.date)) map.set(a.date, new Set());
      map.get(a.date)!.add(a.type);
    }
    return map;
  }, [activities, range]);

  const selectedActivities = useMemo(
    () => (selectedDay ? activities.filter((e) => e.date === selectedDay) : []),
    [activities, selectedDay],
  );

  // Today-mode filters
  const financeActivities = activities.filter((e): e is FinanceActivity => e.type === 'finance');
  const exerciseActivities = activities.filter((e): e is ExerciseActivity => e.type === 'exercise');
  const paymentActivities = activities.filter((e): e is PaymentActivity => e.type === 'payment');
  const totalExpense = financeActivities.filter((e) => e.direction === 'expense').reduce((s, e) => s + e.amount, 0);
  const totalIncome = financeActivities.filter((e) => e.direction === 'income').reduce((s, e) => s + e.amount, 0);
  const latestExercise = exerciseActivities[0];
  const workoutDone = exerciseActivities.some((e) => e.workout.completed);

  const handleDelete = async (activityId: string) => {
    if (!user) return;
    try { await deleteActivity(user.uid, activityId); }
    catch { showToast('Failed to delete entry'); }
  };

  const handleSaveNotes = async (activityId: string) => {
    if (!user) return;
    try { await updateActivity(user.uid, activityId, { notes: editingNotesValue }); }
    catch { showToast('Failed to save notes'); }
    setEditingNotesId(null);
  };

  const getCategoryLabel = (val: string) =>
    FINANCE_CATEGORIES.find((c) => c.value === val)?.label ?? val;

  if (loading || activitiesLoading) {
    return <div className="dashboard"><p className="empty-text">Loading...</p></div>;
  }

  return (
    <div className="dashboard">
      <PriorityBanner />

      {/* ─── Header ─── */}
      <div className="dashboard-header">
        <div className="dashboard-title-row">
          <h2 className="dashboard-date">{dateStr}</h2>
          <div className="dashboard-add-wrap" ref={pickerRef}>
            <button
              className="dashboard-add-btn"
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="Add entry"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {pickerOpen && (
              <div className="dashboard-picker-popover">
                {QUICK_ADD.map(({ label, icon, path }) => (
                  <button
                    key={path}
                    className="picker-popover-item"
                    onClick={() => { setPickerOpen(false); navigate(path, { state: { openAdd: true } }); }}
                  >
                    <span className="picker-popover-icon">{icon}</span>
                    <span className="picker-popover-label">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-nav-row">
          <div className="range-toggle">
            <button className={`range-btn ${range === 'today' ? 'active' : ''}`} onClick={() => handleRangeChange('today')}>Today</button>
            <button className={`range-btn ${range === 'month' ? 'active' : ''}`} onClick={() => handleRangeChange('month')}>This Month</button>
          </div>
          <div className="period-nav">
            <button className="period-nav-btn" onClick={() => setOffset((o) => o - 1)}>‹</button>
            <button className="period-nav-btn" onClick={() => setOffset((o) => o + 1)} disabled={offset === 0}>›</button>
          </div>
        </div>
      </div>

      {/* ─── Month / Calendar view ─── */}
      {range === 'month' && (
        <div className="cal-month-view">
          <div className="cal-day-labels">
            {DAY_LABELS.map((d) => <span key={d} className="cal-day-label">{d}</span>)}
          </div>

          <div className="cal-grid">
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} className="cal-cell cal-cell--blank" />;
              const dateKey = toYMD(calYear, calMonth, day);
              const types = dayActivityMap.get(dateKey);
              const isToday = dateKey === todayStr;
              const isSelected = dateKey === selectedDay;
              return (
                <div
                  key={dateKey}
                  className={['cal-cell', isToday && 'cal-cell--today', isSelected && 'cal-cell--selected', types && 'cal-cell--has-entries'].filter(Boolean).join(' ')}
                  onClick={() => types && setSelectedDay(isSelected ? null : dateKey)}
                >
                  <span className="cal-day-num">{day}</span>
                  {types && (
                    <div className="cal-dots">
                      {[...types].map((type) => (
                        <span
                          key={type}
                          className="cal-dot"
                          style={{ background: ACTIVITY_TYPE_META[type as keyof typeof ACTIVITY_TYPE_META]?.color ?? '#e67e22' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDay && (
            <div className="cal-day-detail">
              <div className="cal-detail-header">
                <span className="cal-detail-date">
                  {parseLocalDate(selectedDay).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <button className="cal-detail-close" onClick={() => setSelectedDay(null)}>×</button>
              </div>
              {selectedActivities.length === 0 ? (
                <p className="cal-detail-empty">No entries for this day.</p>
              ) : (
                <div className="cal-detail-entries">
                  {selectedActivities.map((entry) => (
                    <div key={entry.id} className="cal-entry-row">
                      <span className="cal-entry-type-label">{ACTIVITY_TYPE_META[entry.type].label}</span>
                      <div className="cal-entry-info">
                        {entry.type === 'finance' && (
                          <>
                            <span className={`cal-entry-primary ${(entry as FinanceActivity).direction}`}>
                              {(entry as FinanceActivity).direction === 'expense' ? '−' : '+'}
                              {formatCurrency((entry as FinanceActivity).amount, settings.currencySymbol)}
                            </span>
                            {entry.notes && <span className="cal-entry-meta">{entry.notes}</span>}
                          </>
                        )}
                        {entry.type === 'exercise' && (
                          <>
                            <span className="cal-entry-primary">
                              {(entry as ExerciseActivity).workout.completed
                                ? `Workout${(entry as ExerciseActivity).workout.durationMinutes ? ` — ${(entry as ExerciseActivity).workout.durationMinutes}min` : ''}`
                                : 'Rest day'}
                            </span>
                            {entry.notes && <span className="cal-entry-meta">{entry.notes}</span>}
                          </>
                        )}
                        {entry.type === 'payment' && (
                          <>
                            <span className="cal-entry-primary">{entry.notes || 'Payment'}</span>
                            <span className="cal-entry-meta">
                              {(entry as PaymentActivity).status === 'paid' ? '✓ Paid' : '⟳ Skipped'}
                              {' · '}{formatCurrency((entry as PaymentActivity).amount, settings.currencySymbol)}
                            </span>
                          </>
                        )}
                        {entry.type === 'grocery' && (
                          <>
                            <span className="cal-entry-primary">{(entry as GroceryActivity).tripName}</span>
                            <span className="cal-entry-meta">
                              {(entry as GroceryActivity).tripItems.length} items · {(entry as GroceryActivity).tripMode}
                            </span>
                          </>
                        )}
                        {entry.type === 'generic' && (
                          <span className="cal-entry-primary">{entry.notes || 'Note'}</span>
                        )}
                      </div>
                      <div className="cal-entry-actions">
                        {(entry.type === 'finance' || entry.type === 'exercise') && (
                          <button className="entry-edit" onClick={() => entry.id && openDrawerWithActivity(entry)} title="Edit">Edit</button>
                        )}
                        {entry.type === 'payment' && (
                          <button className="entry-unmark" onClick={() => entry.id && handleDelete(entry.id)} title="Unmark">Unmark</button>
                        )}
                        <button className="entry-delete" onClick={() => entry.id && handleDelete(entry.id)} title="Delete">&times;</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Today view ─── */}
      {range === 'today' && (
        activities.length === 0 ? (
          <div className="dashboard-empty">
            <p className="empty-text">No activity for this period.</p>
            {offset === 0 && <p className="empty-hint">Tap + to add your first entry.</p>}
          </div>
        ) : (
          <div className="dashboard-cards">
            {financeActivities.length > 0 && (
              <div className="summary-card" onClick={() => navigate('/tracker/finances')}>
                <div className="summary-card-header">
                  <span>{ACTIVITY_TYPE_META.finance.label}</span>
                  <span className="summary-count">{financeActivities.length} entries</span>
                </div>
                <div className="summary-card-body">
                  {totalExpense > 0 && <div className="summary-stat expense"><span className="stat-label">Spent</span><span className="stat-value">{formatCurrency(totalExpense, settings.currencySymbol)}</span></div>}
                  {totalIncome > 0 && <div className="summary-stat income"><span className="stat-label">Earned</span><span className="stat-value">{formatCurrency(totalIncome, settings.currencySymbol)}</span></div>}
                </div>
              </div>
            )}

            {exerciseActivities.length > 0 && (
              <div className="summary-card" onClick={() => navigate('/tracker/exercise')}>
                <div className="summary-card-header">
                  <span>{ACTIVITY_TYPE_META.exercise.label}</span>
                </div>
                <div className="summary-card-body">
                  <div className="summary-stat">
                    <span className="stat-label">Workout</span>
                    <span className={`stat-value ${workoutDone ? 'done' : 'missed'}`}>{workoutDone ? 'Done' : 'Not yet'}</span>
                  </div>
                  {latestExercise?.health?.mood && (
                    <div className="summary-stat"><span className="stat-label">Mood</span><span className="stat-value">{['', 'Awful', 'Bad', 'Okay', 'Good', 'Great'][latestExercise.health.mood]}</span></div>
                  )}
                  {latestExercise?.health?.weightKg && (
                    <div className="summary-stat"><span className="stat-label">Weight</span><span className="stat-value">{latestExercise.health.weightKg} kg</span></div>
                  )}
                </div>
              </div>
            )}

            {paymentActivities.length > 0 && (
              <div className="summary-card" onClick={() => navigate('/tracker/finances')}>
                <div className="summary-card-header">
                  <span>{ACTIVITY_TYPE_META.payment.label}</span>
                  <span className="summary-count">{paymentActivities.length} entries</span>
                </div>
                <div className="summary-card-body">
                  <div className="summary-stat"><span className="stat-label">Paid</span><span className="stat-value done">{paymentActivities.filter((e) => e.status === 'paid').length}</span></div>
                  {paymentActivities.some((e) => e.status === 'skipped') && (
                    <div className="summary-stat"><span className="stat-label">Skipped</span><span className="stat-value" style={{ color: '#999' }}>{paymentActivities.filter((e) => e.status === 'skipped').length}</span></div>
                  )}
                </div>
              </div>
            )}

            <div className="entries-list">
              <h3 className="entries-list-title">
                {offset === 0 ? "Today's Log" : offset === -1 ? "Yesterday's Log" : 'Log'}
              </h3>
              {activities.map((entry) => (
                <div key={entry.id} className="entry-row">
                  <div className="entry-details">
                    {entry.type === 'finance' && (
                      <>
                        <span className={`entry-amount ${entry.direction}`}>
                          {entry.direction === 'expense' ? '-' : '+'}{formatCurrency(entry.amount, settings.currencySymbol)}
                        </span>
                        <span className="entry-meta">{getCategoryLabel(entry.category)}{entry.notes ? ` · ${entry.notes}` : ''}</span>
                      </>
                    )}
                    {entry.type === 'exercise' && (
                      <>
                        <span className="entry-primary">
                          {entry.workout.completed ? `Workout${entry.workout.durationMinutes ? ` — ${entry.workout.durationMinutes}min` : ''}` : 'Rest day'}
                        </span>
                        <span className="entry-meta">
                          {[entry.workout.workoutType, entry.health?.mood && `Mood: ${['', 'Awful', 'Bad', 'Okay', 'Good', 'Great'][entry.health.mood]}`, entry.health?.weightKg && `${entry.health.weightKg}kg`].filter(Boolean).join(' · ') || entry.notes || ''}
                        </span>
                      </>
                    )}
                    {entry.type === 'payment' && (
                      <>
                        {editingNotesId === entry.id ? (
                          <input className="form-input" value={editingNotesValue} onChange={(e) => setEditingNotesValue(e.target.value)}
                            onBlur={() => entry.id && handleSaveNotes(entry.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') entry.id && handleSaveNotes(entry.id); if (e.key === 'Escape') setEditingNotesId(null); }}
                            autoFocus onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <span className="entry-primary entry-notes-editable" title="Tap to edit notes"
                            onClick={(e) => { e.stopPropagation(); setEditingNotesId(entry.id!); setEditingNotesValue(entry.notes); }}>
                            {entry.notes || 'Payment'}
                          </span>
                        )}
                        <span className="entry-meta">{entry.status === 'paid' ? '✓ Paid' : '⟳ Skipped'} · {formatCurrency(entry.amount, settings.currencySymbol)}</span>
                      </>
                    )}
                    {entry.type === 'grocery' && (
                      <>
                        <span className="entry-primary">{(entry as GroceryActivity).tripName || 'Grocery trip'}</span>
                        <span className="entry-meta">
                          {(entry as GroceryActivity).tripMode === 'store' ? 'Store' : 'Online'}
                          {(entry as GroceryActivity).tripItems?.length ? ` · ${(entry as GroceryActivity).tripItems.length} items` : ''}
                        </span>
                      </>
                    )}
                    {entry.type === 'generic' && <span className="entry-primary">{entry.notes || 'Note'}</span>}
                    {offset !== 0 && <span className="entry-date-label">{entry.date}</span>}
                  </div>
                  <div className="entry-actions">
                    {(entry.type === 'finance' || entry.type === 'exercise') && (
                      <button className="entry-edit" onClick={(e) => { e.stopPropagation(); openDrawerWithActivity(entry); }} title="Edit">Edit</button>
                    )}
                    {entry.type === 'payment' && (
                      <button className="entry-unmark" onClick={(e) => { e.stopPropagation(); entry.id && handleDelete(entry.id); }} title="Unmark payment">Unmark</button>
                    )}
                    <button className="entry-delete" onClick={(e) => { e.stopPropagation(); entry.id && handleDelete(entry.id); }} title="Delete">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
