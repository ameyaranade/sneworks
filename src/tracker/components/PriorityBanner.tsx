import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from '../context/TrackerProvider';
import { computeDueStatus, formatCurrency } from '../utils';
import './priority-banner.css';

export default function PriorityBanner() {
  const { recurringItems, monthEntries, settings } = useTracker();
  const navigate = useNavigate();

  const alerts = useMemo(() => {
    return recurringItems
      .map((item) => ({ item, status: computeDueStatus(item, monthEntries) }))
      .filter(({ status }) => status === 'overdue' || status === 'due-today')
      .sort((a, b) => (a.status === 'overdue' ? -1 : 1));
  }, [recurringItems, monthEntries]);

  if (alerts.length === 0) return null;

  return (
    <div className="priority-banner">
      {alerts.map(({ item, status }) => (
        <div
          key={item.id}
          className={`priority-alert priority-alert--${status}`}
          onClick={() => navigate('/tracker/payments')}
        >
          <span className="priority-alert-icon">
            {status === 'overdue' ? '🔴' : '🟡'}
          </span>
          <div className="priority-alert-body">
            <span className="priority-alert-name">{item.name}</span>
            <span className="priority-alert-sub">
              {status === 'overdue' ? 'Overdue' : 'Due today'} · {formatCurrency(item.amount, settings.currencySymbol)}
            </span>
          </div>
          <span className="priority-alert-arrow">›</span>
        </div>
      ))}
    </div>
  );
}
