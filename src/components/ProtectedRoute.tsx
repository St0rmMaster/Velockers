import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import type { UserRole } from '../types/database';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: UserRole;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  logger.debug('protected-route', { requireRole, loading, hasUser: !!user, role });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    logger.warn('protected-route', { event: 'redirect-login' });
    return <Navigate to="/login" replace />;
  }

  if (requireRole && role !== requireRole) {
    logger.warn('protected-route', { event: 'role-mismatch', requireRole, role });
    return (
      <div className="error">
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <p>Required role: {requireRole}, Your role: {role || 'none'}</p>
      </div>
    );
  }

  return <>{children}</>;
}

