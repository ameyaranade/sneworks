import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { addActivity, updateActivity } from '../firebase/trackerQueries';
import { FINANCE_CATEGORIES } from '../constants';
import { formatDate } from '../utils';
import type { FinanceCategory, FinanceDirection, FinanceActivity } from '../types';
import './form-shared.css';

interface FinanceFormProps {
  onSaved: () => void;
  initialValues?: FinanceActivity;
  entryId?: string;
}

export default function FinanceForm({ onSaved, initialValues, entryId }: FinanceFormProps) {
  const { user } = useAuth();
  const { settings } = useTracker();
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '');
  const [category, setCategory] = useState<FinanceCategory>(initialValues?.category ?? 'food');
  const [direction, setDirection] = useState<FinanceDirection>(initialValues?.direction ?? 'expense');
  const [date, setDate] = useState(initialValues?.date ?? formatDate(new Date()));
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      if (entryId) {
        await updateActivity(user.uid, entryId, { amount: Number(amount), direction, category, date, notes });
      } else {
        await addActivity(user.uid, { type: 'finance', amount: Number(amount), direction, category, date, notes });
      }
      onSaved();
    } catch (e) {
      console.error('Save finance entry failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <div className="direction-toggle">
          <button
            className={`direction-btn ${direction === 'expense' ? 'active expense' : ''}`}
            onClick={() => setDirection('expense')}
          >
            Expense
          </button>
          <button
            className={`direction-btn ${direction === 'income' ? 'active income' : ''}`}
            onClick={() => setDirection('income')}
          >
            Income
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Amount</label>
        <div className="amount-input-wrap">
          <span className="amount-symbol">{settings.currencySymbol}</span>
          <input
            type="number"
            className="amount-input"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Category</label>
        <div className="category-chips">
          {FINANCE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`category-chip ${category === cat.value ? 'active' : ''}`}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
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
        disabled={saving || !amount || Number(amount) <= 0}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
