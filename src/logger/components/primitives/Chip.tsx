import './chip.css';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  color?: string;
  small?: boolean;
}

export default function Chip({ label, selected = false, onClick, color, small = false }: ChipProps) {
  return (
    <button
      type="button"
      className={`lg-chip${selected ? ' lg-chip--selected' : ''}${small ? ' lg-chip--small' : ''}`}
      style={selected && color ? { borderColor: color, color } : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
