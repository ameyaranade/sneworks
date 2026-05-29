type ProgressColor = 'accent' | 'success' | 'purple' | 'danger';

interface ProgressBarProps {
  pct: number;
  color?: ProgressColor;
  className?: string;
}

export default function ProgressBar({ pct, color = 'accent', className }: ProgressBarProps) {
  return (
    <div className={`sn-progress-track${className ? ` ${className}` : ''}`}>
      <div
        className={`sn-progress-fill${color !== 'accent' ? ` sn-progress-fill--${color}` : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
