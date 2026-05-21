export type CellState = 'hidden' | 'open' | 'flagged';

export type CellData = {
  hasMine: boolean;
  state: CellState;
  adjacent: number;
};

export type GameStatus = 'Ongoing' | 'Won' | 'Lost';
