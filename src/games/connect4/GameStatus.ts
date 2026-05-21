export type CellState = 'Empty' | 'PlayerA' | 'PlayerB';
export type GameStatus = 'PlayerA' | 'PlayerB' | 'PlayerAWon' | 'PlayerBWon' | 'Draw';
export type GameState = Array<Array<CellState>>;


const ROW_COUNT = 6;
const COLUMN_COUNT = 7;
const WIN_COUNT = 4;

interface CellIdx {
  row: number;
  column: number;
};

export interface WinnerStatus {
  status: GameStatus;
  cells?: Array<CellIdx>;
};

function getWinRows(): Array<Array<CellIdx> > {
  const rowWins = Array.from({ length: ROW_COUNT }, (_v, r) =>
    Array.from({ length: COLUMN_COUNT }, (_v2, c) => ({ row: r, column: c } as CellIdx)));
  const columnWins = Array.from({ length: COLUMN_COUNT }, (_v, c) =>
    Array.from({ length: ROW_COUNT }, (_v2, r) => ({ row: r, column: c } as CellIdx)));
  let rightSlantDiag = [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3]].map(
    (value, _i) => {
      let sr = value[0], sc = value[1];
      let winDiag = [];
      while (sr < ROW_COUNT && sc < COLUMN_COUNT) {
        winDiag.push({row: sr, column: sc});
        sr++; sc++;
      }
      return winDiag;
  });
    let leftSlantDiag = [[3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3]].map(
    (value, _i) => {
      let sr = value[0], sc = value[1];
      let winDiag = [];
      while (sr >= 0 && sc < COLUMN_COUNT) {
        winDiag.push({row: sr, column: sc});
        sr--; sc++;
      }
      return winDiag;
  });
  return [...rowWins, ...columnWins, ...rightSlantDiag, ...leftSlantDiag];
}
const WIN_ROWS = getWinRows();

export function getStatus(gameState : GameState): WinnerStatus {
  const statuses = WIN_ROWS.map((indices: Array<CellIdx>) => {
    let winner = 'Empty' as CellState;
    let count = 0;
    let i=0;
    for (;i < indices.length; ++i) {
      if (gameState[indices[i].row][indices[i].column] === winner) {
        ++count;
      } else {
        if (count >= WIN_COUNT) {
          break;
        }
        winner = gameState[indices[i].row][indices[i].column];
        count = 1;
      }
    }
    if (count >= WIN_COUNT && winner !== 'Empty') {
      return {
        status: winner,
        cells: indices.slice(i-count, count)
      }
    } else {
      return null;
    }
  });
  let winStatus = statuses.find((status) => status !== null);
  if (winStatus) {
    return {
      status: winStatus.status === 'PlayerA' ? 'PlayerAWon' : 'PlayerBWon',
      cells: winStatus.cells
    }
  };
  let gameStateFlat = gameState.flat();

  // No more moves left.
  if (gameStateFlat.findIndex((state: CellState) => state === 'Empty') === -1) {
    return {status: 'Draw'};
  }
  // Even number means Player A, else Player B turn
  return {
    status: gameStateFlat.filter(
      (cell) => cell !== 'Empty'
    ).length % 2 === 0 ? 'PlayerA' : 'PlayerB'
  };
}

export function getLabelForState(gameStatus : GameStatus) {
  switch (gameStatus) {
    case 'PlayerA':
      return 'Turn of Player A';
    case 'PlayerB':
      return 'Turn of Player B';
    case 'PlayerAWon':
      return 'Player A won!'
    case 'PlayerBWon':
      return 'Player B won!'
    case 'Draw':
      return 'It\'s a draw!';
  }
}

export function isColumnAvailable(gameState: GameState, column: number): boolean {
  return gameState[0][column] === 'Empty';
}

export function insertCoin(gameState: GameState, column: number, player: CellState): GameState {
  let newGameState = gameState.map((row) => row.slice());
  for (let i=ROW_COUNT-1;i>=0;--i) {
    if (newGameState[i][column] === 'Empty') {
      newGameState[i][column] = player;
      break;
    }
  }
  return newGameState;
}

export function getInitialGameState(): GameState {
  return Array.from({ length: ROW_COUNT }, () =>
    Array.from({ length: COLUMN_COUNT }, () => 'Empty' as CellState)
  );
}
