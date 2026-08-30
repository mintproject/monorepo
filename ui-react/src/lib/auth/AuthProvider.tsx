import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { authorize, logout as oauth2Logout } from './oauth2-adapter';
import {
  clearTokens,
  decodeUserFromToken,
  loadPersistedToken,
  setTokenChangeCallback,
  type JwtUser,
} from './token-store';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export type { JwtUser as AuthUser };

export interface AuthState {
  /** True when a valid access token is present. */
  isAuthenticated: boolean;
  /** True while the initial token check is in progress on mount. */
  isLoading: boolean;
  /** Decoded user information, or null when not authenticated. */
  user: JwtUser | null;
  /** Raw JWT access token, or null when not authenticated. */
  accessToken: string | null;
  /** Redirect the browser to the IdP authorization endpoint. */
  login: () => void;
  /** Clear tokens and redirect to IdP logout endpoint. */
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: null,
  login: () => {},
  logout: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Derive user from token on every token change — avoids a separate state
  const user = useMemo<JwtUser | null>(
    () => (accessToken ? (decodeUserFromToken(accessToken) ?? null) : null),
    [accessToken],
  );

  // -------------------------------------------------------------------------
  // Mount: restore persisted token
  // -------------------------------------------------------------------------
  useEffect(() => {
    const persisted = loadPersistedToken();
    setAccessToken(persisted);
    setIsLoading(false);
  }, []);

  // -------------------------------------------------------------------------
  // Subscribe to token changes from token-store (refresh, logout, etc.)
  // -------------------------------------------------------------------------
  useEffect(() => {
    setTokenChangeCallback((token) => {
      setAccessToken(token);
    });
    return () => {
      // Clear the callback on unmount (test isolation)
      setTokenChangeCallback(() => {});
    };
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const login = useCallback(() => {
    authorize();
  }, []);

  const logout = useCallback(() => {
    // Clear local state immediately before IdP redirect
    setAccessToken(null);
    clearTokens();
    oauth2Logout();
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: !!accessToken,
      isLoading,
      user,
      accessToken,
      login,
      logout,
    }),
    [accessToken, isLoading, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
