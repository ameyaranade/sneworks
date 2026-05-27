import './segmented-control.css';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = segments.findIndex((s) => s.value === value);

  return (
    <div className="lg-seg" role="group">
      <div
        className="lg-seg-indicator"
        style={{
          width: `${100 / segments.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {segments.map((seg) => (
        <button
          key={seg.value}
          type="button"
          role="radio"
          aria-checked={seg.value === value}
          className={`lg-seg-btn${seg.value === value ? ' lg-seg-btn--active' : ''}`}
          onClick={() => onChange(seg.value)}
        >
          {seg.label}
        </button>
      ))}
    </div>
  );
}
