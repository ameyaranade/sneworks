import { useCallback, useState } from 'react';
import { CellState, GameState, GameStatus, getInitialGameState, getStatus, insertCoin, isColumnAvailable } from './GameStatus';

export function useConnect4Game():
  [GameState, () => void, (column: number) => void, () => GameStatus] {
    const [gameState, setGateState] = useState(getInitialGameState());

    const onResetGame = useCallback(() => {
      setGateState(getInitialGameState());
    }, []);

    const onCellClick = useCallback((column: number) => {
      const gameStatus = getStatus(gameState);
      if (gameStatus.status in ['PlayerAWon', 'PlayerBWon', 'Draw'] ||
        !isColumnAvailable(gameState, column)
      ) {
        return;
      }
      setGateState(insertCoin(gameState, column, gameStatus.status as CellState));
    }, [gameState]);

    const getGameStatus = useCallback(() => {
      return getStatus(gameState).status;
    }, [gameState]);

    return [gameState, onResetGame, onCellClick, getGameStatus];
}
