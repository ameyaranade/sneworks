import { useEffect, useRef, ReactNode } from 'react';
import './bottom-sheet.css';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Extra class for sheet-specific sizing / padding overrides */
  className?: string;
}

export default function BottomSheet({ onClose, children, title, className = '' }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape to close
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
      <div
        className="lg-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={`lg-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="lg-sheet-handle" aria-hidden="true" />
        {title && <div className="lg-sheet-title">{title}</div>}
        <div className="lg-sheet-body">
          {children}
        </div>
      </div>
    </>
  );
}
