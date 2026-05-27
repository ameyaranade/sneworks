import { useMemo } from 'react';
import { useEntriesStore } from '../../stores/useEntriesStore';
import { addDays, isToday, isSameDay, startOfDay, endOfDay } from '../../utils';
import './week-strip.css';

interface WeekStripProps {
  weekStart: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export default function WeekStrip({ weekStart, selectedDate, onSelectDate }: WeekStripProps) {
  const allEntries = useEntriesStore((s) => s.entries);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
  [weekStart]);

  // Count entries per day for density dots
  const countForDay = (date: Date) => {
    const start = startOfDay(date).getTime();
    const end = endOfDay(date).getTime();
    return allEntries.filter((e) => {
      const ms = (e.occurredAt ?? e.dueAt ?? e.createdAt)?.toMillis?.();
      return ms !== undefined && ms >= start && ms <= end;
    }).length;
  };

  return (
    <div className="lg-week-strip">
      {days.map((day) => {
        const count = countForDay(day);
        const isSelected = isSameDay(day, selectedDate);
        const isNow = isToday(day);
        return (
          <button
            key={day.toISOString()}
            type="button"
            className={`lg-week-day${isSelected ? ' lg-week-day--selected' : ''}${isNow ? ' lg-week-day--today' : ''}`}
            onClick={() => onSelectDate(day)}
          >
            <span className="lg-week-day-name">
              {day.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)}
            </span>
            <span className="lg-week-day-num">{day.getDate()}</span>
            {count > 0 && (
              <div className="lg-week-day-dots">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                  <span key={i} className="lg-week-dot" />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
