import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface DetailPageHeaderProps {
  onBack: () => void;
  title: string;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
}

export default function DetailPageHeader({ onBack, title, subtitle, rightSlot }: DetailPageHeaderProps) {
  return (
    <div className="sn-detail-header">
      <button
        type="button"
        className="sn-detail-header__back"
        onClick={onBack}
        aria-label="Go back"
      >
        <ArrowLeft size={16} strokeWidth={2} />
      </button>
      <div className="sn-detail-header__title-wrap">
        <h1 className="sn-detail-header__title">{title}</h1>
        {subtitle && <span className="sn-detail-header__subtitle">{subtitle}</span>}
      </div>
      {rightSlot}
    </div>
  );
}
