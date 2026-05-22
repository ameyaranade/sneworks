import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { deleteReminder, completeGenericReminder, addReminder, getCompletedGenericReminders } from '../firebase/trackerQueries';
import { ARCHIVE_PAGE_SIZE } from '../constants';
import { useToast } from '../components/Toast';
import type { GenericReminder } from '../types';
import type { Timestamp } from 'firebase/firestore';
import './reminders-page.css';


function formatDueDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCompletedAt(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const ms = ts.toMillis();
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RemindersPage() {
  const { user } = useAuth();
  const { reminders } = useTracker();
  const { showToast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const { openAdd } = (location.state ?? {}) as { openAdd?: boolean };
    if (openAdd) {
      setShowForm(true);
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Archived state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archived, setArchived] = useState<GenericReminder[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [archiveVisible, setArchiveVisible] = useState(ARCHIVE_PAGE_SIZE);

  const genericReminders = reminders.filter((r): r is GenericReminder => r.type === 'generic');

  const loadArchive = useCallback(async () => {
    if (!user || archiveLoaded) return;
    setArchiveLoading(true);
    try {
      const results = await getCompletedGenericReminders(user.uid);
      setArchived(results);
      setArchiveLoaded(true);
    } catch (e) {
      console.error('Load archive failed:', e);
      showToast('Failed to load archived reminders');
    } finally {
      setArchiveLoading(false);
    }
  }, [user, archiveLoaded, showToast]);

  const handleToggleArchive = () => {
    const next = !archiveOpen;
    setArchiveOpen(next);
    if (next) loadArchive();
  };

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
        ...(dueTime ? { dueTime } : {}),
      });
      setName('');
      setDueDate(todayStr);
      setDueTime('');
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
      // Invalidate archive so it reloads next open
      setArchiveLoaded(false);
      setArchived([]);
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

  const handleDeleteArchived = async (reminderId: string) => {
    if (!user) return;
    try {
      await deleteReminder(user.uid, reminderId);
      setArchived((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (e) {
      console.error('Delete archived reminder failed:', e);
      showToast('Failed to delete reminder');
    }
  };

  const visibleArchived = archived.slice(0, archiveVisible);
  const hasMoreArchive = archiveVisible < archived.length;

  return (
    <div className="reminders-page">
      <div className="reminders-header">
        <h2 className="page-title">Reminders</h2>
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
          <div className="reminders-form-date-row">
            <input
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <input
              type="time"
              className="form-input"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              placeholder="Time"
            />
          </div>
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
                  <span className="reminder-due">
                    Due {formatDueDate(r.dueDate)}{r.dueTime ? ` at ${r.dueTime}` : ''}
                  </span>
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

      {/* ─── Archived section ─── */}
      <div className="reminders-archive-section">
        <button className="reminders-archive-toggle" onClick={handleToggleArchive}>
          <span>Archived</span>
          {archiveLoaded && (
            <span className="reminders-archive-count">{archived.length}</span>
          )}
          <span className={`reminders-archive-chevron ${archiveOpen ? 'open' : ''}`}>›</span>
        </button>

        {archiveOpen && (
          <div className="reminders-archive-body">
            {archiveLoading ? (
              <p className="reminders-archive-hint">Loading…</p>
            ) : archived.length === 0 ? (
              <p className="reminders-archive-hint">No archived reminders.</p>
            ) : (
              <>
                <ul className="reminders-archive-list">
                  {visibleArchived.map((r) => (
                    <li key={r.id} className="reminder-archive-item">
                      <div className="reminder-archive-check">✓</div>
                      <div className="reminder-body">
                        <span className="reminder-name reminder-name--done">{r.name}</span>
                        {r.notes && <span className="reminder-notes">{r.notes}</span>}
                        {r.completedAt && (
                          <span className="reminder-notes">
                            Completed {formatCompletedAt(r.completedAt)}
                          </span>
                        )}
                      </div>
                      <button
                        className="reminder-delete-btn"
                        onClick={() => r.id && handleDeleteArchived(r.id)}
                        aria-label="Delete"
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
                {hasMoreArchive && (
                  <button
                    className="reminders-load-more"
                    onClick={() => setArchiveVisible((v) => v + ARCHIVE_PAGE_SIZE)}
                  >
                    Show {Math.min(ARCHIVE_PAGE_SIZE, archived.length - archiveVisible)} more
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
