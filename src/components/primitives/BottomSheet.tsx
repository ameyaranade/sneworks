import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

  // Portal into #sn-portal so the sheet stays inside [data-theme] (CSS vars work)
  // but is a top-level sibling of page content (z-index works, no stacking-context traps).
  const portalTarget = document.getElementById('sn-portal') ?? document.body;

  return createPortal(
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
    </>,
    portalTarget,
  );
}
