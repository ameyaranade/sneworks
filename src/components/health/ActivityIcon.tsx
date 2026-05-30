import type { WorkoutType } from '../../types';

interface ActivityIconProps {
  type: WorkoutType;
  size?: number;
  className?: string;
}

export default function ActivityIcon({ type, size = 16, className }: ActivityIconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  switch (type) {
    case 'Run':
      return (
        <svg {...props}>
          {/* Running figure */}
          <circle cx="13" cy="4" r="1.5" />
          <path d="M8 18l2-6 2 2 3-4" />
          <path d="M6 21l4-3" />
          <path d="M14 9l2 5 3 1" />
        </svg>
      );
    case 'Walk':
      return (
        <svg {...props}>
          <circle cx="12" cy="4" r="1.5" />
          <path d="M9 20l1-5 2 2 2-5" />
          <path d="M7 21l3-1" />
          <path d="M13 9l3 3-1 4" />
        </svg>
      );
    case 'Cycle':
      return (
        <svg {...props}>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16l4-7h4l2 7" />
          <path d="M10 9l2-3" />
          <circle cx="12" cy="5" r="1" />
        </svg>
      );
    case 'Gym':
      return (
        <svg {...props}>
          <path d="M6 7v10M18 7v10" />
          <path d="M4 9v6M20 9v6" />
          <path d="M6 12h12" />
        </svg>
      );
    case 'Yoga':
      return (
        <svg {...props}>
          <circle cx="12" cy="4" r="1.5" />
          <path d="M12 6v5" />
          <path d="M7 14c1-2 3-3 5-3s4 1 5 3" />
          <path d="M5 17h14" />
          <path d="M8 17l-2 3M16 17l2 3" />
        </svg>
      );
    case 'Swim':
      return (
        <svg {...props}>
          <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <circle cx="17" cy="6" r="1.5" />
          <path d="M17 7.5v3l-3 2" />
        </svg>
      );
    case 'Other':
    default:
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
  }
}
