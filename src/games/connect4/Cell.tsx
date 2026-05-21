import { CellState } from './GameStatus';

type CellProps = {
  cellState: CellState;
  handleClick: () => void;
  handleMove: () => void;
  handleOut: () => void;
  hovered: boolean;
};

export default function Cell({ cellState, handleClick, handleMove, handleOut, hovered }: CellProps) {
  let classNames = ['cell'];
  switch (cellState) {
    case 'PlayerA':
      classNames.push('cell-player-a');
      break;
    case 'PlayerB':
      classNames.push('cell-player-b');
      break;
    default:
      classNames.push('cell-empty');
  }
  if (hovered) {
    classNames.push('cell-hovered');
  }

  return (
    <div className={classNames.join(' ')} onClick={handleClick} onMouseMove={handleMove} onMouseLeave={handleOut}>
      <div className="cell-inner"></div>
    </div>
  );
}
