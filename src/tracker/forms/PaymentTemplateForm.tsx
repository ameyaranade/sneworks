import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { addReminder } from '../firebase/trackerQueries';
import { PAYMENT_FREQUENCIES } from '../constants';
import type { PaymentFrequency } from '../types';
import './form-shared.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  onSaved: () => void;
}

export default function PaymentTemplateForm({ onSaved }: Props) {
  const { user } = useAuth();
  const { settings } = useTracker();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<PaymentFrequency>('monthly');
  const [dueDay, setDueDay] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isWeekBased = frequency === 'weekly' || frequency === 'biweekly';

  const handleFrequencyChange = (f: PaymentFrequency) => {
    setFrequency(f);
    const nowWeekBased = f === 'weekly' || f === 'biweekly';
    if (nowWeekBased !== isWeekBased) setDueDay(nowWeekBased ? 1 : 1);
  };

  const handleDayInput = (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    setDueDay(Math.min(28, Math.max(1, n)));
  };

  const handleSubmit = async () => {
    if (!user || !name.trim() || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await addReminder(user.uid, {
        type: 'finance',
        name: name.trim(),
        amount: Number(amount),
        frequency,
        dueDay,
        notes,
        active: true,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entry-form">
      <div className="form-group">
        <label className="form-label">Name</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Netflix, Rent, Gym"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
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
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Frequency</label>
        <div className="category-chips">
          {PAYMENT_FREQUENCIES.map((f) => (
            <button
              key={f.value}
              className={`category-chip ${frequency === f.value ? 'active' : ''}`}
              onClick={() => handleFrequencyChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          {isWeekBased ? 'Due Day of Week' : 'Due Day of Month (1–28)'}
        </label>
        {isWeekBased ? (
          <div className="category-chips">
            {DAYS_OF_WEEK.map((day, i) => (
              <button
                key={i}
                className={`category-chip ${dueDay === i ? 'active' : ''}`}
                onClick={() => setDueDay(i)}
              >
                {day}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="number"
            className="form-input"
            min={1}
            max={28}
            value={dueDay}
            onChange={(e) => handleDayInput(e.target.value)}
            inputMode="numeric"
          />
        )}
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
        disabled={saving || !name.trim() || !amount || Number(amount) <= 0}
      >
        {saving ? 'Saving...' : 'Add Payment'}
      </button>
    </div>
  );
}
