import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from './AuthContext';
import './login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string })?.from ?? '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

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
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Your personal planner and daily tracker.</p>
        {error && <p className="login-error">{error}</p>}
        <button
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
