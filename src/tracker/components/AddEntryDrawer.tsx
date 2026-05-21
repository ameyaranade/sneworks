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
}

type MoneyMode = 'finance' | 'payment';

const PICKER_TYPES = [
  { type: 'finance' as ActivityType, label: 'Money', emoji: '💰', color: '#2ecc71' },
  { type: 'exercise' as ActivityType, label: 'Exercise', emoji: '💪', color: '#3498db' },
  { type: 'grocery' as ActivityType, label: 'Groceries', emoji: '🛒', color: '#e67e22' },
  { type: 'generic' as ActivityType, label: 'Other', emoji: '📝', color: '#7f8c8d' },
];

export default function AddEntryDrawer({ onClose, activityToEdit }: AddEntryDrawerProps) {
  const isEditing = !!activityToEdit;

  const [selectedType, setSelectedType] = useState<ActivityType | null>(
    activityToEdit
      ? (activityToEdit.type === 'payment' ? 'finance' : activityToEdit.type)
      : null,
  );
  const [moneyMode, setMoneyMode] = useState<MoneyMode>(
    activityToEdit?.type === 'payment' ? 'payment' : 'finance',
  );

  const handleSaved = () => {
    setSelectedType(null);
    onClose();
  };

  const handleBack = () => {
    if (isEditing) {
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
                {PICKER_TYPES.map(({ type, label, emoji, color }) => (
                  <button
                    key={type}
                    className="type-picker-btn"
                    style={{ '--type-color': color } as React.CSSProperties}
                    onClick={() => setSelectedType(type)}
                  >
                    <span className="type-picker-emoji">{emoji}</span>
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
