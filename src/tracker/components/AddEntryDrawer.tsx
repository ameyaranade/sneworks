import { useState } from 'react';
import type { ActivityType, Activity, FinanceActivity, ExerciseActivity } from '../types';
import { ACTIVITY_TYPE_META } from '../constants';
import FinanceForm from '../forms/FinanceForm';
import ExerciseForm from '../forms/ExerciseForm';
import GroceryForm from '../forms/GroceryForm';
import PaymentTemplateForm from '../forms/PaymentTemplateForm';
import GenericActivityForm from '../forms/GenericActivityForm';
import './add-entry-drawer.css';

interface AddEntryDrawerProps {
  onClose: () => void;
  activityToEdit?: Activity;
  initialType?: ActivityType;
}

type MoneyMode = 'finance' | 'payment';

const PICKER_TYPES: { type: ActivityType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'finance',
    label: 'Money',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    type: 'exercise',
    label: 'Health',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        <polyline points="3 12 6 12 8 8 10 16 12 12 14 12 16 9 18 15 20 12 21 12" />
      </svg>
    ),
  },
  {
    type: 'grocery',
    label: 'Shopping',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    type: 'generic',
    label: 'Other',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
];

export default function AddEntryDrawer({ onClose, activityToEdit, initialType }: AddEntryDrawerProps) {
  const isEditing = !!activityToEdit;

  const [selectedType, setSelectedType] = useState<ActivityType | null>(
    activityToEdit
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
      <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-body">
          {!selectedType ? (
            <>
              <h3 className="drawer-title">Add Entry</h3>
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
                <h3 className="drawer-title">{getTitle()}</h3>
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
                  onSaved={handleSaved}
                  initialValues={activityToEdit as FinanceActivity | undefined}
                  entryId={activityToEdit?.id}
                />
              )}
              {selectedType === 'finance' && moneyMode === 'payment' && (
                <PaymentTemplateForm onSaved={handleSaved} />
              )}
              {selectedType === 'exercise' && (
                <ExerciseForm
                  onSaved={handleSaved}
                  initialValues={activityToEdit as ExerciseActivity | undefined}
                  entryId={activityToEdit?.id}
                />
              )}
              {selectedType === 'grocery' && <GroceryForm onSaved={handleSaved} />}
              {selectedType === 'generic' && <GenericActivityForm onSaved={handleSaved} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
