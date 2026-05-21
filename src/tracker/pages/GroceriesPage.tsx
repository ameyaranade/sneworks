import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import {
  updateActiveGroceryList,
  archiveGroceryTrip,
  getGroceryTrips,
} from '../firebase/trackerQueries';
import { formatDate } from '../utils';
import { ACTIVITY_TYPE_META } from '../constants';
import { useToast } from '../components/Toast';
import type { GroceryItem, GroceryTrip } from '../types';
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
  return `Grocery Run ${dd}-${mm}-${d.getFullYear()}`;
}

export default function GroceriesPage() {
  const { user } = useAuth();
  const { activeGroceryList } = useTracker();
  const { showToast } = useToast();

  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  const [showArchiveFlow, setShowArchiveFlow] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripMode, setTripMode] = useState<'store' | 'online'>('store');
  const [archiving, setArchiving] = useState(false);

  const [pastTrips, setPastTrips] = useState<GroceryTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    getGroceryTrips(user.uid)
      .then(setPastTrips)
      .catch(() => setPastTrips([]))
      .finally(() => setTripsLoading(false));
  }, [user]);

  const items: GroceryItem[] = activeGroceryList?.items ?? [];
  const unchecked = [...items.filter((i) => !i.checked)].sort((a, b) => a.sortOrder - b.sortOrder);
  const checked = [...items.filter((i) => i.checked)].sort(
    (a, b) => (a.checkedAt?.seconds ?? 0) - (b.checkedAt?.seconds ?? 0),
  );

  const handleAdd = async () => {
    if (!user || !addName.trim() || adding) return;
    setAdding(true);
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    const newItem: GroceryItem = {
      id: crypto.randomUUID(),
      name: addName.trim(),
      checked: false,
      addedAt: Timestamp.now(),
      sortOrder: maxOrder + 1,
    };
    try {
      await updateActiveGroceryList(user.uid, [...items, newItem]);
      setAddName('');
    } catch (e) {
      console.error('Add grocery item failed:', e);
      showToast('Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (itemId: string) => {
    if (!user) return;
    const updated = items.map((i) => {
      if (i.id !== itemId) return i;
      const next: GroceryItem = { ...i, checked: !i.checked };
      if (i.checked) delete next.checkedAt;  // removing undefined breaks Firestore
      else next.checkedAt = Timestamp.now();
      return next;
    });
    try {
      await updateActiveGroceryList(user.uid, updated);
    } catch (e) {
      console.error('Grocery toggle failed:', e);
      showToast('Failed to update item');
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!user) return;
    try {
      await updateActiveGroceryList(user.uid, items.filter((i) => i.id !== itemId));
    } catch (e) {
      console.error('Remove grocery item failed:', e);
      showToast('Failed to remove item');
    }
  };

  const openArchiveFlow = () => {
    setTripName(getDefaultTripName());
    setTripMode('store');
    setShowArchiveFlow(true);
  };

  const handleArchive = async () => {
    if (!user || !tripName.trim() || archiving) return;
    setArchiving(true);
    try {
      await archiveGroceryTrip(
        user.uid,
        { name: tripName.trim(), items: checked, tripMode, date: formatDate(new Date()) },
        unchecked,
      );
      setShowArchiveFlow(false);
      const trips = await getGroceryTrips(user.uid).catch(() => []);
      setPastTrips(trips);
    } catch (e) {
      console.error('Archive grocery trip failed:', e);
      showToast('Failed to complete trip');
    } finally {
      setArchiving(false);
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
        <h2 className="page-title">{ACTIVITY_TYPE_META.grocery.emoji} Groceries</h2>
        {checked.length > 0 && (
          <button className="groceries-done-btn" onClick={openArchiveFlow}>
            Done ({checked.length})
          </button>
        )}
      </div>

      {/* Add item */}
      <div className="grocery-add-row">
        <input
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
          disabled={adding || !addName.trim()}
        >
          Add
        </button>
      </div>

      {/* Active list */}
      {items.length === 0 ? (
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
                onClick={() => handleToggle(item.id)}
                aria-label="Check item"
              />
              <span className="grocery-item-name">{item.name}</span>
              <button
                className="grocery-item-remove"
                onClick={() => handleRemove(item.id)}
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
                onClick={() => handleToggle(item.id)}
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
                onClick={() => handleRemove(item.id)}
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
                <button className="trip-row-header" onClick={() => toggleTripExpanded(id)}>
                  <span className="trip-row-arrow">{isExpanded ? '▾' : '▸'}</span>
                  <span className="trip-row-name">{trip.name}</span>
                  <span className="trip-row-meta">
                    {trip.tripMode === 'store' ? '🏪' : '🛒'} · {trip.items.length} items
                  </span>
                  <span className="trip-row-date">{formatTripDate(trip.date)}</span>
                </button>
                {isExpanded && (
                  <ul className="trip-items">
                    {trip.items.map((item) => (
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
        <div className="archive-overlay" onClick={() => setShowArchiveFlow(false)}>
          <div className="archive-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="archive-sheet-handle" />
            <h3 className="archive-sheet-title">Complete Trip</h3>
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
                  🏪 Store
                </button>
                <button
                  className={`trip-mode-btn ${tripMode === 'online' ? 'active' : ''}`}
                  onClick={() => setTripMode('online')}
                >
                  🛒 Online
                </button>
              </div>
            </div>

            <button
              className="archive-confirm-btn"
              onClick={handleArchive}
              disabled={archiving || !tripName.trim()}
            >
              {archiving ? 'Saving…' : 'Complete Trip'}
            </button>
            <button className="archive-cancel-btn" onClick={() => setShowArchiveFlow(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
