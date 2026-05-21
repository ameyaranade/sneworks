import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { updateActiveGroceryList } from '../firebase/trackerQueries';
import type { GroceryItem } from '../types';
import './form-shared.css';

interface Props {
  onSaved: () => void;
}

export default function GroceryForm({ onSaved }: Props) {
  const { user } = useAuth();
  const { activeGroceryList } = useTracker();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !name.trim() || saving) return;
    setSaving(true);
    const items = activeGroceryList?.items ?? [];
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    const newItem: GroceryItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      checked: false,
      addedAt: Timestamp.now(),
      sortOrder: maxOrder + 1,
    };
    try {
      await updateActiveGroceryList(user.uid, [...items, newItem]);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <label className="form-label">Item</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Milk, Bread, Eggs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      </div>
      <button
        className="form-submit"
        onClick={handleSubmit}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Adding…' : 'Add to List'}
      </button>
    </div>
  );
}
