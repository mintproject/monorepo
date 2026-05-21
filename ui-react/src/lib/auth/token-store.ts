/**
 * Token storage and lifecycle management for OAuth2 tokens.
 * Uses localStorage for persistence across page reloads.
 * Schedules automatic refresh 60 seconds before access token expiration.
 */

const ACCESS_TOKEN_KEY = 'mint.access_token';
const REFRESH_TOKEN_KEY = 'mint.refresh_token';
const ACCESS_EXPIRES_AT_KEY = 'mint.access_expires_at';
const REFRESH_EXPIRES_AT_KEY = 'mint.refresh_expires_at';

/** Decoded JWT user information */
export interface JwtUser {
  sub: string;
  email: string;
  username: string;
}

/** Callback invoked when the access token changes (refresh, logout) */
export type TokenChangeCallback = (token: string | null) => void;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let onTokenChange: TokenChangeCallback | null = null;

/** Register a callback that fires whenever the stored access token changes. */
export function setTokenChangeCallback(cb: TokenChangeCallback): void {
  onTokenChange = cb;
}

function notifyTokenChange(token: string | null): void {
  if (onTokenChange) onTokenChange(token);
}

// ---------------------------------------------------------------------------
// Raw storage helpers
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getAccessExpiresAt(): Date | null {
  const v = localStorage.getItem(ACCESS_EXPIRES_AT_KEY);
  return v ? new Date(v) : null;
}

export function getRefreshExpiresAt(): Date | null {
  const v = localStorage.getItem(REFRESH_EXPIRES_AT_KEY);
  return v ? new Date(v) : null;
}

// ---------------------------------------------------------------------------
// Token write / clear
// ---------------------------------------------------------------------------

export interface TokenPayload {
  accessToken: string;
  /** seconds until access token expires */
  accessExpiresIn?: number;
  refreshToken?: string;
  /** seconds until refresh token expires */
  refreshExpiresIn?: number;
}

export function storeTokens(payload: TokenPayload): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);

  if (payload.accessExpiresIn !== undefined) {
    const expiresAt = new Date(Date.now() + payload.accessExpiresIn * 1000);
    localStorage.setItem(ACCESS_EXPIRES_AT_KEY, expiresAt.toISOString());
  }

  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }

  if (payload.refreshExpiresIn !== undefined) {
    const expiresAt = new Date(Date.now() + payload.refreshExpiresIn * 1000);
    localStorage.setItem(REFRESH_EXPIRES_AT_KEY, expiresAt.toISOString());
  }

  notifyTokenChange(payload.accessToken);
  scheduleRefresh();
}

export function clearTokens(): void {
  cancelRefresh();
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_EXPIRES_AT_KEY);
  notifyTokenChange(null);
}

// ---------------------------------------------------------------------------
// JWT decoding (client-side, no signature verification)
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without verifying the signature.
 * Returns null on any parse error.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    // Pad base64url to standard base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract user information from a JWT access token.
 * Returns null if the token cannot be decoded.
 */
export function decodeUserFromToken(token: string): JwtUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email =
    typeof payload.email === 'string'
      ? payload.email
      : typeof payload.sub === 'string'
        ? payload.sub
        : '';
  // Keycloak uses preferred_username; Tapis uses tapis/username or name
  const username =
    typeof payload.preferred_username === 'string'
      ? payload.preferred_username
      : typeof payload['tapis/username'] === 'string'
        ? (payload['tapis/username'] as string)
        : typeof payload.name === 'string'
          ? payload.name
          : sub;

  return { sub, email, username };
}

// ---------------------------------------------------------------------------
// Token validity
// ---------------------------------------------------------------------------

/**
 * Returns true when the stored access token exists and has not yet expired.
 * If the access token is expired but a valid refresh token exists, also returns true
 * (caller should trigger refresh before making API calls).
 */
export function isTokenValid(): boolean {
  const accessToken = getAccessToken();
  if (!accessToken) return false;

  const now = Date.now();
  const accessExpires = getAccessExpiresAt();

  if (!accessExpires) {
    // No expiry info stored — optimistically treat as valid
    return true;
  }

  if (accessExpires.getTime() > now) {
    return true;
  }

  // Access token expired — check if refresh token is still valid
  const refreshToken = getRefreshToken();
  const refreshExpires = getRefreshExpiresAt();
  if (refreshToken && refreshExpires && refreshExpires.getTime() > now) {
    return true;
  }

  // Both expired — clear and report invalid
  clearTokens();
  return false;
}

// ---------------------------------------------------------------------------
// Auto-refresh scheduling
// ---------------------------------------------------------------------------

/** Callback invoked when it is time to refresh the token. Set by oauth2-adapter. */
export type RefreshCallback = () => Promise<boolean>;
let onRefreshNeeded: RefreshCallback | null = null;

export function setRefreshCallback(cb: RefreshCallback): void {
  onRefreshNeeded = cb;
}

function cancelRefresh(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Schedule token refresh to fire 60 seconds before the access token expires.
 * If the token already expires in <60 seconds, fires immediately.
 */
export function scheduleRefresh(): void {
  cancelRefresh();

  const accessExpires = getAccessExpiresAt();
  if (!accessExpires) return;

  const delay = Math.max(0, accessExpires.getTime() - Date.now() - 60_000);

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (onRefreshNeeded) {
      onRefreshNeeded().catch(() => {
        // Refresh failed — clear tokens so user is prompted to log in again
        clearTokens();
      });
    }
  }, delay);
}

/**
 * Load the persisted token state on app startup.
 * Returns the access token if still valid, null otherwise.
 * Schedules auto-refresh if a valid token is found.
 */
export function loadPersistedToken(): string | null {
  if (!isTokenValid()) return null;
  const token = getAccessToken();
  if (token) scheduleRefresh();
  return token;
}
