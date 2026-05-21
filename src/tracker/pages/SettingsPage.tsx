import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { useTracker } from '../context/TrackerProvider';
import { updateSettings } from '../firebase/trackerQueries';
import { CURRENCY_OPTIONS } from '../constants';
import type { Currency } from '../types';
import './settings-page.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { settings } = useTracker();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handleCurrencyChange = (currency: Currency) => {
    const symbol = CURRENCY_OPTIONS.find((c) => c.value === currency)?.symbol ?? '₹';
    updateSettings(user.uid, { currency, currencySymbol: symbol }).catch((e) =>
      console.error('Update currency failed:', e),
    );
  };

  const handleDarkMode = () => {
    updateSettings(user.uid, { darkMode: !settings.darkMode }).catch((e) =>
      console.error('Update dark mode failed:', e),
    );
  };

  return (
    <div className="settings-page">
      <h2 className="page-title">Settings</h2>

      <div className="settings-section">
        <h3 className="settings-section-title">Currency</h3>
        <div className="settings-options">
          {CURRENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`settings-option ${settings.currency === opt.value ? 'active' : ''}`}
              onClick={() => handleCurrencyChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Appearance</h3>
        <label className="settings-toggle">
          <span>Dark mode</span>
          <input
            type="checkbox"
            checked={settings.darkMode}
            onChange={handleDarkMode}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Notifications</h3>
        <label className="settings-toggle disabled">
          <span>Push notifications</span>
          <input type="checkbox" disabled checked={false} />
          <span className="toggle-slider" />
        </label>
        <p className="settings-hint">Coming soon</p>
      </div>

      <div className="settings-section settings-account">
        <h3 className="settings-section-title">Account</h3>
        <p className="settings-user-email">{user.displayName ?? user.email}</p>
        <button className="btn-logout" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}
