import { useNavigate } from 'react-router-dom';
import './go-to-menu.css';

interface GoToMenuProps {
  onClose: () => void;
}

const DESTINATIONS = [
  { emoji: '💰', label: 'Finances', path: '/tracker/finances' },
  { emoji: '🏋️', label: 'Exercise & Health', path: '/tracker/exercise' },
  { emoji: '🛒', label: 'Groceries', path: '/tracker/groceries' },
  { emoji: '📌', label: 'Reminders', path: '/tracker/reminders' },
];

export default function GoToMenu({ onClose }: GoToMenuProps) {
  const navigate = useNavigate();

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="goto-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <h3 className="goto-title">Go To</h3>
        <ul className="goto-list">
          {DESTINATIONS.map((d) => (
            <li key={d.path}>
              <button className="goto-item" onClick={() => handleNav(d.path)}>
                <span className="goto-emoji">{d.emoji}</span>
                <span className="goto-label">{d.label}</span>
                <span className="goto-arrow">›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
