import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from '../context/TrackerProvider';
import { computeDueStatus, formatCurrency } from '../utils';
import type { FinanceReminder, PaymentActivity } from '../types';
import './priority-banner.css';

export default function PriorityBanner() {
  const { reminders, monthActivities, settings } = useTracker();
  const navigate = useNavigate();

  const financeReminders = reminders.filter((r): r is FinanceReminder => r.type === 'finance');
  const paymentActivities = monthActivities.filter((a): a is PaymentActivity => a.type === 'payment');

  const alerts = useMemo(() => {
    return financeReminders
      .map((item) => ({ item, status: computeDueStatus(item, paymentActivities) }))
      .filter(({ status }) => status === 'overdue' || status === 'due-today')
      .sort((a, b) => (a.status === 'overdue' ? -1 : 1));
  }, [financeReminders, paymentActivities]);

  if (alerts.length === 0) return null;

  return (
    <div className="priority-banner">
      {alerts.map(({ item, status }) => (
        <div
          key={item.id}
          className={`priority-alert priority-alert--${status}`}
          onClick={() => navigate('/tracker/finances')}
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
