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

const TYPES: ActivityType[] = ['finance', 'exercise', 'grocery', 'payment', 'generic'];

export default function AddEntryDrawer({ onClose, activityToEdit }: AddEntryDrawerProps) {
  const [selectedType, setSelectedType] = useState<ActivityType | null>(
    activityToEdit ? activityToEdit.type : null,
  );

  const isEditing = !!activityToEdit;

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

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-body">
          {!selectedType ? (
            <>
              <h3 className="drawer-title">Add Entry</h3>
              <div className="type-picker-grid">
                {TYPES.map((t) => {
                  const meta = ACTIVITY_TYPE_META[t];
                  return (
                    <button
                      key={t}
                      className="type-picker-btn"
                      style={{ '--type-color': meta.color } as React.CSSProperties}
                      onClick={() => setSelectedType(t)}
                    >
                      <span className="type-picker-emoji">{meta.emoji}</span>
                      <span className="type-picker-label">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="drawer-form-header">
                <button className="drawer-back-btn" onClick={handleBack}>&larr;</button>
                <h3 className="drawer-title">
                  {isEditing ? `Edit ${ACTIVITY_TYPE_META[selectedType].label}` : ACTIVITY_TYPE_META[selectedType].label}
                </h3>
              </div>
              {selectedType === 'finance' && (
                <FinanceForm
                  onSaved={handleSaved}
                  initialValues={activityToEdit as FinanceActivity | undefined}
                  entryId={activityToEdit?.id}
                />
              )}
              {selectedType === 'exercise' && (
                <ExerciseForm
                  onSaved={handleSaved}
                  initialValues={activityToEdit as ExerciseActivity | undefined}
                  entryId={activityToEdit?.id}
                />
              )}
              {selectedType === 'grocery' && <GroceryForm onSaved={handleSaved} />}
              {selectedType === 'payment' && <PaymentTemplateForm onSaved={handleSaved} />}
              {selectedType === 'generic' && <GenericActivityForm onSaved={handleSaved} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
