interface GoalRingProps {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export default function GoalRing({
  pct,
  color,
  size = 80,
  strokeWidth = 8,
  label,
  sublabel,
}: GoalRingProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(Math.max(pct, 0), 1) * circ;

  return (
    <div className="sn-goal-ring" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity={0.15}
          className="sn-goal-ring__track"
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          className="sn-goal-ring__fill"
        />
      </svg>
      {(label || sublabel) && (
        <div className="sn-goal-ring__center">
          {label && <span className="sn-goal-ring__label">{label}</span>}
          {sublabel && <span className="sn-goal-ring__sublabel">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
