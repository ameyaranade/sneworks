interface SheetFormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  disabled?: boolean;
}

export default function SheetFormActions({
  onCancel,
  onSave,
  saveLabel = 'Save',
  saving = false,
  disabled = false,
}: SheetFormActionsProps) {
  return (
    <div className="sn-sheet-actions">
      <button type="button" className="sn-sheet-cancel-btn" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className="sn-sheet-save-btn"
        disabled={disabled || saving}
        onClick={onSave}
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
