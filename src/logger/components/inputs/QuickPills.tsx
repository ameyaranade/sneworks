import './quick-pills.css';

interface QuickPillsProps {
  values: number[];
  prefix?: string;
  suffix?: string;
  onSelect: (value: number) => void;
}

export default function QuickPills({ values, prefix = '', suffix = '', onSelect }: QuickPillsProps) {
  return (
    <div className="lg-quick-pills">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className="lg-quick-pill"
          onClick={() => onSelect(v)}
        >
          {prefix}{v}{suffix}
        </button>
      ))}
    </div>
  );
}
