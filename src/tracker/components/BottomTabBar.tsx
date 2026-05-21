import { NavLink } from 'react-router-dom';
import './bottom-tab-bar.css';

export default function BottomTabBar() {
  return (
    <nav className="bottom-tab-bar">
      {/* Home */}
      <NavLink to="/tracker" end aria-label="Home" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="tab-label">Home</span>
      </NavLink>

      {/* Money */}
      <NavLink to="/tracker/finances" aria-label="Money" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <span className="tab-label">Money</span>
      </NavLink>

      {/* Health — heart with heartbeat line */}
      <NavLink to="/tracker/exercise" aria-label="Health" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          <polyline points="3 12 6 12 8 8 10 16 12 12 14 12 16 9 18 15 20 12 21 12" />
        </svg>
        <span className="tab-label">Health</span>
      </NavLink>

      {/* Shopping */}
      <NavLink to="/tracker/groceries" aria-label="Shopping" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="tab-label">Shop</span>
      </NavLink>

      {/* Reminder */}
      <NavLink to="/tracker/reminders" aria-label="Reminder" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <svg className="tab-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="tab-label">Reminder</span>
      </NavLink>
    </nav>
  );
}
