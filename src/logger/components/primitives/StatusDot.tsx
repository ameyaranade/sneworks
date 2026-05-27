import './status-dot.css';

export type DotVariant = 'log' | 'pending' | 'done' | 'skipped' | 'deferred' | 'recurring';

interface StatusDotProps {
  variant: DotVariant;
  size?: number;
}

export default function StatusDot({ variant, size = 8 }: StatusDotProps) {
  return (
    <span
      className={`lg-dot lg-dot--${variant}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
