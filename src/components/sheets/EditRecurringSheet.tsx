import { useState } from 'react';
import { useAuth, getCachedUid } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { useGroupsStore } from '../../stores/useGroupsStore';
import BottomSheet from '../primitives/BottomSheet';
import type { RecurringTodoGroup } from '../../types';
import './edit-recurring-sheet.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const EXPENSE_CATS = ['Food', 'Transport', 'Bills', 'Health', 'Shopping', 'Entertainment', 'Other'];

export const RECUR_FREQ_OPTS = [
  { value: 'daily',     label: 'Daily' },
  { value: 'weekdays',  label: 'Weekdays' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly',    label: 'Yearly' },
] as const;
export type EditRecurFreq = typeof RECUR_FREQ_OPTS[number]['value'];

export const MONEY_RECUR_FREQ_OPTS = RECUR_FREQ_OPTS.filter(
  (o) => o.value !== 'daily' && o.value !== 'weekdays',
);

export const WEEKDAY_CODES_EDIT = [
  { code: 'MON', label: 'Mon' }, { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' }, { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' }, { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
] as const;

export function parseRecurrence(r: string): { freq: EditRecurFreq; dayCode: string; dueDay: number } {
  if (r.startsWith('weekly:'))    return { freq: 'weekly',    dayCode: r.split(':')[1], dueDay: 1 };
  if (r.startsWith('monthly:'))   return { freq: 'monthly',   dayCode: 'MON', dueDay: Number(r.split(':')[1]) };
  if (r.startsWith('quarterly:')) return { freq: 'quarterly', dayCode: 'MON', dueDay: Number(r.split(':')[1]) };
  if (r.startsWith('yearly:'))    return { freq: 'yearly',    dayCode: 'MON', dueDay: Number(r.split(':')[1]) };
  return { freq: r as EditRecurFreq, dayCode: 'MON', dueDay: 1 };
}

export function buildRecurrenceEdit(freq: EditRecurFreq, dayCode: string, dueDay: number): string {
  if (freq === 'weekly')    return `weekly:${dayCode}`;
  if (freq === 'monthly')   return `monthly:${dueDay}`;
  if (freq === 'quarterly') return `quarterly:${dueDay}`;
  if (freq === 'yearly')    return `yearly:${dueDay}`;
  return freq;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EditRecurringSheetProps {
  group: RecurringTodoGroup;
  onClose: () => void;
}

export default function EditRecurringSheet({ group, onClose }: EditRecurringSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const updateGroup = useGroupsStore((s) => s.updateGroup);
  const uid = user?.uid ?? getCachedUid();

  const isPayment = group.recurTodoType === 'money-reminder';
  const parsed = parseRecurrence(group.recurrence);

  const [name, setName]       = useState(group.name);
  const [amount, setAmount]   = useState(group.amount != null ? String(group.amount) : '');
  const [category, setCategory] = useState(group.category ?? '');
  const [freq, setFreq]       = useState<EditRecurFreq>(parsed.freq);
  const [dayCode, setDayCode] = useState(parsed.dayCode);
  const [dueDay, setDueDay]   = useState(parsed.dueDay || 1);
  const [saving, setSaving]   = useState(false);

  const freqOpts = isPayment ? MONEY_RECUR_FREQ_OPTS : RECUR_FREQ_OPTS;

  const handleSave = async () => {
    if (!name.trim() || !uid) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {
        name: name.trim(),
        recurrence: buildRecurrenceEdit(freq, dayCode, dueDay),
      };
      if (isPayment) {
        patch.amount   = amount ? Number(amount) : undefined;
        patch.category = category || undefined;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateGroup(uid, group.id!, patch as any);
      showToast('Updated', 'success');
      onClose();
    } catch {
      showToast('Could not update. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Edit recurring">
      <div className="sn-rtn-sheet-form">
        {/* Name */}
        <input
          type="text"
          className="sn-proj-sheet-input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={200}
        />

        {/* Payment-only fields */}
        {isPayment && (
          <>
            <div className="sn-rtn-field">
              <label className="sn-rtn-field-label">Amount (optional)</label>
              <input
                type="number"
                className="sn-compose-input"
                placeholder="₹ Amount"
                value={amount}
                min={0}
                step={0.01}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="sn-rtn-field">
              <label className="sn-rtn-field-label">Category</label>
              <div className="sn-rtn-chips">
                {EXPENSE_CATS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`sn-rtn-chip${category === cat ? ' sn-rtn-chip--active' : ''}`}
                    onClick={() => setCategory(category === cat ? '' : cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Repeat frequency */}
        <div className="sn-rtn-field">
          <label className="sn-rtn-field-label">Repeat</label>
          <div className="sn-rtn-chips">
            {freqOpts.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sn-rtn-chip${freq === opt.value ? ' sn-rtn-chip--active' : ''}`}
                onClick={() => setFreq(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {freq === 'weekly' && (
            <div className="sn-rtn-chips sn-rtn-chips--days" style={{ marginTop: 6 }}>
              {WEEKDAY_CODES_EDIT.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  className={`sn-rtn-chip sn-rtn-chip--sm${dayCode === d.code ? ' sn-rtn-chip--active' : ''}`}
                  onClick={() => setDayCode(d.code)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {(freq === 'monthly' || freq === 'quarterly' || freq === 'yearly') && (
            <div className="sn-rtn-field" style={{ marginTop: 8 }}>
              <label className="sn-rtn-field-label">
                {freq === 'monthly'
                  ? 'Day of month'
                  : freq === 'quarterly'
                  ? 'Day of month (Jan/Apr/Jul/Oct)'
                  : 'Day of year (in January)'}
              </label>
              <input
                type="number"
                className="sn-compose-input"
                min={1}
                max={28}
                value={dueDay}
                onChange={(e) => setDueDay(Math.min(28, Math.max(1, Number(e.target.value))))}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sn-proj-sheet-actions">
          <button type="button" className="sn-compose-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sn-compose-save-btn"
            disabled={!name.trim() || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
