import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { addActivity } from '../firebase/trackerQueries';
import { formatDate } from '../utils';
import './form-shared.css';

interface Props {
  onSaved: () => void;
  initialDate?: string;
}

export default function GenericActivityForm({ onSaved, initialDate }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(initialDate ?? formatDate(new Date()));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !notes.trim()) return;
    setSaving(true);
    try {
      await addActivity(user.uid, { type: 'generic', date, notes: notes.trim() });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <label className="form-label">Note</label>
        <input
          type="text"
          className="form-input"
          placeholder="What happened?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      </div>
      <div className="form-group">
        <label className="form-label">Date</label>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <button
        className="form-submit"
        onClick={handleSubmit}
        disabled={saving || !notes.trim()}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
