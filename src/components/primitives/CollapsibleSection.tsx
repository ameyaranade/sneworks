import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  label: string;
  count: number;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({ label, count, children, className }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        className="sn-collapsible-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className="sn-collapsible-toggle__count">{count}</span>
        <svg
          className={`sn-collapsible-toggle__chevron${open ? ' sn-collapsible-toggle__chevron--open' : ''}`}
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
        >
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}
