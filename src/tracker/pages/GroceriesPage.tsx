import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { Timestamp } from 'firebase/firestore';
import {
  addReminder,
  deleteReminder,
  deleteActivity,
  toggleGroceryReminder,
  archiveGroceryTrip,
  subscribeToActivitiesByType,
} from '../firebase/trackerQueries';
import { formatDate } from '../utils';
import { useToast } from '../components/Toast';
import type { GroceryReminder, GroceryActivity } from '../types';
import './groceries-page.css';

function formatTime(ts?: Timestamp): string {
  if (!ts) return '';
  return ts.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatTripDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function getDefaultTripName(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `Shop: ${dd}-${mm}-${d.getFullYear()}`;
}

export default function GroceriesPage() {
  const { user } = useAuth();
  const { reminders } = useTracker();
  const { showToast } = useToast();
  const location = useLocation();
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { openAdd } = (location.state ?? {}) as { openAdd?: boolean };
    if (openAdd) {
      addInputRef.current?.focus();
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [addName, setAddName] = useState('');

  const [showArchiveFlow, setShowArchiveFlow] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripMode, setTripMode] = useState<'store' | 'online'>('store');
  const archiveSheetRef = useRef<HTMLDivElement>(null);

  const [pastTrips, setPastTrips] = useState<GroceryActivity[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    setTripsLoading(true);
    const unsub = subscribeToActivitiesByType<GroceryActivity>(user.uid, 'grocery', (trips) => {
      setPastTrips(trips);
      setTripsLoading(false);
    });
    return unsub;
  }, [user]);

  const groceryReminders = (reminders.filter((r) => r.type === 'grocery') as GroceryReminder[])
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const unchecked = groceryReminders.filter((r) => !r.checked);
  const checked = groceryReminders.filter((r) => r.checked)
    .sort((a, b) => (a.checkedAt?.seconds ?? 0) - (b.checkedAt?.seconds ?? 0));

  const handleAdd = async () => {
    if (!user || !addName.trim()) return;
    const name = addName.trim();
    const maxOrder = groceryReminders.reduce((m, r) => Math.max(m, r.sortOrder), -1);
    setAddName('');
    try {
      await addReminder(user.uid, {
        type: 'grocery',
        name,
        notes: '',
        active: true,
        checked: false,
        sortOrder: maxOrder + 1,
      });
    } catch (e) {
      console.error('Add grocery item failed:', e);
      setAddName(name);
      showToast('Failed to add item');
    }
  };

  const handleToggle = async (reminder: GroceryReminder) => {
    if (!user || !reminder.id) return;
    try {
      await toggleGroceryReminder(user.uid, reminder.id, !reminder.checked);
    } catch (e) {
      console.error('Grocery toggle failed:', e);
      showToast('Failed to update item');
    }
  };

  const handleRemove = async (reminderId: string) => {
    if (!user) return;
    try {
      await deleteReminder(user.uid, reminderId);
    } catch (e) {
      console.error('Remove grocery item failed:', e);
      showToast('Failed to remove item');
    }
  };

  const closeArchiveFlow = useCallback(() => setShowArchiveFlow(false), []);

  useEffect(() => {
    if (!showArchiveFlow) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = archiveSheetRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeArchiveFlow(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [showArchiveFlow, closeArchiveFlow]);

  const openArchiveFlow = () => {
    setTripName(getDefaultTripName());
    setTripMode('store');
    setShowArchiveFlow(true);
  };

  const handleArchive = async () => {
    if (!user || !tripName.trim()) return;

    const today = formatDate(new Date());
    const optimisticId = `opt-${Date.now()}`;
    const optimisticTrip: GroceryActivity = {
      id: optimisticId,
      type: 'grocery',
      date: today,
      notes: '',
      tripName: tripName.trim(),
      tripMode,
      tripItems: checked.map((r) => ({
        id: r.id!,
        name: r.name,
        checked: true,
        ...(r.checkedAt ? { checkedAt: r.checkedAt } : {}),
      })),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    setPastTrips((prev) => [optimisticTrip, ...prev]);
    setShowArchiveFlow(false);

    try {
      await archiveGroceryTrip(user.uid, tripName.trim(), tripMode, checked, today);
    } catch (e) {
      console.error('Archive grocery trip failed:', e);
      setPastTrips((prev) => prev.filter((t) => t.id !== optimisticId));
      showToast('Failed to complete trip');
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!user) return;
    try {
      await deleteActivity(user.uid, tripId);
    } catch (e) {
      console.error('Delete trip failed:', e);
      showToast('Failed to delete trip');
    }
  };

  const toggleTripExpanded = (tripId: string) => {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  };

  return (
    <div className="groceries-page">
      {/* Header */}
      <div className="groceries-header">
        <h2 className="page-title">Shop</h2>
        {checked.length > 0 && (
          <button className="groceries-done-btn" onClick={openArchiveFlow}>
            Done ({checked.length})
          </button>
        )}
      </div>

      {/* Add item */}
      <div className="grocery-add-row">
        <input
          ref={addInputRef}
          type="text"
          className="grocery-add-input"
          placeholder="Add item…"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          className="grocery-add-btn"
          onClick={handleAdd}
          disabled={!addName.trim()}
        >
          Add
        </button>
      </div>

      {/* Active list */}
      {groceryReminders.length === 0 ? (
        <div className="groceries-empty">
          <p className="empty-text">Your list is empty.</p>
          <p className="empty-hint">Type an item above to get started.</p>
        </div>
      ) : (
        <ul className="grocery-list">
          {unchecked.map((item) => (
            <li key={item.id} className="grocery-item">
              <button
                className="grocery-checkbox"
                onClick={() => handleToggle(item)}
                aria-label="Check item"
              />
              <span className="grocery-item-name">{item.name}</span>
              <button
                className="grocery-item-remove"
                onClick={() => handleRemove(item.id!)}
                aria-label="Remove item"
              >
                &times;
              </button>
            </li>
          ))}

          {checked.length > 0 && unchecked.length > 0 && (
            <li className="grocery-divider" />
          )}

          {checked.map((item) => (
            <li key={item.id} className="grocery-item grocery-item--checked">
              <button
                className="grocery-checkbox grocery-checkbox--checked"
                onClick={() => handleToggle(item)}
                aria-label="Uncheck item"
              >
                ✓
              </button>
              <span className="grocery-item-name">{item.name}</span>
              {item.checkedAt && (
                <span className="grocery-item-time">{formatTime(item.checkedAt)}</span>
              )}
              <button
                className="grocery-item-remove"
                onClick={() => handleRemove(item.id!)}
                aria-label="Remove item"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Past trips */}
      {!tripsLoading && pastTrips.length > 0 && (
        <section className="past-trips">
          <h3 className="past-trips-title">Past Trips</h3>
          {pastTrips.map((trip) => {
            const id = trip.id!;
            const isExpanded = expandedTrips.has(id);
            return (
              <div key={id} className="trip-row">
                <div className="trip-row-top">
                  <button
                    className="trip-row-header"
                    onClick={() => toggleTripExpanded(id)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} trip ${trip.tripName}`}
                  >
                    <span className="trip-row-arrow">{isExpanded ? '▾' : '▸'}</span>
                    <span className="trip-row-name">{trip.tripName}</span>
                    <span className="trip-row-meta">
                      {trip.tripMode === 'store' ? 'Store' : 'Online'} · {trip.tripItems.length} items
                    </span>
                    <span className="trip-row-date">{formatTripDate(trip.date)}</span>
                  </button>
                  <button
                    className="trip-row-delete-btn"
                    onClick={() => handleDeleteTrip(id)}
                    aria-label="Delete trip"
                  >
                    &times;
                  </button>
                </div>
                {isExpanded && (
                  <ul className="trip-items">
                    {trip.tripItems.map((item) => (
                      <li key={item.id} className="trip-item">
                        <span className="trip-item-check">✓</span>
                        <span className="trip-item-name">{item.name}</span>
                        {item.checkedAt && (
                          <span className="trip-item-time">{formatTime(item.checkedAt)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Archive overlay */}
      {showArchiveFlow && (
        <div className="archive-overlay" onClick={closeArchiveFlow}>
          <div
            ref={archiveSheetRef}
            className="archive-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="archive-sheet-handle" />
            <h3 id="archive-sheet-title" className="archive-sheet-title">Complete Trip</h3>
            <p className="archive-sheet-sub">{checked.length} item{checked.length !== 1 ? 's' : ''} checked</p>

            <div className="archive-field">
              <label className="archive-label">Trip Name</label>
              <input
                type="text"
                className="archive-input"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
              />
            </div>

            <div className="archive-field">
              <label className="archive-label">Mode</label>
              <div className="trip-mode-toggle">
                <button
                  className={`trip-mode-btn ${tripMode === 'store' ? 'active' : ''}`}
                  onClick={() => setTripMode('store')}
                >
                  Store
                </button>
                <button
                  className={`trip-mode-btn ${tripMode === 'online' ? 'active' : ''}`}
                  onClick={() => setTripMode('online')}
                >
                  Online
                </button>
              </div>
            </div>

            <button
              className="archive-confirm-btn"
              onClick={handleArchive}
              disabled={!tripName.trim()}
            >
              Complete Trip
            </button>
            <button className="archive-cancel-btn" onClick={closeArchiveFlow}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
