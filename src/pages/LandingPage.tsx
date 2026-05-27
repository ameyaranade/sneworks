import { Link } from 'react-router-dom';
import './landing.css';

const sections = [
  {
    to: '/games',
    title: '🎮 Games',
    description: 'Connect 4, Minesweeper, and more. No login required.',
  },
  {
    to: '/tracker',
    title: '📊 Tracker',
    description: 'Activity and health tracking. Sign in to get started.',
  },
  {
    to: '/logger',
    title: '✦ Logger',
    description: 'Schema-driven activity logger with logs, todos, and groups.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-hero">
        <h1 className="landing-title">SNE Works</h1>
        <p className="landing-subtitle">A personal collection of apps and games.</p>
      </div>
      <div className="landing-cards">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="landing-card">
            <h2 className="landing-card-title">{s.title}</h2>
            <p className="landing-card-desc">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
