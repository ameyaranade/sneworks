import { useState, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import {
  CheckSquare, IndianRupee, ShoppingCart,
  TrendingUp, StickyNote, Heart,
  ChevronLeft,
} from 'lucide-react';
import { useAuth, getCachedUid } from '../../../auth/AuthContext';
import { useToast } from '../../../shared/components/Toast';
import { useTodosStore } from '../../stores/useTodosStore';
import { useLogsStore } from '../../stores/useLogsStore';
import { recomputeGroupCounts } from '../../firebase/groupQueries';
import type { Todo, TodoType, Log, LogType, ShoppingItemTodo, MoneyReminderTodo, ExpenseLog, IncomeLog, HealthLog, GenericNoteLog } from '../../types';
import { useGroupsStore } from '../../stores/useGroupsStore';
import { spawnDueRecurringTodos } from '../../firebase/routineSpawner';
import { buildTimestamp, tsToDateStr, tsToTimeStr } from '../../utils';
import BottomSheet from '../primitives/BottomSheet';
import './compose-sheet.css';

type Step = 'type-picker' | 'form';
type Mode = 'todo' | 'log';

interface ComposeSheetProps {
  onClose: () => void;
  mode: Mode;
  editEntry?: Todo | Log;
  preselectedTodoType?: TodoType;
  preselectedLogType?: LogType;
  preselectedGroupId?: string;
}

// ── Type Picker Cards ─────────────────────────────────────────────────────────

interface TypeCard {
  id: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  color: string;
  available: boolean;
}

const TODO_TYPES: TypeCard[] = [
  { id: 'generic-task', label: 'Task', sub: 'Anything to get done', Icon: CheckSquare, color: 'var(--sb-accent)', available: true },
  { id: 'money-reminder', label: 'Payment', sub: 'Bills, reminders, recurring', Icon: IndianRupee, color: 'var(--sb-gold)', available: true },
  { id: 'shopping-item', label: 'Shopping', sub: 'Items to buy', Icon: ShoppingCart, color: 'var(--sb-accent)', available: true },
];

const LOG_TYPES: TypeCard[] = [
  { id: 'expense', label: 'Expense', sub: 'Something you spent', Icon: IndianRupee, color: 'var(--sb-danger)', available: true },
  { id: 'income', label: 'Income', sub: 'Something you earned', Icon: TrendingUp, color: 'var(--sb-success)', available: true },
  { id: 'generic-note', label: 'Note', sub: 'Thought, event, observation', Icon: StickyNote, color: 'var(--sb-accent)', available: true },
  { id: 'health-log', label: 'Health', sub: 'Workout, mood, weight', Icon: Heart, color: 'var(--sb-success)', available: true },
];

// ── Shared recurrence UI ──────────────────────────────────────────────────────

const RECUR_FREQ_OPTIONS = [
  { value: 'daily',     label: 'Daily' },
  { value: 'weekdays',  label: 'Weekdays' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly',    label: 'Yearly' },
] as const;

type RecurFreq = typeof RECUR_FREQ_OPTIONS[number]['value'];

const WEEKDAY_CODES = [
  { code: 'MON', label: 'Mon' }, { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' }, { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' }, { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
] as const;

interface RecurrenceFieldsProps {
  freq: RecurFreq;
  setFreq: (f: RecurFreq) => void;
  dayCode: string;     // for weekly
  setDayCode: (d: string) => void;
  dueDay: number;      // for monthly/quarterly/yearly
  setDueDay: (n: number) => void;
  /** subset of freq options to show (default: all) */
  freqOptions?: readonly typeof RECUR_FREQ_OPTIONS[number][];
}

function RecurrenceFields({ freq, setFreq, dayCode, setDayCode, dueDay, setDueDay, freqOptions = RECUR_FREQ_OPTIONS }: RecurrenceFieldsProps) {
  return (
    <>
      <div className="sb-compose-field">
        <label className="sb-compose-label">Repeat</label>
        <div className="sb-compose-chips">
          {freqOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`sb-compose-chip${freq === opt.value ? ' sb-compose-chip--active' : ''}`}
              onClick={() => setFreq(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {freq === 'weekly' && (
        <div className="sb-compose-field">
          <label className="sb-compose-label">Day</label>
          <div className="sb-compose-chips">
            {WEEKDAY_CODES.map((d) => (
              <button
                key={d.code}
                type="button"
                className={`sb-compose-chip${dayCode === d.code ? ' sb-compose-chip--active' : ''}`}
                onClick={() => setDayCode(d.code)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(freq === 'monthly' || freq === 'quarterly' || freq === 'yearly') && (
        <div className="sb-compose-field">
          <label className="sb-compose-label">
            {freq === 'monthly' ? 'Day of month' : freq === 'quarterly' ? 'Day of month (Jan/Apr/Jul/Oct)' : 'Day of year (in January)'}
          </label>
          <input
            type="number"
            className="sb-compose-input"
            min={1}
            max={28}
            value={dueDay}
            onChange={(e) => setDueDay(Math.min(28, Math.max(1, Number(e.target.value))))}
          />
        </div>
      )}
    </>
  );
}

/** Build a recurrence string from freq + day fields */
function buildRecurrence(freq: RecurFreq, dayCode: string, dueDay: number): string {
  if (freq === 'weekly') return `weekly:${dayCode}`;
  if (freq === 'monthly') return `monthly:${dueDay}`;
  if (freq === 'quarterly') return `quarterly:${dueDay}`;
  if (freq === 'yearly') return `yearly:${dueDay}`;
  return freq; // daily | weekdays
}

// ── Generic Task Form ─────────────────────────────────────────────────────────

interface GenericTaskFormProps {
  initialTitle?: string;
  initialNotes?: string;
  initialDueAt?: Timestamp;
  onSave: (data: { title: string; notes?: string; dueAt?: Timestamp; recurring: false }) => Promise<void>;
  onSaveRecurring: (data: { title: string; recurrence: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function GenericTaskForm({ initialTitle = '', initialNotes = '', initialDueAt, onSave, onSaveRecurring, onCancel, isEdit }: GenericTaskFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [dateStr, setDateStr] = useState(initialDueAt ? tsToDateStr(initialDueAt) : '');
  const [timeStr, setTimeStr] = useState(initialDueAt ? tsToTimeStr(initialDueAt) : '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFreq, setRecurFreq] = useState<RecurFreq>('daily');
  const [recurDayCode, setRecurDayCode] = useState('MON');
  const [recurDueDay, setRecurDueDay] = useState(1);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isRecurring) {
        await onSaveRecurring({ title: title.trim(), recurrence: buildRecurrence(recurFreq, recurDayCode, recurDueDay) });
      } else {
        const dueAt = dateStr ? buildTimestamp(dateStr, timeStr || undefined) : undefined;
        await onSave({ title: title.trim(), notes: notes.trim() || undefined, dueAt, recurring: false });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={200}
        />
      </div>

      {/* Recurring toggle */}
      <div className="sb-compose-field">
        <label className="sb-compose-recurring-row">
          <span className="sb-compose-label" style={{ margin: 0 }}>Recurring</span>
          <button
            type="button"
            className={`sb-settings-toggle${isRecurring ? ' sb-settings-toggle--on' : ''}`}
            onClick={() => setIsRecurring((v) => !v)}
            aria-label="Toggle recurring"
          >
            <span className="sb-settings-toggle__knob" />
          </button>
        </label>
      </div>

      {isRecurring ? (
        <RecurrenceFields
          freq={recurFreq} setFreq={setRecurFreq}
          dayCode={recurDayCode} setDayCode={setRecurDayCode}
          dueDay={recurDueDay} setDueDay={setRecurDueDay}
        />
      ) : (
        <>
          <div className="sb-compose-field">
            <label className="sb-compose-label">Due date</label>
            <div className="sb-compose-date-row">
              <input
                type="date"
                className="sb-compose-input"
                value={dateStr}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDateStr(e.target.value)}
              />
              {dateStr && (
                <input
                  type="time"
                  className="sb-compose-input"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  placeholder="Time (optional)"
                />
              )}
            </div>
            {dateStr && (
              <button
                type="button"
                className="sb-compose-clear-btn"
                onClick={() => { setDateStr(''); setTimeStr(''); }}
              >
                Clear date
              </button>
            )}
          </div>

          <div className="sb-compose-field">
            <label className="sb-compose-label">Notes</label>
            <textarea
              className="sb-compose-textarea"
              placeholder="Add a note…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </>
      )}

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!title.trim() || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Add task'}
        </button>
      </div>
    </form>
  );
}

// ── Shopping Item Form ────────────────────────────────────────────────────────

interface ShoppingItemFormProps {
  initialTitle?: string;
  initialQuantity?: number;
  initialPrice?: number;
  initialCategoryTag?: string;
  onSave: (data: { title: string; quantity?: number; price?: number; categoryTag?: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function ShoppingItemForm({
  initialTitle = '',
  initialQuantity,
  initialPrice,
  initialCategoryTag = '',
  onSave,
  onCancel,
  isEdit,
}: ShoppingItemFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [quantity, setQuantity] = useState(initialQuantity !== undefined ? String(initialQuantity) : '');
  const [price, setPrice] = useState(initialPrice !== undefined ? String(initialPrice) : '');
  const [categoryTag, setCategoryTag] = useState(initialCategoryTag);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        price: price ? Number(price) : undefined,
        categoryTag: categoryTag.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="Item name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={200}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Quantity &amp; Price</label>
        <div className="sb-compose-row">
          <input
            type="number"
            className="sb-compose-input sb-compose-input--sm"
            placeholder="Qty"
            value={quantity}
            min={1}
            step={1}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input
            type="number"
            className="sb-compose-input sb-compose-input--sm"
            placeholder="₹ Price"
            value={price}
            min={0}
            step={0.01}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Category</label>
        <input
          type="text"
          className="sb-compose-input"
          placeholder="e.g. Produce, Dairy…"
          value={categoryTag}
          onChange={(e) => setCategoryTag(e.target.value)}
          maxLength={50}
        />
      </div>

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!title.trim() || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Add item'}
        </button>
      </div>
    </form>
  );
}

// ── Shared constants ─────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Bills', 'Health', 'Shopping', 'Entertainment', 'Other'];

// ── Money Reminder Form ───────────────────────────────────────────────────────

interface MoneyReminderFormProps {
  initialTitle?: string;
  initialAmount?: number;
  initialCategory?: string;
  initialDueAt?: Timestamp;
  onSave: (data: { title: string; amount?: number; category?: string; dueAt?: Timestamp }) => Promise<void>;
  onSaveRecurring: (data: { title: string; amount?: number; category?: string; recurrence: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function MoneyReminderForm({
  initialTitle = '',
  initialAmount,
  initialCategory = '',
  initialDueAt,
  onSave,
  onSaveRecurring,
  onCancel,
  isEdit,
}: MoneyReminderFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : '');
  const [category, setCategory] = useState(initialCategory);
  const [dateStr, setDateStr] = useState(initialDueAt ? tsToDateStr(initialDueAt) : '');
  const [timeStr, setTimeStr] = useState(initialDueAt ? tsToTimeStr(initialDueAt) : '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFreq, setRecurFreq] = useState<RecurFreq>('monthly');
  const [recurDayCode, setRecurDayCode] = useState('MON');
  const [recurDueDay, setRecurDueDay] = useState(1);
  const [saving, setSaving] = useState(false);

  // Payments rarely need daily/weekdays — offer weekly, monthly, quarterly, yearly
  const MONEY_FREQ_OPTIONS = RECUR_FREQ_OPTIONS.filter(
    (o) => o.value !== 'daily' && o.value !== 'weekdays',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isRecurring) {
        await onSaveRecurring({
          title: title.trim(),
          amount: amount ? Number(amount) : undefined,
          category: category.trim() || undefined,
          recurrence: buildRecurrence(recurFreq, recurDayCode, recurDueDay),
        });
      } else {
        const dueAt = dateStr ? buildTimestamp(dateStr, timeStr || undefined) : undefined;
        await onSave({ title: title.trim(), amount: amount ? Number(amount) : undefined, category: category.trim() || undefined, dueAt });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="e.g. Netflix, Rent, Cook…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={200}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Amount (optional)</label>
        <input
          type="number"
          className="sb-compose-input"
          placeholder="₹ Amount"
          value={amount}
          min={0}
          step={0.01}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Category</label>
        <div className="sb-compose-chips">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sb-compose-chip${category === cat ? ' sb-compose-chip--active' : ''}`}
              onClick={() => setCategory(category === cat ? '' : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Recurring toggle */}
      <div className="sb-compose-field">
        <label className="sb-compose-recurring-row">
          <span className="sb-compose-label" style={{ margin: 0 }}>Recurring</span>
          <button
            type="button"
            className={`sb-settings-toggle${isRecurring ? ' sb-settings-toggle--on' : ''}`}
            onClick={() => setIsRecurring((v) => !v)}
            aria-label="Toggle recurring"
          >
            <span className="sb-settings-toggle__knob" />
          </button>
        </label>
      </div>

      {isRecurring ? (
        <RecurrenceFields
          freq={recurFreq} setFreq={setRecurFreq}
          dayCode={recurDayCode} setDayCode={setRecurDayCode}
          dueDay={recurDueDay} setDueDay={setRecurDueDay}
          freqOptions={MONEY_FREQ_OPTIONS}
        />
      ) : (
        <div className="sb-compose-field">
          <label className="sb-compose-label">Due date</label>
          <div className="sb-compose-date-row">
            <input
              type="date"
              className="sb-compose-input"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
            {dateStr && (
              <input
                type="time"
                className="sb-compose-input"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                placeholder="Time (optional)"
              />
            )}
          </div>
          {dateStr && (
            <button
              type="button"
              className="sb-compose-clear-btn"
              onClick={() => { setDateStr(''); setTimeStr(''); }}
            >
              Clear date
            </button>
          )}
        </div>
      )}

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!title.trim() || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Add reminder'}
        </button>
      </div>
    </form>
  );
}

// ── Expense Form ──────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  initialSpentOn?: string;
  initialAmount?: number;
  initialCategory?: string;
  initialDate?: string;
  onSave: (data: { spentOn: string; amount: number; category?: string; date: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function ExpenseForm({
  initialSpentOn = '',
  initialAmount,
  initialCategory = '',
  initialDate,
  onSave,
  onCancel,
  isEdit,
}: ExpenseFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [spentOn, setSpentOn] = useState(initialSpentOn);
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : '');
  const [category, setCategory] = useState(initialCategory);
  const [date, setDate] = useState(initialDate ?? todayStr);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spentOn.trim() || !amount) return;
    setSaving(true);
    try {
      await onSave({
        spentOn: spentOn.trim(),
        amount: Number(amount),
        category: category || undefined,
        date,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="What did you spend on?"
          value={spentOn}
          onChange={(e) => setSpentOn(e.target.value)}
          autoFocus
          maxLength={200}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Amount</label>
        <input
          type="number"
          className="sb-compose-input"
          placeholder="₹ Amount"
          value={amount}
          min={0}
          step={0.01}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Category</label>
        <div className="sb-compose-chips">
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sb-compose-chip${category === cat ? ' sb-compose-chip--active' : ''}`}
              onClick={() => setCategory(category === cat ? '' : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Date</label>
        <input
          type="date"
          className="sb-compose-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!spentOn.trim() || !amount || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Log expense'}
        </button>
      </div>
    </form>
  );
}

// ── Income Form ───────────────────────────────────────────────────────────────

interface IncomeFormProps {
  initialSource?: string;
  initialAmount?: number;
  initialDate?: string;
  onSave: (data: { source: string; amount: number; date: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function IncomeForm({
  initialSource = '',
  initialAmount,
  initialDate,
  onSave,
  onCancel,
  isEdit,
}: IncomeFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [source, setSource] = useState(initialSource);
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : '');
  const [date, setDate] = useState(initialDate ?? todayStr);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim() || !amount) return;
    setSaving(true);
    try {
      await onSave({ source: source.trim(), amount: Number(amount), date });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="Source (e.g. Salary, Freelance…)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          autoFocus
          maxLength={200}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Amount</label>
        <input
          type="number"
          className="sb-compose-input"
          placeholder="₹ Amount"
          value={amount}
          min={0}
          step={0.01}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Date</label>
        <input
          type="date"
          className="sb-compose-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!source.trim() || !amount || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Log income'}
        </button>
      </div>
    </form>
  );
}

// ── Health Log Form ───────────────────────────────────────────────────────────

const WORKOUT_TYPES = ['Run', 'Walk', 'Gym', 'Yoga', 'Swim', 'Cycle', 'Other'];
const MOOD_COLORS = ['', '#ff8a8a', '#ffb86c', '#fcd34d', '#a3d977', '#6ee7a8'];

interface HealthLogFormProps {
  initialWorkoutType?: string;
  initialTitle?: string;
  initialMood?: number;
  initialWeightKg?: number;
  initialNotes?: string;
  initialDate?: string;
  onSave: (data: { title: string; workoutType?: string; mood?: number; weightKg?: number; notes?: string; date: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function HealthLogForm({
  initialWorkoutType = '',
  initialTitle = '',
  initialMood,
  initialWeightKg,
  initialNotes = '',
  initialDate,
  onSave,
  onCancel,
  isEdit,
}: HealthLogFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [workoutType, setWorkoutType] = useState(initialWorkoutType);
  const [title, setTitle] = useState(initialTitle);
  const [mood, setMood] = useState<number | undefined>(initialMood);
  const [weightKg, setWeightKg] = useState(initialWeightKg !== undefined ? String(initialWeightKg) : '');
  const [notes, setNotes] = useState(initialNotes);
  const [date, setDate] = useState(initialDate ?? todayStr);
  const [saving, setSaving] = useState(false);

  const handleWorkoutSelect = (type: string) => {
    const next = workoutType === type ? '' : type;
    setWorkoutType(next);
    if (!title || WORKOUT_TYPES.includes(title)) {
      setTitle(next);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        workoutType: workoutType || undefined,
        mood,
        weightKg: weightKg ? Number(weightKg) : undefined,
        notes: notes.trim() || undefined,
        date,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <label className="sb-compose-label">Activity</label>
        <div className="sb-compose-chips">
          {WORKOUT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`sb-compose-chip${workoutType === type ? ' sb-compose-chip--active' : ''}`}
              onClick={() => handleWorkoutSelect(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="Describe it (e.g. Morning run)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!workoutType}
          maxLength={200}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Mood</label>
        <div className="sb-compose-mood-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`sb-compose-mood-btn${mood === n ? ' sb-compose-mood-btn--active' : ''}`}
              style={mood === n ? { background: MOOD_COLORS[n], borderColor: MOOD_COLORS[n], color: '#0a0b10' } : {}}
              onClick={() => setMood(mood === n ? undefined : n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Weight (kg, optional)</label>
        <input
          type="number"
          className="sb-compose-input"
          placeholder="e.g. 72.5"
          value={weightKg}
          min={0}
          step={0.1}
          onChange={(e) => setWeightKg(e.target.value)}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Date</label>
        <input
          type="date"
          className="sb-compose-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Notes</label>
        <textarea
          className="sb-compose-textarea"
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!title.trim() || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Log health'}
        </button>
      </div>
    </form>
  );
}

// ── Generic Note Form ─────────────────────────────────────────────────────────

const NOTE_CATEGORIES = ['Idea', 'Work', 'Personal', 'Meeting', 'Other'];

interface GenericNoteFormProps {
  initialTitle?: string;
  initialNoteCategory?: string;
  initialDate?: string;
  onSave: (data: { title: string; noteCategory: string; date: string }) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
}

function GenericNoteForm({
  initialTitle = '',
  initialNoteCategory = '',
  initialDate,
  onSave,
  onCancel,
  isEdit,
}: GenericNoteFormProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(initialTitle);
  const [noteCategory, setNoteCategory] = useState(initialNoteCategory || 'Other');
  const [date, setDate] = useState(initialDate ?? todayStr);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), noteCategory, date });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sb-compose-form" onSubmit={handleSubmit}>
      <div className="sb-compose-field">
        <input
          type="text"
          className="sb-compose-title-input"
          placeholder="What's on your mind?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={300}
        />
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Category</label>
        <div className="sb-compose-chips">
          {NOTE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sb-compose-chip${noteCategory === cat ? ' sb-compose-chip--active' : ''}`}
              onClick={() => setNoteCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="sb-compose-field">
        <label className="sb-compose-label">Date</label>
        <input
          type="date"
          className="sb-compose-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="sb-compose-actions">
        <button type="button" className="sb-compose-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="sb-compose-save-btn"
          disabled={!title.trim() || saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Add note'}
        </button>
      </div>
    </form>
  );
}

// ── Coming Soon placeholder ───────────────────────────────────────────────────

function ComingSoon({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="sb-compose-coming-soon">
      <p className="sb-compose-coming-soon__text">{label} is coming in a future phase.</p>
      <button type="button" className="sb-compose-cancel-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

// ── Main ComposeSheet ─────────────────────────────────────────────────────────

export default function ComposeSheet({
  onClose,
  mode: initialMode,
  editEntry,
  preselectedTodoType,
  preselectedLogType,
  preselectedGroupId,
}: ComposeSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const addTodo = useTodosStore((s) => s.addTodo);
  const updateTodo = useTodosStore((s) => s.updateTodo);
  const addLog = useLogsStore((s) => s.addLog);
  const updateLog = useLogsStore((s) => s.updateLog);

  // Determine if editing
  const isEdit = !!editEntry;
  const editTodoType = editEntry && 'todoType' in editEntry ? editEntry.todoType : undefined;
  const editLogType = editEntry && 'logType' in editEntry ? editEntry.logType : undefined;

  const [mode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>(
    isEdit || preselectedTodoType || preselectedLogType ? 'form' : 'type-picker',
  );
  const [selectedTodoType, setSelectedTodoType] = useState<TodoType | undefined>(
    editTodoType ?? preselectedTodoType,
  );
  const [selectedLogType, setSelectedLogType] = useState<LogType | undefined>(
    editLogType ?? preselectedLogType,
  );

  const handleTodoTypeSelect = useCallback((typeId: string) => {
    setSelectedTodoType(typeId as TodoType);
    setStep('form');
  }, []);

  const handleLogTypeSelect = useCallback((typeId: string) => {
    setSelectedLogType(typeId as LogType);
    setStep('form');
  }, []);

  const handleSaveShoppingItem = async (data: {
    title: string;
    quantity?: number;
    price?: number;
    categoryTag?: string;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    try {
      if (isEdit && editEntry?.id) {
        await updateTodo(uid, editEntry.id, {
          title: data.title,
          quantity: data.quantity,
          price: data.price,
          categoryTag: data.categoryTag,
        } as Partial<ShoppingItemTodo>);
        showToast('Updated', 'success');
      } else {
        await addTodo(uid, {
          todoType: 'shopping-item',
          title: data.title,
          quantity: data.quantity,
          price: data.price,
          categoryTag: data.categoryTag,
          groupId: preselectedGroupId,
          status: 'pending',
          sortOrder: Date.now(),
        } as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>);
        if (preselectedGroupId) {
          recomputeGroupCounts(uid, preselectedGroupId).catch(console.error);
        }
        showToast('Item added', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const handleSaveGenericTask = async (data: { title: string; notes?: string; dueAt?: Timestamp; recurring: false }) => {
    // Use confirmed user uid, or fall back to optimistic cached uid (Firebase SDK
    // already holds a valid token from the previous session even before onAuthStateChanged fires).
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    try {
      if (isEdit && editEntry?.id) {
        await updateTodo(uid, editEntry.id, {
          title: data.title,
          notes: data.notes,
          dueAt: data.dueAt,
        });
        showToast('Updated', 'success');
      } else {
        await addTodo(uid, {
          todoType: 'generic-task',
          title: data.title,
          notes: data.notes,
          dueAt: data.dueAt,
          status: 'pending',
          sortOrder: Date.now(),
        } as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>);
        showToast('Task added', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const addGroup = useGroupsStore((s) => s.addGroup);

  /** Saves a one-time money-reminder todo */
  const handleSaveMoneyReminder = async (data: {
    title: string;
    amount?: number;
    category?: string;
    dueAt?: Timestamp;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    try {
      if (isEdit && editEntry?.id) {
        await updateTodo(uid, editEntry.id, {
          title: data.title,
          amount: data.amount,
          category: data.category,
          dueAt: data.dueAt,
        } as Partial<MoneyReminderTodo>);
        showToast('Updated', 'success');
      } else {
        await addTodo(uid, {
          todoType: 'money-reminder',
          title: data.title,
          amount: data.amount,
          category: data.category,
          dueAt: data.dueAt,
          status: 'pending',
          sortOrder: Date.now(),
        } as Omit<MoneyReminderTodo, 'id' | 'createdAt' | 'updatedAt'>);
        showToast('Reminder added', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  /** Saves a recurring money-reminder as a RecurringTodoGroup, then spawns today's instance if due */
  const handleSaveRecurringMoney = async (data: {
    title: string;
    amount?: number;
    category?: string;
    recurrence: string;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    try {
      await addGroup(uid, {
        groupKind: 'recurring-todo',
        recurTodoType: 'money-reminder',
        name: data.title,
        recurrence: data.recurrence,
        amount: data.amount,
        category: data.category,
        streakCount: 0,
        ancestorPath: [],
        showProgress: false,
        showSumMoney: false,
        childCount: 0,
        doneCount: 0,
        completed: false,
      } as Parameters<typeof addGroup>[1]);
      // Spawn immediately if due today
      spawnDueRecurringTodos(uid).catch(console.error);
      showToast('Recurring reminder saved', 'success');
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  /** Saves a recurring generic task as a RecurringTodoGroup */
  const handleSaveRecurringTask = async (data: { title: string; recurrence: string }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    try {
      await addGroup(uid, {
        groupKind: 'recurring-todo',
        recurTodoType: 'generic-task',
        name: data.title,
        recurrence: data.recurrence,
        streakCount: 0,
        ancestorPath: [],
        showProgress: false,
        showSumMoney: false,
        childCount: 0,
        doneCount: 0,
        completed: false,
      } as Parameters<typeof addGroup>[1]);
      spawnDueRecurringTodos(uid).catch(console.error);
      showToast('Recurring task saved', 'success');
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const handleSaveExpense = async (data: {
    spentOn: string;
    amount: number;
    category?: string;
    date: string;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    const { Timestamp: FBTimestamp } = await import('firebase/firestore');
    const occurredAt = FBTimestamp.fromDate(new Date(data.date + 'T12:00:00'));
    try {
      if (isEdit && editEntry?.id) {
        await updateLog(uid, editEntry.id, {
          title: data.spentOn,
          spentOn: data.spentOn,
          amount: data.amount,
          category: data.category,
          occurredAt,
        } as Partial<ExpenseLog>);
        showToast('Updated', 'success');
      } else {
        await addLog(uid, {
          logType: 'expense',
          title: data.spentOn,
          spentOn: data.spentOn,
          amount: data.amount,
          category: data.category,
          occurredAt,
          sortOrder: Date.now(),
        } as Omit<ExpenseLog, 'id' | 'createdAt' | 'updatedAt'>);
        showToast('Expense logged', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const handleSaveIncome = async (data: {
    source: string;
    amount: number;
    date: string;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    const { Timestamp: FBTimestamp } = await import('firebase/firestore');
    const occurredAt = FBTimestamp.fromDate(new Date(data.date + 'T12:00:00'));
    try {
      if (isEdit && editEntry?.id) {
        await updateLog(uid, editEntry.id, {
          title: data.source,
          source: data.source,
          amount: data.amount,
          occurredAt,
        } as Partial<IncomeLog>);
        showToast('Updated', 'success');
      } else {
        await addLog(uid, {
          logType: 'income',
          title: data.source,
          source: data.source,
          amount: data.amount,
          occurredAt,
          sortOrder: Date.now(),
        } as Omit<IncomeLog, 'id' | 'createdAt' | 'updatedAt'>);
        showToast('Income logged', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const handleSaveHealthLog = async (data: {
    title: string;
    workoutType?: string;
    mood?: number;
    weightKg?: number;
    notes?: string;
    date: string;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    const { Timestamp: FBTimestamp } = await import('firebase/firestore');
    const occurredAt = FBTimestamp.fromDate(new Date(data.date + 'T12:00:00'));
    try {
      if (isEdit && editEntry?.id) {
        await updateLog(uid, editEntry.id, {
          title: data.title,
          workoutType: data.workoutType,
          mood: data.mood,
          weightKg: data.weightKg,
          notes: data.notes,
          occurredAt,
        } as Partial<HealthLog>);
        showToast('Updated', 'success');
      } else {
        await addLog(uid, {
          logType: 'health-log',
          title: data.title,
          workoutType: data.workoutType,
          mood: data.mood,
          weightKg: data.weightKg,
          notes: data.notes,
          occurredAt,
          sortOrder: Date.now(),
        } as Omit<HealthLog, 'id' | 'createdAt' | 'updatedAt'>);
        showToast('Health logged', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const handleSaveGenericNote = async (data: {
    title: string;
    noteCategory: string;
    date: string;
  }) => {
    const uid = user?.uid ?? getCachedUid();
    if (!uid) { showToast('Not signed in. Please refresh.', 'error'); return; }
    const { Timestamp: FBTimestamp } = await import('firebase/firestore');
    const occurredAt = FBTimestamp.fromDate(new Date(data.date + 'T12:00:00'));
    try {
      if (isEdit && editEntry?.id) {
        await updateLog(uid, editEntry.id, {
          title: data.title,
          noteCategory: data.noteCategory,
          occurredAt,
        } as Partial<GenericNoteLog>);
        showToast('Updated', 'success');
      } else {
        await addLog(uid, {
          logType: 'generic-note',
          title: data.title,
          noteCategory: data.noteCategory,
          occurredAt,
          sortOrder: Date.now(),
        } as Omit<GenericNoteLog, 'id' | 'createdAt' | 'updatedAt'>);
        showToast('Note added', 'success');
      }
      onClose();
    } catch {
      showToast('Could not save. Try again.', 'error');
    }
  };

  const typeCards = mode === 'todo' ? TODO_TYPES : LOG_TYPES;
  const selectedType = mode === 'todo' ? selectedTodoType : selectedLogType;
  const typeLabel =
    [...TODO_TYPES, ...LOG_TYPES].find((c) => c.id === selectedType)?.label ?? selectedType ?? '';
  const sheetTitle =
    step === 'type-picker'
      ? mode === 'todo' ? 'New TODO' : 'New Log'
      : isEdit ? `Edit ${typeLabel}` : typeLabel;

  return (
    <BottomSheet onClose={onClose} title={sheetTitle}>
      {step === 'type-picker' ? (
        <div className="sb-type-picker">
          {typeCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`sb-type-card${!card.available ? ' sb-type-card--unavailable' : ''}`}
              onClick={() =>
                card.available
                  ? mode === 'todo' ? handleTodoTypeSelect(card.id) : handleLogTypeSelect(card.id)
                  : undefined
              }
              disabled={!card.available}
            >
              <span className="sb-type-card__icon" style={{ color: card.color }}>
                <card.Icon size={22} strokeWidth={1.8} />
              </span>
              <span className="sb-type-card__body">
                <span className="sb-type-card__label">{card.label}</span>
                <span className="sb-type-card__sub">
                  {card.available ? card.sub : 'Coming soon'}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Back button when not editing */}
          {!isEdit && (
            <button
              type="button"
              className="sb-compose-back-btn"
              onClick={() => setStep('type-picker')}
            >
              <ChevronLeft size={16} strokeWidth={2} />
              Back
            </button>
          )}

          {/* Render form for selected type */}
          {mode === 'todo' && selectedTodoType === 'generic-task' && (
            <GenericTaskForm
              initialTitle={editEntry && 'todoType' in editEntry ? editEntry.title : ''}
              initialNotes={editEntry?.notes}
              initialDueAt={editEntry && 'todoType' in editEntry ? editEntry.dueAt : undefined}
              onSave={handleSaveGenericTask}
              onSaveRecurring={handleSaveRecurringTask}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'todo' && selectedTodoType === 'shopping-item' && (
            <ShoppingItemForm
              initialTitle={editEntry && 'todoType' in editEntry ? editEntry.title : ''}
              initialQuantity={editEntry && 'todoType' in editEntry && editEntry.todoType === 'shopping-item' ? (editEntry as ShoppingItemTodo).quantity : undefined}
              initialPrice={editEntry && 'todoType' in editEntry && editEntry.todoType === 'shopping-item' ? (editEntry as ShoppingItemTodo).price : undefined}
              initialCategoryTag={editEntry && 'todoType' in editEntry && editEntry.todoType === 'shopping-item' ? (editEntry as ShoppingItemTodo).categoryTag : undefined}
              onSave={handleSaveShoppingItem}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'todo' && selectedTodoType === 'money-reminder' && (
            <MoneyReminderForm
              initialTitle={editEntry && 'todoType' in editEntry ? editEntry.title : ''}
              initialAmount={editEntry && 'todoType' in editEntry && editEntry.todoType === 'money-reminder' ? (editEntry as MoneyReminderTodo).amount : undefined}
              initialCategory={editEntry && 'todoType' in editEntry && editEntry.todoType === 'money-reminder' ? (editEntry as MoneyReminderTodo).category : undefined}
              initialDueAt={editEntry && 'todoType' in editEntry ? editEntry.dueAt : undefined}
              onSave={handleSaveMoneyReminder}
              onSaveRecurring={handleSaveRecurringMoney}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'todo' && selectedTodoType && selectedTodoType !== 'generic-task' && selectedTodoType !== 'shopping-item' && selectedTodoType !== 'money-reminder' && (
            <ComingSoon label={selectedTodoType} onBack={() => setStep('type-picker')} />
          )}

          {mode === 'log' && selectedLogType === 'expense' && (
            <ExpenseForm
              initialSpentOn={editEntry && 'logType' in editEntry && editEntry.logType === 'expense' ? (editEntry as ExpenseLog).spentOn : ''}
              initialAmount={editEntry && 'logType' in editEntry && editEntry.logType === 'expense' ? (editEntry as ExpenseLog).amount : undefined}
              initialCategory={editEntry && 'logType' in editEntry && editEntry.logType === 'expense' ? (editEntry as ExpenseLog).category : undefined}
              initialDate={editEntry && 'logType' in editEntry ? editEntry.occurredAt.toDate().toISOString().slice(0, 10) : undefined}
              onSave={handleSaveExpense}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'log' && selectedLogType === 'income' && (
            <IncomeForm
              initialSource={editEntry && 'logType' in editEntry && editEntry.logType === 'income' ? (editEntry as IncomeLog).source : ''}
              initialAmount={editEntry && 'logType' in editEntry && editEntry.logType === 'income' ? (editEntry as IncomeLog).amount : undefined}
              initialDate={editEntry && 'logType' in editEntry ? editEntry.occurredAt.toDate().toISOString().slice(0, 10) : undefined}
              onSave={handleSaveIncome}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'log' && selectedLogType === 'health-log' && (
            <HealthLogForm
              initialWorkoutType={editEntry && 'logType' in editEntry && editEntry.logType === 'health-log' ? (editEntry as HealthLog).workoutType : undefined}
              initialTitle={editEntry && 'logType' in editEntry ? editEntry.title : ''}
              initialMood={editEntry && 'logType' in editEntry && editEntry.logType === 'health-log' ? (editEntry as HealthLog).mood : undefined}
              initialWeightKg={editEntry && 'logType' in editEntry && editEntry.logType === 'health-log' ? (editEntry as HealthLog).weightKg : undefined}
              initialNotes={editEntry?.notes}
              initialDate={editEntry && 'logType' in editEntry ? editEntry.occurredAt.toDate().toISOString().slice(0, 10) : undefined}
              onSave={handleSaveHealthLog}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'log' && selectedLogType === 'generic-note' && (
            <GenericNoteForm
              initialTitle={editEntry && 'logType' in editEntry ? editEntry.title : ''}
              initialNoteCategory={editEntry && 'logType' in editEntry && editEntry.logType === 'generic-note' ? (editEntry as GenericNoteLog).noteCategory : undefined}
              initialDate={editEntry && 'logType' in editEntry ? editEntry.occurredAt.toDate().toISOString().slice(0, 10) : undefined}
              onSave={handleSaveGenericNote}
              onCancel={onClose}
              isEdit={isEdit}
            />
          )}

          {mode === 'log' && selectedLogType && selectedLogType !== 'expense' && selectedLogType !== 'income' && selectedLogType !== 'health-log' && selectedLogType !== 'generic-note' && (
            <ComingSoon label={selectedLogType} onBack={() => setStep('type-picker')} />
          )}
        </>
      )}
    </BottomSheet>
  );
}
