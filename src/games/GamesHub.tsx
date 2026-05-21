import { Link } from 'react-router-dom';
import './games-hub.css';

const games = [
  {
    to: '/games/connect4',
    title: '🔴 Connect 4',
    description: 'Drop pieces to get four in a row. 2-player local.',
  },
  {
    to: '/games/minesweeper',
    title: '💣 Minesweeper',
    description: 'Reveal the board without hitting a mine.',
  },
];

export default function GamesHub() {
  return (
    <div className="games-hub">
      <h1 className="games-hub-title">Games</h1>
      <div className="games-hub-cards">
        {games.map((g) => (
          <Link key={g.to} to={g.to} className="game-card">
            <h2 className="game-card-title">{g.title}</h2>
            <p className="game-card-desc">{g.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
