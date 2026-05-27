import { Plus } from 'lucide-react';
import './fab.css';

interface FABProps {
  onClick: () => void;
}

export default function FAB({ onClick }: FABProps) {
  return (
    <button
      className="lg-fab"
      onClick={onClick}
      aria-label="New entry"
      type="button"
    >
      <Plus size={24} strokeWidth={2.5} />
    </button>
  );
}
