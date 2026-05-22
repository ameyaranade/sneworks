import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, optimistic } = useAuth();
  const location = useLocation();

  // Block only when Firebase hasn't responded AND there's no cached auth hint.
  if (loading && !optimistic) {
    return <div style={{ padding: 32, color: '#666' }}>Loading...</div>;
  }

  // Firebase confirmed no session (logout, expiry, or first visit).
  if (!loading && !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
