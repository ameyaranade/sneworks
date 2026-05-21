import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MinesweeperCell from './MinesweeperCell';
import { CellData, GameStatus } from './types';
import './minesweeper.css';

const ROWS = 8;
const COLS = 8;
const MINES = 10;

function createEmptyGrid(rows: number, cols: number): CellData[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ hasMine: false, state: 'hidden' as const, adjacent: 0 }))
  );
}

function placeMines(grid: CellData[][], mines: number) {
  const rows = grid.length;
  const cols = grid[0].length;
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!grid[r][c].hasMine) {
      grid[r][c].hasMine = true;
      placed++;
    }
  }
}

function computeAdjacents(grid: CellData[][]) {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].hasMine) {
        grid[r][c].adjacent = -1;
        continue;
      }
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].hasMine) count++;
        }
      }
      grid[r][c].adjacent = count;
    }
  }
}

export default function MinesweeperGame() {
  const navigate = useNavigate();
  const [rows] = useState(ROWS);
  const [cols] = useState(COLS);
  const [mines] = useState(MINES);

  const [grid, setGrid] = useState<CellData[][]>(() => {
    const g = createEmptyGrid(ROWS, COLS);
    placeMines(g, MINES);
    computeAdjacents(g);
    return g;
  });

  const [status, setStatus] = useState<GameStatus>('Ongoing');

  const resetGame = useCallback(() => {
    const g = createEmptyGrid(rows, cols);
    placeMines(g, mines);
    computeAdjacents(g);
    setGrid(g);
    setStatus('Ongoing');
  }, [rows, cols, mines]);

  useEffect(() => {
    // placeholder for future keyboard/context event handling
  }, []);

  const revealAllMines = useCallback((g: CellData[][]) => {
    const copy = g.map(row => row.map(cell => ({ ...cell })));
    for (let r = 0; r < copy.length; r++) {
      for (let c = 0; c < copy[0].length; c++) {
        if (copy[r][c].hasMine) copy[r][c].state = 'open';
      }
    }
    return copy;
  }, []);

  const checkWin = useCallback((g: CellData[][]) => {
    let unopenedNonMines = 0;
    for (const row of g) {
      for (const cell of row) {
        if (!cell.hasMine && cell.state !== 'open') unopenedNonMines++;
      }
    }
    return unopenedNonMines === 0;
  }, []);

  const openCell = useCallback((r: number, c: number) => {
    if (status !== 'Ongoing') return;
    setGrid(prev => {
      const g = prev.map(row => row.map(cell => ({ ...cell })));
      const cell = g[r][c];
      if (cell.state !== 'hidden') return prev;
      if (cell.hasMine) {
        const revealed = revealAllMines(g);
        setStatus('Lost');
        return revealed;
      }

      const stack: Array<[number, number]> = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        const current = g[cr][cc];
        if (current.state === 'open' || current.state === 'flagged') continue;
        current.state = 'open';
        if (current.adjacent === 0) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = cr + dr;
              const nc = cc + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const neighbor = g[nr][nc];
                if (neighbor.state === 'hidden' && !neighbor.hasMine) {
                  stack.push([nr, nc]);
                }
              }
            }
          }
        }
      }

      if (checkWin(g)) {
        setStatus('Won');
      }
      return g;
    });
  }, [rows, cols, status, revealAllMines, checkWin]);

  const toggleFlag = useCallback((r: number, c: number) => {
    if (status !== 'Ongoing') return;
    setGrid(prev => {
      const g = prev.map(row => row.map(cell => ({ ...cell })));
      const cell = g[r][c];
      if (cell.state === 'open') return prev;
      cell.state = cell.state === 'flagged' ? 'hidden' : 'flagged';
      return g;
    });
  }, [status]);

  const minesRemaining = useMemo(() => {
    let flagged = 0;
    for (const row of grid) for (const cell of row) if (cell.state === 'flagged') flagged++;
    return Math.max(0, mines - flagged);
  }, [grid, mines]);

  return (
    <div className="minesweeper">
      <div className="game-header">
        <button className="btn-back" onClick={() => navigate('/games')}>← Games</button>
        <button className="btn-new" onClick={resetGame}>New Game</button>
        <div className="status-label">{status} — Mines remaining: {minesRemaining}</div>
      </div>
      <div
        className="ms-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 36px)` }}
      >
        {grid.map((row, rIdx) =>
          row.map((cell, cIdx) => (
            <MinesweeperCell
              key={`${rIdx}-${cIdx}`}
              row={rIdx}
              col={cIdx}
              cell={cell}
              onLeftClick={() => openCell(rIdx, cIdx)}
              onRightClick={() => toggleFlag(rIdx, cIdx)}
            />
          ))
        )}
      </div>
    </div>
  );
}
