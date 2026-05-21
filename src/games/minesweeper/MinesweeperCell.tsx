import React from 'react';
import { CellData } from './types';

type Props = {
  row: number;
  col: number;
  cell: CellData;
  onLeftClick: () => void;
  onRightClick: () => void;
};

export default function MinesweeperCell({ row, col, cell, onLeftClick, onRightClick }: Props) {
  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick();
  };

  const classNames = ['ms-cell'];
  if (cell.state === 'hidden') classNames.push('ms-hidden');
  if (cell.state === 'flagged') classNames.push('ms-flagged');
  if (cell.state === 'open') classNames.push('ms-open');

  let content: React.ReactNode = null;
  if (cell.state === 'flagged') content = '🚩';
  else if (cell.state === 'open') {
    if (cell.hasMine) content = '💣';
    else if (cell.adjacent > 0) content = cell.adjacent;
  }

  return (
    <div
      className={classNames.join(' ')}
      onClick={() => onLeftClick()}
      onContextMenu={handleContext}
      role="button"
      aria-label={`cell-${row}-${col}`}
    >
      <div className="ms-cell-inner">{content}</div>
    </div>
  );
}
