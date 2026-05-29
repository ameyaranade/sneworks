import { ReactNode, useRef } from 'react';
import { motion, PanInfo, useMotionValue, animate } from 'framer-motion';
import './swipeable-row.css';

export interface SwipeAction {
  label: string;
  className: string;
  onTrigger: () => void;
  icon?: ReactNode;
}

interface SwipeableRowProps {
  children: ReactNode;
  /** Actions revealed on right side (left swipe) */
  leftActions?: SwipeAction[];
  /** Actions revealed on left side (right swipe) */
  rightActions?: SwipeAction[];
  threshold?: number;
  disabled?: boolean;
}

const ACTION_WIDTH = 72;
const THRESHOLD = 72;

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

    if (offsetX > threshold && rightActions.length > 0) {
      animate(x, rightActions.length * ACTION_WIDTH, { type: 'spring', stiffness: 400, damping: 40 });
    } else if (offsetX < -threshold && leftActions.length > 0) {
      animate(x, -leftActions.length * ACTION_WIDTH, { type: 'spring', stiffness: 400, damping: 40 });
    } else {
      springBack();
    }
  };

  if (disabled) {
    return <div className="sn-swipe-container">{children}</div>;
  }

  return (
    <div className="sn-swipe-container">
      {/* Right-swipe: reveal left-side actions */}
      {rightActions.length > 0 && (
        <div className="sn-swipe-actions sn-swipe-actions--right">
          {rightActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`sn-swipe-action ${action.className}`}
              onClick={() => { action.onTrigger(); springBack(); }}
            >
              {action.icon && <span className="sn-swipe-action-icon">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Left-swipe: reveal right-side actions */}
      {leftActions.length > 0 && (
        <div className="sn-swipe-actions sn-swipe-actions--left">
          {leftActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`sn-swipe-action ${action.className}`}
              onClick={() => { action.onTrigger(); springBack(); }}
            >
              {action.icon && <span className="sn-swipe-action-icon">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      <motion.div
        className="sn-swipe-row"
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
