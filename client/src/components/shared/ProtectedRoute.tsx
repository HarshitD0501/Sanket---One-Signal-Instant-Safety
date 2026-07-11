import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ReactNode } from 'react';
import { AUTH_DETACHED } from '../../config/authMode';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (AUTH_DETACHED) return <>{children}</>;
  if (loading) return <div className="flex-center" style={{ minHeight: '100vh' }}><div className="loader" /></div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
