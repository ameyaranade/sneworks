import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { useDrawer } from '../TrackerShell';
import { useToast } from '../components/Toast';
import {
  subscribeToActivitiesForDateRange,
  deleteActivity,
} from '../firebase/trackerQueries';
import { ACTIVITY_TYPE_META } from '../constants';
import { formatCurrency } from '../utils';
import type { Activity, FinanceActivity, ExerciseActivity, PaymentActivity, GroceryActivity } from '../types';
import './calendar-page.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { settings } = useTracker();
  const { openDrawerWithActivity } = useDrawer();
  const { showToast } = useToast();

  const today = new Date();
  const todayStr = toYMD(today.getFullYear(), today.getMonth(), today.getDate());

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [monthActivities, setMonthActivities] = useState<Activity[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setSelectedDay(null);

    const startDate = toYMD(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const endDate = toYMD(currentYear, currentMonth, daysInMonth);

    const unsub = subscribeToActivitiesForDateRange(user.uid, startDate, endDate, (activities) => {
      setMonthActivities(activities);
      setLoading(false);
    });

    return unsub;
  }, [user, currentYear, currentMonth]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Map each date string → set of activity type strings present that day
  const dayActivityMap = new Map<string, Set<string>>();
  for (const activity of monthActivities) {
    if (!dayActivityMap.has(activity.date)) dayActivityMap.set(activity.date, new Set());
    dayActivityMap.get(activity.date)!.add(activity.type);
  }

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDay((prev) => (prev === dateStr ? null : dateStr));
  };

  const handleDelete = async (activityId: string) => {
    if (!user) return;
    try { await deleteActivity(user.uid, activityId); }
    catch { showToast('Failed to delete entry'); }
  };

  const selectedActivities = selectedDay
    ? [...monthActivities].filter((e) => e.date === selectedDay).reverse()
    : [];

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <h2 className="cal-month-title">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-day-labels">
        {DAY_LABELS.map((d) => <span key={d} className="cal-day-label">{d}</span>)}
      </div>

      {loading ? (
        <p className="cal-loading">Loading…</p>
      ) : (
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} className="cal-cell cal-cell--blank" />;
            const dateStr = toYMD(currentYear, currentMonth, day);
            const types = dayActivityMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            return (
              <div
                key={dateStr}
                className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isSelected ? ' cal-cell--selected' : ''}${types ? ' cal-cell--has-entries' : ''}`}
                onClick={() => types && handleDayClick(dateStr)}
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
      )}

      {selectedDay && (
        <div className="cal-day-detail">
          <div className="cal-detail-header">
            <span className="cal-detail-date">
              {parseLocalDate(selectedDay).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <button className="cal-detail-close" onClick={() => setSelectedDay(null)}>×</button>
          </div>

          {selectedActivities.length === 0 ? (
            <p className="cal-detail-empty">No entries for this day.</p>
          ) : (
            <div className="cal-detail-entries">
              {selectedActivities.map((entry) => (
                <div key={entry.id} className="cal-entry-row">
                  <span
                    className="cal-entry-badge"
                    style={{ background: ACTIVITY_TYPE_META[entry.type].color }}
                  >
                    {ACTIVITY_TYPE_META[entry.type].emoji}
                  </span>
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
                      <button
                        className="entry-edit"
                        onClick={() => entry.id && openDrawerWithActivity(entry)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                    )}
                    {entry.type === 'payment' && (
                      <button
                        className="entry-unmark"
                        onClick={() => entry.id && handleDelete(entry.id)}
                        title="Unmark"
                      >
                        Unmark
                      </button>
                    )}
                    <button
                      className="entry-delete"
                      onClick={() => entry.id && handleDelete(entry.id)}
                      title="Delete"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
