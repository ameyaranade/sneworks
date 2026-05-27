import { ReactNode, useRef } from 'react';
import { motion, PanInfo, useMotionValue, animate } from 'framer-motion';
import './swipeable-row.css';

export interface SwipeAction {
  label: string;
  className: string;
  onTrigger: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  /** Actions revealed on right-side (left swipe) */
  leftActions?: SwipeAction[];
  /** Actions revealed on left-side (right swipe) */
  rightActions?: SwipeAction[];
  /** px threshold to trigger an action reveal */
  threshold?: number;
  disabled?: boolean;
}

const ACTION_WIDTH = 72;
const THRESHOLD = 80;

export default function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  threshold = THRESHOLD,
  disabled = false,
}: SwipeableRowProps) {
  const x = useMotionValue(0);
  const isDragging = useRef(false);

  const springBack = () => animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    isDragging.current = false;
    const offsetX = info.offset.x;

    // Right swipe → reveal left (right-side) actions
    if (offsetX > threshold && rightActions.length > 0) {
      animate(x, rightActions.length * ACTION_WIDTH, { type: 'spring', stiffness: 400, damping: 40 });
    }
    // Left swipe → reveal right (left-side) actions
    else if (offsetX < -threshold && leftActions.length > 0) {
      animate(x, -leftActions.length * ACTION_WIDTH, { type: 'spring', stiffness: 400, damping: 40 });
    }
    else {
      springBack();
    }
  };

  if (disabled) {
    return <div className="lg-swipe-container">{children}</div>;
  }

  return (
    <div className="lg-swipe-container">
      {/* Right actions revealed by right swipe */}
      {rightActions.length > 0 && (
        <div className="lg-swipe-actions lg-swipe-actions--right">
          {rightActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`lg-swipe-action ${action.className}`}
              onClick={() => { action.onTrigger(); springBack(); }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Left actions revealed by left swipe */}
      {leftActions.length > 0 && (
        <div className="lg-swipe-actions lg-swipe-actions--left">
          {leftActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`lg-swipe-action ${action.className}`}
              onClick={() => { action.onTrigger(); springBack(); }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <motion.div
        className="lg-swipe-row"
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: leftActions.length > 0 ? -leftActions.length * ACTION_WIDTH : 0,
          right: rightActions.length > 0 ? rightActions.length * ACTION_WIDTH : 0,
        }}
        dragElastic={0.08}
        onDragEnd={onDragEnd}
        onDragStart={() => { isDragging.current = true; }}
      >
        {children}
      </motion.div>
    </div>
  );
}
