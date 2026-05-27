import { isToday, isSameDay, relativeDateLabel } from '../../utils';
import './day-header.css';

interface DayHeaderProps {
  date: Date;
  entryCount?: number;
}

export default function DayHeader({ date, entryCount }: DayHeaderProps) {
  const now = new Date();
  const isFuture = date > now && !isSameDay(date, now);
  const todayFlag = isToday(date);

  let variant: 'past' | 'today' | 'future' = 'past';
  if (todayFlag) variant = 'today';
  else if (isFuture) variant = 'future';

  return (
    <div className={`lg-day-header lg-day-header--${variant}`}>
      <div className="lg-day-header-left">
        <span className="lg-day-label">{relativeDateLabel(date)}</span>
        {todayFlag && <span className="lg-day-now-badge">Now</span>}
      </div>
      {entryCount !== undefined && (
        <span className="lg-day-count">{entryCount}</span>
      )}
    </div>
  );
}
