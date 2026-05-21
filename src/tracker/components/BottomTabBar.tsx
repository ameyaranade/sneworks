import { NavLink } from 'react-router-dom';
import './bottom-tab-bar.css';

interface BottomTabBarProps {
  onAddClick: () => void;
  onGoToClick: () => void;
}

export default function BottomTabBar({ onAddClick, onGoToClick }: BottomTabBarProps) {
  return (
    <nav className="bottom-tab-bar">
      <NavLink to="/tracker" end aria-label="Today" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </NavLink>

      <NavLink to="/tracker/calendar" aria-label="Calendar" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </NavLink>

      <button className="tab-item tab-add" onClick={onAddClick} type="button" aria-label="Add entry">
        <span className="tab-add-icon">+</span>
      </button>

      <button className="tab-item" onClick={onGoToClick} type="button" aria-label="Go To">
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </nav>
  );
}
