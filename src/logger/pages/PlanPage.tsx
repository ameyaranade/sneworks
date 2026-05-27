import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { startOfWeek, addDays, startOfDay, endOfDay, relativeDateLabel } from '../utils';
import WeekStrip from '../components/composites/WeekStrip';
import EntryList from '../components/composites/EntryList';
import './plan-page.css';

export default function PlanPage() {
  const now = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(now);

  const weekStart = useMemo(
    () => addDays(startOfWeek(now), weekOffset * 7),
    [weekOffset],
  );

  const allEntries = useEntriesStore((s) => s.entries);

  const dayEntries = useMemo(() => {
    const start = startOfDay(selectedDate).getTime();
    const end = endOfDay(selectedDate).getTime();
    return allEntries.filter((e) => {
      const ms = (e.occurredAt ?? e.dueAt ?? e.createdAt)?.toMillis?.();
      return ms !== undefined && ms >= start && ms <= end;
    });
  }, [allEntries, selectedDate]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.toLocaleDateString('en-IN', { day: 'numeric' })}–${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [weekStart]);

  return (
    <div className="lg-plan-page">
      {/* Week navigation */}
      <div className="lg-plan-header">
        <button type="button" className="lg-plan-nav-btn" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <span className="lg-plan-week-label">{weekLabel}</span>
        <button type="button" className="lg-plan-nav-btn" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Week strip */}
      <div className="lg-plan-strip-wrap">
        <WeekStrip
          weekStart={weekStart}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* Selected day entries */}
      <div className="lg-plan-day-content">
        <div className="lg-plan-day-title">{relativeDateLabel(selectedDate)}</div>
        {dayEntries.length === 0 ? (
          <div className="lg-plan-day-empty">
            <p>Nothing planned. Tap + to add.</p>
          </div>
        ) : (
          <EntryList entries={dayEntries} showTime />
        )}
      </div>
    </div>
  );
}
