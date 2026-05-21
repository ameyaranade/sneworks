import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { deleteReminder, completeGenericReminder, addReminder } from '../firebase/trackerQueries';
import { useToast } from '../components/Toast';
import type { GenericReminder } from '../types';
import './reminders-page.css';

function formatDueDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RemindersPage() {
  const { user } = useAuth();
  const { reminders } = useTracker();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const genericReminders = reminders.filter((r): r is GenericReminder => r.type === 'generic');

  const handleAdd = async () => {
    if (!user || !name.trim() || adding) return;
    setAdding(true);
    try {
      await addReminder(user.uid, {
        type: 'generic',
        name: name.trim(),
        notes,
        active: true,
        completed: false,
        ...(dueDate ? { dueDate } : {}),
      });
      setName('');
      setDueDate('');
      setNotes('');
      setShowForm(false);
    } catch (e) {
      console.error('Add reminder failed:', e);
      showToast('Failed to add reminder');
    } finally {
      setAdding(false);
    }
  };

  const handleComplete = async (reminderId: string) => {
    if (!user) return;
    try {
      await completeGenericReminder(user.uid, reminderId);
    } catch (e) {
      console.error('Complete reminder failed:', e);
      showToast('Failed to complete reminder');
    }
  };

  const handleDelete = async (reminderId: string) => {
    if (!user) return;
    try {
      await deleteReminder(user.uid, reminderId);
    } catch (e) {
      console.error('Delete reminder failed:', e);
      showToast('Failed to delete reminder');
    }
  };

  return (
    <div className="reminders-page">
      <div className="reminders-header">
        <h2 className="page-title">📌 Reminders</h2>
        <button className="reminders-add-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div className="reminders-form">
          <input
            type="text"
            className="form-input"
            placeholder="What do you need to remember?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <input
            type="date"
            className="form-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            className="form-submit"
            onClick={handleAdd}
            disabled={adding || !name.trim()}
          >
            {adding ? 'Saving…' : 'Add Reminder'}
          </button>
        </div>
      )}

      {genericReminders.length === 0 ? (
        <div className="reminders-empty">
          <p className="empty-text">No reminders yet.</p>
          <p className="empty-hint">Tap + Add to create one.</p>
        </div>
      ) : (
        <ul className="reminders-list">
          {genericReminders.map((r) => (
            <li key={r.id} className="reminder-item">
              <button
                className="reminder-complete-btn"
                onClick={() => r.id && handleComplete(r.id)}
                aria-label="Mark complete"
                title="Mark as done"
              />
              <div className="reminder-body">
                <span className="reminder-name">{r.name}</span>
                {r.dueDate && (
                  <span className="reminder-due">Due {formatDueDate(r.dueDate)}</span>
                )}
                {r.notes && <span className="reminder-notes">{r.notes}</span>}
              </div>
              <button
                className="reminder-delete-btn"
                onClick={() => r.id && handleDelete(r.id)}
                aria-label="Delete reminder"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
