import { NavLink } from 'react-router-dom';
import { CalendarCheck, Repeat, Clock, MoreHorizontal } from 'lucide-react';
import SplitPillFAB from './SplitPillFAB';
import './sandbox-bottom-nav.css';

const LEFT_TABS = [
  { to: '/sandbox', label: 'Today', Icon: CalendarCheck, end: true },
  { to: '/sandbox/routines', label: 'Routines', Icon: Repeat, end: false },
];

const RIGHT_TABS = [
  { to: '/sandbox/timeline', label: 'Timeline', Icon: Clock, end: false },
  { to: '/sandbox/more', label: 'More', Icon: MoreHorizontal, end: false },
];

export default function SandboxBottomNav() {
  return (
    <nav className="sb-bottom-nav" aria-label="Sandbox navigation">
      <div className="sb-nav-left">
        {LEFT_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sb-tab${isActive ? ' sb-tab--active' : ''}`}
          >
            <Icon size={22} strokeWidth={1.8} className="sb-tab-icon" />
            <span className="sb-tab-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Center pill slot — the pill floats above the nav */}
      <div className="sb-nav-center" aria-hidden="true" />

      <div className="sb-nav-right">
        {RIGHT_TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sb-tab${isActive ? ' sb-tab--active' : ''}`}
          >
            <Icon size={22} strokeWidth={1.8} className="sb-tab-icon" />
            <span className="sb-tab-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Split pill floats above the nav center */}
      <SplitPillFAB />
    </nav>
  );
}
