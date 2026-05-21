import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { addReminder } from '../firebase/trackerQueries';
import './form-shared.css';

interface Props {
  onSaved: () => void;
}

export default function GenericReminderForm({ onSaved }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await addReminder(user.uid, {
        type: 'generic',
        name: name.trim(),
        notes,
        active: true,
        completed: false,
        ...(dueDate ? { dueDate } : {}),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <label className="form-label">Reminder</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Call dentist, Renew passport"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      </div>
      <div className="form-group">
        <label className="form-label">Due date (optional)</label>
        <input
          type="date"
          className="form-input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <input
          type="text"
          className="form-input"
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button
        className="form-submit"
        onClick={handleSubmit}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Saving…' : 'Add Reminder'}
      </button>
    </div>
  );
}
