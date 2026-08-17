import { X, Sparkles } from 'lucide-react';
import './daily-summary.css';

interface DailySummaryCardProps {
  text: string;
  loading: boolean;
  onDismiss: () => void;
}

export default function DailySummaryCard({ text, loading, onDismiss }: DailySummaryCardProps) {
  return (
    <div className="sn-summary-card">
      <span className="sn-summary-card__icon" aria-hidden>
        <Sparkles size={14} strokeWidth={2} />
      </span>
      <span className="sn-summary-card__text">
        {loading ? (
          <span className="sn-summary-card__shimmer" aria-label="Generating summary" />
        ) : (
          text
        )}
      </span>
      <button
        type="button"
        className="sn-summary-card__close"
        onClick={onDismiss}
        aria-label="Dismiss daily summary"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
