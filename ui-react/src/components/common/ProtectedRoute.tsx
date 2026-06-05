import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../lib/auth/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wraps a route to require authentication.
 *
 * - While the auth state is being loaded (initial localStorage check), renders a spinner.
 * - When the user is not authenticated, redirects to /login and stores the attempted
 *   location in state so the login flow can redirect back after success.
 * - When authenticated, renders children normally.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Trigger OAuth2 redirect and show a transitional state.
    // Using a Navigate to a dedicated login-required page lets us avoid
    // a redirect loop — the login-required page calls login() from useAuth().
    return (
      <Navigate
        to="/login-required"
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// LoginRequiredPage — rendered when an unauthenticated user hits a protected route
// ---------------------------------------------------------------------------

/**
 * Prompts the user to sign in and immediately initiates the OAuth2 redirect.
 * This page is only shown momentarily before the IdP redirect fires.
 */
export function LoginRequiredPage() {
  const { login } = useAuth();

  // Auto-initiate login on mount — useEffect so it runs once after mount.
  useEffect(() => {
    login();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div
          className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent mx-auto"
          aria-label="Loading"
          role="status"
        />
        <p className="text-sm text-muted-foreground">Redirecting to sign-in...</p>
      </div>
    </div>
  );
}
