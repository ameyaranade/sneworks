import type { ReactNode } from 'react';

interface EmptyStateCta {
  label: string;
  onClick: () => void;
  variant?: 'accent' | 'success';
}

interface EmptyStateProps {
  glyph: ReactNode;
  title: string;
  sub?: string;
  cta?: EmptyStateCta;
  className?: string;
}

export default function EmptyState({ glyph, title, sub, cta, className }: EmptyStateProps) {
  return (
    <div className={`sn-empty-state${className ? ` ${className}` : ''}`}>
      <span className="sn-empty-state__glyph">{glyph}</span>
      <p className="sn-empty-state__title">{title}</p>
      {sub && <p className="sn-empty-state__sub">{sub}</p>}
      {cta && (
        <button
          type="button"
          className={`sn-empty-state__cta sn-empty-state__cta--${cta.variant ?? 'accent'}`}
          onClick={cta.onClick}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
