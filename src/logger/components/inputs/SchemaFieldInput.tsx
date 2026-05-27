import Chip from '../primitives/Chip';
import QuickPills from './QuickPills';
import type { SchemaField } from '../../types';
import './schema-field-input.css';

interface SchemaFieldInputProps {
  field: SchemaField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export default function SchemaFieldInput({ field, value, onChange }: SchemaFieldInputProps) {
  const set = (v: unknown) => onChange(field.key, v);

  switch (field.type) {
    case 'currency':
    case 'number': {
      const num = typeof value === 'number' ? value : '';
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <div className="lg-field-amount-wrap">
            {field.prefix && <span className="lg-field-prefix">{field.prefix}</span>}
            <input
              type="number"
              inputMode="decimal"
              className="lg-field-input lg-field-input--number"
              value={num}
              placeholder="0"
              min={0}
              onChange={(e) => set(e.target.value === '' ? undefined : parseFloat(e.target.value))}
            />
            {field.suffix && <span className="lg-field-suffix">{field.suffix}</span>}
          </div>
          {field.type === 'currency' && (
            <QuickPills
              values={[50, 100, 200, 500]}
              prefix={field.prefix}
              onSelect={(v) => set(v)}
            />
          )}
        </div>
      );
    }

    case 'duration': {
      const num = typeof value === 'number' ? value : '';
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <div className="lg-field-amount-wrap">
            <input
              type="number"
              inputMode="numeric"
              className="lg-field-input lg-field-input--number"
              value={num}
              placeholder="0"
              min={0}
              onChange={(e) => set(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
            />
            <span className="lg-field-suffix">{field.suffix ?? 'min'}</span>
          </div>
          <QuickPills values={[15, 30, 45, 60]} suffix=" min" onSelect={(v) => set(v)} />
        </div>
      );
    }

    case 'text':
    case 'url': {
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <input
            type={field.type === 'url' ? 'url' : 'text'}
            className="lg-field-input"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.label}
            onChange={(e) => set(e.target.value || undefined)}
          />
        </div>
      );
    }

    case 'enum':
    case 'select': {
      const selected = typeof value === 'string' ? value : '';
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <div className="lg-field-chips">
            {(field.options ?? []).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={selected === opt}
                onClick={() => set(selected === opt ? undefined : opt)}
              />
            ))}
          </div>
        </div>
      );
    }

    case 'multi-select': {
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <div className="lg-field-chips">
            {(field.options ?? []).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={selected.includes(opt)}
                onClick={() => {
                  const next = selected.includes(opt)
                    ? selected.filter((s) => s !== opt)
                    : [...selected, opt];
                  set(next.length > 0 ? next : undefined);
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    case 'boolean': {
      const checked = value === true;
      return (
        <div className="lg-field lg-field--row">
          <label className="lg-field-label">{field.label}</label>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            className={`lg-switch${checked ? ' lg-switch--on' : ''}`}
            onClick={() => set(!checked)}
          >
            <span className="lg-switch-thumb" />
          </button>
        </div>
      );
    }

    case 'rating': {
      const rating = typeof value === 'number' ? value : 0;
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <div className="lg-field-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`lg-star${star <= rating ? ' lg-star--filled' : ''}`}
                onClick={() => set(star === rating ? 0 : star)}
                aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'date': {
      const dateStr = typeof value === 'string' ? value : '';
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <input
            type="date"
            className="lg-field-input"
            value={dateStr}
            onChange={(e) => set(e.target.value || undefined)}
          />
        </div>
      );
    }

    case 'time': {
      const timeStr = typeof value === 'string' ? value : '';
      return (
        <div className="lg-field">
          <label className="lg-field-label">{field.label}</label>
          <input
            type="time"
            className="lg-field-input"
            value={timeStr}
            onChange={(e) => set(e.target.value || undefined)}
          />
        </div>
      );
    }

    default:
      return null;
  }
}
