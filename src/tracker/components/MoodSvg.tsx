interface MoodSvgProps {
  mood: number;
  label?: string;
  size?: number;
  className?: string;
}

const MOUTH_PATHS: Record<number, string> = {
  1: 'M 7 16.5 Q 12 11.5 17 16.5',   // big frown
  2: 'M 8 15.5 Q 12 13 16 15.5',      // slight frown
  3: 'M 8 14 L 16 14',                 // neutral
  4: 'M 8 13 Q 12 16.5 16 13',        // slight smile
  5: 'M 7 12.5 Q 12 18 17 12.5',      // big smile
};

export default function MoodSvg({ mood, label, size = 18, className }: MoodSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      role="img"
      aria-label={label ?? `Mood ${mood}`}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <path d={MOUTH_PATHS[mood] ?? MOUTH_PATHS[3]} />
    </svg>
  );
}
