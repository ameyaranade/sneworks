import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from './AuthContext';
import { resolveTheme, getStoredThemeMode, onSystemThemeChange } from '../theme';
import previewToday from './previews/preview-today.png';
import previewRoutines from './previews/preview-routines.png';
import previewHealth from './previews/preview-health.png';
import '../styles/app-tokens.css';
import './login.css';

function getInitialTheme(): 'dark' | 'light' {
  return resolveTheme(getStoredThemeMode());
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  const from = (location.state as { from?: string })?.from ?? '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  // Re-resolve theme on OS change (when in 'system' mode) or if the stored
  // mode changes in another tab.
  useEffect(() => {
    const handler = () => setTheme(getInitialTheme());
    window.addEventListener('storage', handler);
    const unsubSystem = onSystemThemeChange(handler);
    return () => {
      window.removeEventListener('storage', handler);
      unsubSystem();
    };
  }, []);

  if (user) return null;

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate(from, { replace: true });
    } catch (e: unknown) {
      setError('Sign-in failed. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root" data-theme={theme}>
      <div className="login-content">
        <header className="login-head">
          <div className="login-glyph" aria-hidden="true">◆</div>
          <h1 className="login-title">Planner</h1>
          <p className="login-subtitle">Your daily planner — tasks, routines, and notes in one place.</p>
        </header>

        {/* Fanned app preview — real screenshots of the app */}
        <div className="login-preview" aria-hidden="true">
          <div className="login-phone login-phone--left">
            <img src={previewRoutines} alt="" loading="lazy" />
          </div>
          <div className="login-phone login-phone--right">
            <img src={previewHealth} alt="" loading="lazy" />
          </div>
          <div className="login-phone login-phone--center">
            <img src={previewToday} alt="" loading="lazy" />
          </div>
        </div>

        <footer className="login-foot">
          {error && <p className="login-error">{error}</p>}
          <button
            className="login-btn-google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </footer>
      </div>
    </div>
  );
}
