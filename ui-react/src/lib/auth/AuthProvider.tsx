import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export interface AuthUser {
  email: string;
  username: string;
  sub: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: null,
  login: () => {},
  logout: () => {},
});

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for existing token on mount
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        // Decode JWT payload (base64)
        const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
        const exp = (payload.exp as number) * 1000;
        if (Date.now() < exp) {
          setAccessToken(token);
          setUser({
            email: payload.email ?? '',
            username: payload.preferred_username ?? payload.sub ?? '',
            sub: payload.sub ?? '',
          });
        } else {
          localStorage.removeItem('access_token');
        }
      } catch {
        localStorage.removeItem('access_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(() => {
    // OAuth2 redirect will be implemented in oauth2-adapter.ts
    // This is a placeholder for the auth flow
    console.log('Login not yet implemented');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setUser(null);
    setAccessToken(null);
  }, []);

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
