import { useState, useEffect, useRef } from 'react';
import type { ActivityType, Activity, FinanceActivity, ExerciseActivity, GenericReminder } from '../types';
import { ACTIVITY_TYPE_META } from '../constants';
import { MoneyIcon, HealthIcon, ShoppingIcon, ReminderIcon } from './icons';
import FinanceForm from '../forms/FinanceForm';
import ExerciseForm from '../forms/ExerciseForm';
import GroceryForm from '../forms/GroceryForm';
import PaymentTemplateForm from '../forms/PaymentTemplateForm';
import GenericReminderForm from '../forms/GenericReminderForm';
import './add-entry-drawer.css';

interface AddEntryDrawerProps {
  onClose: () => void;
  activityToEdit?: Activity;
  reminderToEdit?: GenericReminder;
  initialType?: ActivityType;
  initialDate?: string;
}

type MoneyMode = 'finance' | 'payment';

const PICKER_TYPES: { type: ActivityType; label: string; icon: React.ReactNode }[] = [
  { type: 'finance',  label: 'Money',    icon: <MoneyIcon /> },
  { type: 'exercise', label: 'Health',   icon: <HealthIcon /> },
  { type: 'grocery',  label: 'Shop',     icon: <ShoppingIcon /> },
  { type: 'generic',  label: 'Reminder',  icon: <ReminderIcon /> },
];

export default function AddEntryDrawer({ onClose, activityToEdit, reminderToEdit, initialType, initialDate }: AddEntryDrawerProps) {
  const isEditing = !!activityToEdit || !!reminderToEdit;
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = 'drawer-title';

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const [selectedType, setSelectedType] = useState<ActivityType | null>(
    reminderToEdit
      ? 'generic'
      : activityToEdit
        ? (activityToEdit.type === 'payment' ? 'finance' : activityToEdit.type)
        : (initialType ?? null),
  );
  const [moneyMode, setMoneyMode] = useState<MoneyMode>(
    activityToEdit?.type === 'payment' ? 'payment' : 'finance',
  );

  const handleSaved = () => {
    setSelectedType(null);
    onClose();
  };

  const handleBack = () => {
    if (isEditing || initialType) {
      onClose();
    } else {
      setSelectedType(null);
    }
  };

  const getTitle = () => {
    if (!selectedType) return 'Add Entry';
    if (selectedType === 'finance') {
      const modeLabel = moneyMode === 'payment' ? 'Recurring Bill' : 'Expense / Income';
      return isEditing ? `Edit ${modeLabel}` : modeLabel;
    }
    const meta = ACTIVITY_TYPE_META[selectedType];
    return isEditing ? `Edit ${meta.label}` : meta.label;
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="drawer-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-handle" />
        <div className="drawer-body">
          {!selectedType ? (
            <>
              <h3 id={titleId} className="drawer-title">Add Entry</h3>
              <div className="type-picker-grid">
                {PICKER_TYPES.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    className="type-picker-btn"
                    onClick={() => setSelectedType(type)}
                  >
                    <span className="type-picker-icon">{icon}</span>
                    <span className="type-picker-label">{label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="drawer-form-header">
                <button className="drawer-back-btn" onClick={handleBack}>&larr;</button>
                <h3 id={titleId} className="drawer-title">{getTitle()}</h3>
              </div>

              {selectedType === 'finance' && !isEditing && (
                <div className="money-mode-toggle">
                  <button
                    className={`money-mode-btn ${moneyMode === 'finance' ? 'active' : ''}`}
                    onClick={() => setMoneyMode('finance')}
                  >
                    Expense / Income
                  </button>
                  <button
                    className={`money-mode-btn ${moneyMode === 'payment' ? 'active' : ''}`}
                    onClick={() => setMoneyMode('payment')}
                  >
                    Recurring Bill
                  </button>
                </div>
              )}

              {selectedType === 'finance' && moneyMode === 'finance' && (
                <FinanceForm
                  key={activityToEdit?.id ?? 'new'}
                  onSaved={handleSaved}
                  initialValues={activityToEdit as FinanceActivity | undefined}
                  entryId={activityToEdit?.id}
                  initialDate={initialDate}
                />
              )}
              {selectedType === 'finance' && moneyMode === 'payment' && (
                <PaymentTemplateForm onSaved={handleSaved} />
              )}
              {selectedType === 'exercise' && (
                <ExerciseForm
                  key={activityToEdit?.id ?? 'new'}
                  onSaved={handleSaved}
                  initialValues={activityToEdit as ExerciseActivity | undefined}
                  entryId={activityToEdit?.id}
                  initialDate={initialDate}
                />
              )}
              {selectedType === 'grocery' && <GroceryForm onSaved={handleSaved} />}
              {selectedType === 'generic' && (
                <GenericReminderForm
                  key={reminderToEdit?.id ?? 'new'}
                  onSaved={handleSaved}
                  initialDate={initialDate}
                  initialReminder={reminderToEdit}
                  entryId={reminderToEdit?.id}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
