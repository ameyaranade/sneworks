import BottomSheet from './BottomSheet';
import './confirm-sheet.css';

interface ConfirmSheetProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSheet({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet onClose={onCancel} title={title}>
      <div className="sb-confirm-body">
        <p className="sb-confirm-message">{message}</p>
        <div className="sb-confirm-actions">
          <button
            type="button"
            className="sb-compose-cancel-btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`sb-confirm-cta${danger ? ' sb-confirm-cta--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
