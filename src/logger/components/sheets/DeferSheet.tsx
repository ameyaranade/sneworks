import { useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import { useEntriesStore } from '../../stores/useEntriesStore';
import { addDays } from '../../utils';
import BottomSheet from '../primitives/BottomSheet';
import './defer-sheet.css';

interface DeferSheetProps {
  entryId: string;
  onClose: () => void;
}

export default function DeferSheet({ entryId, onClose }: DeferSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const deferEntry = useEntriesStore((s) => s.deferEntry);
  const [customDate, setCustomDate] = useState('');

  const defer = async (date: Date) => {
    if (!user) return;
    try {
      await deferEntry(user.uid, entryId, date);
      showToast('Deferred', 'info');
      onClose();
    } catch {
      showToast('Could not defer. Try again.', 'error');
    }
  };

  const tomorrow = addDays(new Date(), 1);
  const nextWeek = addDays(new Date(), 7);

  return (
    <BottomSheet onClose={onClose} title="Defer to…">
      <div className="lg-defer-options">
        <button type="button" className="lg-defer-btn lg-defer-btn--tomorrow" onClick={() => defer(tomorrow)}>
          <span className="lg-defer-label">Tomorrow</span>
          <span className="lg-defer-date">
            {tomorrow.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </button>

        <button type="button" className="lg-defer-btn lg-defer-btn--week" onClick={() => defer(nextWeek)}>
          <span className="lg-defer-label">Next week</span>
          <span className="lg-defer-date">
            {nextWeek.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </button>

        <div className="lg-defer-custom">
          <label className="lg-defer-custom-label">Pick a date</label>
          <div className="lg-defer-custom-row">
            <input
              type="date"
              className="lg-defer-date-input"
              value={customDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomDate(e.target.value)}
            />
            <button
              type="button"
              className="lg-defer-custom-btn"
              disabled={!customDate}
              onClick={() => customDate && defer(new Date(customDate + 'T00:00:00'))}
            >
              Set
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
