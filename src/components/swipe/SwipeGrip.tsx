import type { MouseEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { useSwipeControls } from './SwipeableRow';
import './swipeable-row.css';

/**
 * Trailing-edge affordance that signals a row is swipeable (pull to reveal
 * actions). The 6-dot grip makes the gesture discoverable; tapping it reveals
 * the same actions as a left swipe (or closes them) via SwipeableRow's
 * SwipeControls context — so actions are reachable without a swipe gesture
 * (desktop / accessibility). Render only on rows that are actually swipeable
 * (see DESIGN_LANGUAGE.md → Swipe grip).
 */
export default function SwipeGrip() {
  const controls = useSwipeControls();

  const handleTap = (e: MouseEvent) => {
    e.stopPropagation();
    controls?.toggleActions();
  };

  return (
    <button
      type="button"
      className="sn-swipe-grip"
      aria-label="Show actions"
      title="Show actions"
      onClick={handleTap}
    >
      <GripVertical size={16} strokeWidth={2} />
    </button>
  );
}
