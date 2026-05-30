import { NavLink } from 'react-router-dom';
import { CalendarCheck, Repeat, Heart, MoreHorizontal } from 'lucide-react';
import SplitPillFAB from './SplitPillFAB';
import './bottom-nav.css';

const LEFT_TABS = [
  { to: '/', label: 'Today', Icon: CalendarCheck, end: true },
  { to: '/routines', label: 'Routines', Icon: Repeat, end: false },
];

const RIGHT_TABS = [
  { to: '/health', label: 'Health', Icon: Heart, end: false },
  { to: '/more', label: 'More', Icon: MoreHorizontal, end: false },
];

export default function BottomNav() {
  return (
    <nav className="sn-bottom-nav" aria-label="App navigation">
      <div className="sn-nav-left">
        {LEFT_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sn-tab${isActive ? ' sn-tab--active' : ''}`}
          >
            <Icon size={22} strokeWidth={1.8} className="sn-tab-icon" />
            <span className="sn-tab-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Center pill slot — the pill floats above the nav */}
      <div className="sn-nav-center" aria-hidden="true" />

      <div className="sn-nav-right">
        {RIGHT_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sn-tab${isActive ? ' sn-tab--active' : ''}`}
          >
            <Icon size={22} strokeWidth={1.8} className="sn-tab-icon" />
            <span className="sn-tab-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Split pill floats above the nav center */}
      <SplitPillFAB />
    </nav>
  );
}
