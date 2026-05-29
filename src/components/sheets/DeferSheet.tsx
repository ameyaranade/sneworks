import { useState } from 'react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useTodosStore } from '../../stores/useTodosStore';
import { addDays, addHours, nextWeekend, nextMonday, buildTimestamp } from '../../utils';
import BottomSheet from '../primitives/BottomSheet';
import './defer-sheet.css';

interface DeferSheetProps {
  todoId: string;
  onClose: () => void;
}

export default function DeferSheet({ todoId, onClose }: DeferSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const deferTodo = useTodosStore((s) => s.deferTodo);
  const deferTodoPlusHours = useTodosStore((s) => s.deferTodoPlusHours);

  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');

  const uid = user?.uid ?? getCachedUid();
  if (!uid) return null;

  const defer = async (date: Date) => {
    try {
      await deferTodo(uid, todoId, date);
      showToast(`Moved to ${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`, 'info');
      onClose();
    } catch {
      showToast('Could not defer. Try again.', 'error');
    }
  };

  const deferHours = async (hours: number) => {
    try {
      await deferTodoPlusHours(uid, todoId, hours);
      showToast(`+${hours} hour${hours > 1 ? 's' : ''}`, 'info');
      onClose();
    } catch {
      showToast('Could not defer. Try again.', 'error');
    }
  };

  const deferSomeday = async () => {
    // Someday = far future (1 year), with no specific date intention
    const someday = addDays(new Date(), 365);
    try {
      await deferTodo(uid, todoId, someday);
      showToast('Moved to Someday', 'info');
      onClose();
    } catch {
      showToast('Could not defer. Try again.', 'error');
    }
  };

  const handleCustom = () => {
    if (!customDate) return;
    const ts = buildTimestamp(customDate, customTime || undefined);
    defer(ts.toDate());
  };

  const now = new Date();
  const tomorrow = addDays(now, 1);
  tomorrow.setHours(9, 0, 0, 0);
  const inTwoDays = addDays(now, 2);
  inTwoDays.setHours(9, 0, 0, 0);
  const weekend = nextWeekend();
  weekend.setHours(9, 0, 0, 0);
  const monday = nextMonday();
  monday.setHours(9, 0, 0, 0);
  const nextWeek = addDays(now, 7);
  nextWeek.setHours(9, 0, 0, 0);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <BottomSheet onClose={onClose} title="Move to…">
      <div className="sn-defer-options">
        <button type="button" className="sn-defer-btn" onClick={() => deferHours(1)}>
          <span className="sn-defer-btn__label">+1 hour</span>
          <span className="sn-defer-btn__date">{fmt(addHours(now, 1))}</span>
        </button>

        <button type="button" className="sn-defer-btn" onClick={() => defer(tomorrow)}>
          <span className="sn-defer-btn__label">Tomorrow</span>
          <span className="sn-defer-btn__date">{fmt(tomorrow)}</span>
        </button>

        <button type="button" className="sn-defer-btn" onClick={() => defer(inTwoDays)}>
          <span className="sn-defer-btn__label">In 2 days</span>
          <span className="sn-defer-btn__date">{fmt(inTwoDays)}</span>
        </button>

        <button type="button" className="sn-defer-btn" onClick={() => defer(weekend)}>
          <span className="sn-defer-btn__label">This weekend</span>
          <span className="sn-defer-btn__date">{fmt(weekend)}</span>
        </button>

        <button type="button" className="sn-defer-btn" onClick={() => defer(monday)}>
          <span className="sn-defer-btn__label">Next Monday</span>
          <span className="sn-defer-btn__date">{fmt(monday)}</span>
        </button>

        <button type="button" className="sn-defer-btn" onClick={() => defer(nextWeek)}>
          <span className="sn-defer-btn__label">Next week</span>
          <span className="sn-defer-btn__date">{fmt(nextWeek)}</span>
        </button>

        <button type="button" className="sn-defer-btn sn-defer-btn--someday" onClick={deferSomeday}>
          <span className="sn-defer-btn__label">Someday</span>
          <span className="sn-defer-btn__date">No specific date</span>
        </button>
      </div>

      <div className="sn-defer-divider" />

      <div className="sn-defer-custom">
        <p className="sn-defer-custom__label">Pick a date and time</p>
        <div className="sn-defer-custom__inputs">
          <input
            type="date"
            className="sn-defer-input"
            value={customDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDate(e.target.value)}
          />
          <input
            type="time"
            className="sn-defer-input"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="sn-defer-confirm-btn"
          disabled={!customDate}
          onClick={handleCustom}
        >
          {customDate
            ? `Move to ${buildTimestamp(customDate, customTime || undefined).toDate().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
            : 'Pick a date first'}
        </button>
      </div>
    </BottomSheet>
  );
}
