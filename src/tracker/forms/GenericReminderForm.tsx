import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { addReminder, updateReminder } from '../firebase/trackerQueries';
import { formatDate } from '../utils';
import type { GenericReminder } from '../types';
import './form-shared.css';

interface Props {
  onSaved: () => void;
  initialDate?: string;
  initialReminder?: GenericReminder;
  entryId?: string;
}

export default function GenericReminderForm({ onSaved, initialDate, initialReminder, entryId }: Props) {
  const { user } = useAuth();
  const today = initialDate ?? formatDate(new Date());
  const [name, setName] = useState(initialReminder?.name ?? '');
  const [dueDate, setDueDate] = useState(initialReminder?.dueDate ?? today);
  const [dueTime, setDueTime] = useState(initialReminder?.dueTime ?? '');
  const [notes, setNotes] = useState(initialReminder?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !name.trim() || saving) return;
    setSaving(true);
    try {
      if (entryId) {
        await updateReminder(user.uid, entryId, {
          name: name.trim(),
          notes,
          ...(dueDate ? { dueDate } : { dueDate: undefined }),
          ...(dueTime ? { dueTime } : { dueTime: undefined }),
        });
      } else {
        await addReminder(user.uid, {
          type: 'generic',
          name: name.trim(),
          notes,
          active: true,
          completed: false,
          ...(dueDate ? { dueDate } : {}),
          ...(dueTime ? { dueTime } : {}),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <input
          type="text"
          className="form-input"
          placeholder="What do you need to remember?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <input
            type="date"
            className="form-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <input
            type="time"
            className="form-input"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>
      </div>
      <div className="form-group">
        <input
          type="text"
          className="form-input"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button
        className="form-submit"
        onClick={handleSubmit}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Saving…' : entryId ? 'Update' : 'Add Reminder'}
      </button>
    </div>
  );
}
