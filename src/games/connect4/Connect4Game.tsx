import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cell from './Cell';
import { CellState, getLabelForState, isColumnAvailable as _isColumnAvailable } from './GameStatus';
import { useConnect4Game } from './useConnect4Game';
import './connect4.css';

export default function Connect4Game() {
  const navigate = useNavigate();
  const [hoveredColumn, setHoveredColumn] = useState(-1);
  const [gameState, onResetGame, onCellClick, getGameStatus] = useConnect4Game();

  const availableColumns = useMemo(() => {
    return new Set(gameState[0]
      .map((cellState: CellState, idx) => cellState === 'Empty' ? idx : -1)
      .filter((v) => v !== -1));
  }, [gameState]);

  const statusLabel = useMemo(() => getLabelForState(getGameStatus()), [getGameStatus]);

  return (
    <div className="game-board">
      <div className="game-header">
        <button className="btn-back" onClick={() => navigate('/games')}>← Games</button>
        <button className="btn-new" onClick={onResetGame}>New Game</button>
        <div className="status-label">{statusLabel}</div>
      </div>
      <div
        className="board-grid"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${gameState[0].length}, 64px)`, gap: 0 }}
      >
        {gameState.map((row, rowIdx) =>
          row.map((cell, cellIdx) => (
            <div
              key={`${rowIdx}-${cellIdx}`}
              className={`cell-slot ${availableColumns.has(cellIdx) ? 'available' : ''}`}
            >
              <Cell
                cellState={cell}
                hovered={(hoveredColumn === cellIdx) && availableColumns.has(cellIdx)}
                handleMove={() => setHoveredColumn(cellIdx)}
                handleOut={() => setHoveredColumn(-1)}
                handleClick={() => onCellClick(cellIdx)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
