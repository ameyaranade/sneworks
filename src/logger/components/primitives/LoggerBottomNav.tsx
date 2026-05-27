import { NavLink } from 'react-router-dom';
import { CalendarDays, Clock, CalendarRange, MoreHorizontal } from 'lucide-react';
import './logger-bottom-nav.css';

const TABS = [
  { to: '/logger', label: 'Today', Icon: CalendarDays, end: true },
  { to: '/logger/timeline', label: 'Timeline', Icon: Clock, end: false },
  { to: '/logger/plan', label: 'Plan', Icon: CalendarRange, end: false },
  { to: '/logger/more', label: 'More', Icon: MoreHorizontal, end: false },
];

export default function LoggerBottomNav() {
  return (
    <nav className="lg-bottom-nav" aria-label="Logger navigation">
      {TABS.map(({ to, label, Icon, end }, i) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `lg-tab${isActive ? ' lg-tab--active' : ''}`
          }
          // Leave center slot empty for FAB
          style={i === 1 ? { marginRight: 'calc(var(--lg-fab-size) + 24px)' } : undefined}
        >
          <Icon size={22} strokeWidth={1.8} className="lg-tab-icon" />
          <span className="lg-tab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
