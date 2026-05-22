import { NavLink } from 'react-router-dom';
import { HomeIcon, MoneyIcon, HealthIcon, ShoppingIcon, ReminderIcon } from './icons';
import './bottom-tab-bar.css';

export default function BottomTabBar() {
  return (
    <nav className="bottom-tab-bar">
      <NavLink to="/tracker" end aria-label="Home" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <HomeIcon className="tab-svg-icon" />
        <span className="tab-label">Home</span>
      </NavLink>

      <NavLink to="/tracker/finances" aria-label="Money" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <MoneyIcon className="tab-svg-icon" />
        <span className="tab-label">Money</span>
      </NavLink>

      <NavLink to="/tracker/exercise" aria-label="Health" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <HealthIcon className="tab-svg-icon" />
        <span className="tab-label">Health</span>
      </NavLink>

      <NavLink to="/tracker/groceries" aria-label="Shopping" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <ShoppingIcon className="tab-svg-icon" />
        <span className="tab-label">Shop</span>
      </NavLink>

      <NavLink to="/tracker/reminders" aria-label="Reminder" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
        <ReminderIcon className="tab-svg-icon" />
        <span className="tab-label">Reminder</span>
      </NavLink>
    </nav>
  );
}
