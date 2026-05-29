import { useEffect, useRef, ReactNode } from 'react';
import './bottom-sheet.css';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export default function BottomSheet({ onClose, children, title, className = '' }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    sheetRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div className="sn-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`sn-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="sn-sheet-handle" aria-hidden="true" />
        {title && <div className="sn-sheet-title">{title}</div>}
        <div className="sn-sheet-body">
          {children}
        </div>
      </div>
    </>
  );
}
