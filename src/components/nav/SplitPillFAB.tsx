import { Pencil, Plus } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import './split-pill-fab.css';

export default function SplitPillFAB() {
  const { openComposeLog, openComposeTodo } = useUI();

  return (
    <div className="sn-split-pill" role="group" aria-label="Create new entry">
      <button
        type="button"
        className="sn-split-pill__half sn-split-pill__half--log"
        onClick={() => openComposeLog()}
        aria-label="Log something"
      >
        <Pencil size={16} strokeWidth={2} />
        <span className="sn-split-pill__label">Log</span>
      </button>

      <div className="sn-split-pill__divider" aria-hidden="true" />

      <button
        type="button"
        className="sn-split-pill__half sn-split-pill__half--todo"
        onClick={() => openComposeTodo()}
        aria-label="Add a TODO"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span className="sn-split-pill__label">TODO</span>
      </button>
    </div>
  );
}
