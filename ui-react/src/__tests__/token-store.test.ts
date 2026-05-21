import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTokens,
  decodeJwtPayload,
  decodeUserFromToken,
  getAccessExpiresAt,
  getAccessToken,
  getRefreshToken,
  isTokenValid,
  loadPersistedToken,
  scheduleRefresh,
  setRefreshCallback,
  setTokenChangeCallback,
  storeTokens,
} from '../lib/auth/token-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal JWT with the given payload and optional expiry (seconds from now). */
function makeJwt(payload: Record<string, unknown>, expiresInSeconds?: number): string {
  const finalPayload = expiresInSeconds !== undefined
    ? { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }
    : payload;
  const encode = (v: unknown) =>
    btoa(JSON.stringify(v)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(finalPayload)}.sig`;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  setTokenChangeCallback(null as unknown as (t: string | null) => void);
  setRefreshCallback(null as unknown as () => Promise<boolean>);
  vi.useFakeTimers();
});

afterEach(() => {
  clearTokens();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// decodeJwtPayload
// ---------------------------------------------------------------------------

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT', () => {
    const jwt = makeJwt({ sub: 'user-1', email: 'a@b.com' });
    const payload = decodeJwtPayload(jwt);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.email).toBe('a@b.com');
  });

  it('returns null for a non-JWT string', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('returns null when payload segment is invalid base64', () => {
    expect(decodeJwtPayload('header.!!!.sig')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// decodeUserFromToken
// ---------------------------------------------------------------------------

describe('decodeUserFromToken', () => {
  it('extracts keycloak user fields', () => {
    const jwt = makeJwt({ sub: 'u1', email: 'user@example.com', preferred_username: 'jdoe' });
    const user = decodeUserFromToken(jwt);
    expect(user).toEqual({ sub: 'u1', email: 'user@example.com', username: 'jdoe' });
  });

  it('falls back to sub for email when email is absent', () => {
    const jwt = makeJwt({ sub: 'u1', preferred_username: 'jdoe' });
    const user = decodeUserFromToken(jwt);
    expect(user?.email).toBe('u1');
  });

  it('uses tapis/username when preferred_username is absent', () => {
    const jwt = makeJwt({ sub: 'u1', 'tapis/username': 'tapuser', email: 'a@b.com' });
    const user = decodeUserFromToken(jwt);
    expect(user?.username).toBe('tapuser');
  });

  it('returns null for an invalid token', () => {
    expect(decodeUserFromToken('garbage')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// storeTokens / getAccessToken / getRefreshToken
// ---------------------------------------------------------------------------

describe('storeTokens', () => {
  it('persists access token to localStorage', () => {
    storeTokens({ accessToken: 'tok-abc' });
    expect(getAccessToken()).toBe('tok-abc');
  });

  it('persists refresh token when provided', () => {
    storeTokens({ accessToken: 'tok-abc', refreshToken: 'ref-xyz' });
    expect(getRefreshToken()).toBe('ref-xyz');
  });

  it('stores access expiry when expiresIn is provided', () => {
    storeTokens({ accessToken: 'tok', accessExpiresIn: 3600 });
    const exp = getAccessExpiresAt();
    expect(exp).not.toBeNull();
    // Should be approximately now + 3600s
    const diff = (exp!.getTime() - Date.now()) / 1000;
    expect(diff).toBeGreaterThan(3595);
    expect(diff).toBeLessThanOrEqual(3600);
  });

  it('fires the token-change callback', () => {
    const cb = vi.fn();
    setTokenChangeCallback(cb);
    storeTokens({ accessToken: 'my-token' });
    expect(cb).toHaveBeenCalledWith('my-token');
  });
});

// ---------------------------------------------------------------------------
// clearTokens
// ---------------------------------------------------------------------------

describe('clearTokens', () => {
  it('removes all token keys from localStorage', () => {
    storeTokens({ accessToken: 'tok', refreshToken: 'ref', accessExpiresIn: 600 });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getAccessExpiresAt()).toBeNull();
  });

  it('fires the token-change callback with null', () => {
    storeTokens({ accessToken: 'tok' });
    const cb = vi.fn();
    setTokenChangeCallback(cb);
    clearTokens();
    expect(cb).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// isTokenValid
// ---------------------------------------------------------------------------

describe('isTokenValid', () => {
  it('returns false when no token is stored', () => {
    expect(isTokenValid()).toBe(false);
  });

  it('returns true for a token with no expiry info', () => {
    storeTokens({ accessToken: 'tok' });
    expect(isTokenValid()).toBe(true);
  });

  it('returns true for a token with a future expiry', () => {
    storeTokens({ accessToken: 'tok', accessExpiresIn: 3600 });
    expect(isTokenValid()).toBe(true);
  });

  it('returns false for an expired access token with no refresh token', () => {
    storeTokens({ accessToken: 'tok', accessExpiresIn: -1 });
    expect(isTokenValid()).toBe(false);
  });

  it('returns true for an expired access token when refresh token is still valid', () => {
    storeTokens({
      accessToken: 'tok',
      accessExpiresIn: -1,
      refreshToken: 'ref',
      refreshExpiresIn: 3600,
    });
    expect(isTokenValid()).toBe(true);
  });

  it('returns false when both access and refresh tokens are expired', () => {
    storeTokens({
      accessToken: 'tok',
      accessExpiresIn: -1,
      refreshToken: 'ref',
      refreshExpiresIn: -1,
    });
    expect(isTokenValid()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadPersistedToken
// ---------------------------------------------------------------------------

describe('loadPersistedToken', () => {
  it('returns null when no token in storage', () => {
    expect(loadPersistedToken()).toBeNull();
  });

  it('returns the stored token when valid', () => {
    storeTokens({ accessToken: 'tok', accessExpiresIn: 3600 });
    expect(loadPersistedToken()).toBe('tok');
  });

  it('returns null for an expired token', () => {
    storeTokens({ accessToken: 'tok', accessExpiresIn: -1 });
    expect(loadPersistedToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scheduleRefresh
// ---------------------------------------------------------------------------

describe('scheduleRefresh', () => {
  it('fires the refresh callback 60 seconds before expiry', () => {
    const refreshCb = vi.fn().mockResolvedValue(true);
    setRefreshCallback(refreshCb);

    storeTokens({ accessToken: 'tok', accessExpiresIn: 120 }); // expires in 2 min

    // Fast-forward to 60s before expiry (i.e., 60s)
    vi.advanceTimersByTime(60_000);
    expect(refreshCb).toHaveBeenCalledTimes(1);
  });

  it('fires immediately when token expires in less than 60 seconds', () => {
    const refreshCb = vi.fn().mockResolvedValue(true);
    setRefreshCallback(refreshCb);

    storeTokens({ accessToken: 'tok', accessExpiresIn: 30 });

    vi.advanceTimersByTime(0); // immediate
    expect(refreshCb).toHaveBeenCalledTimes(1);
  });

  it('does not fire before the scheduled time', () => {
    const refreshCb = vi.fn().mockResolvedValue(true);
    setRefreshCallback(refreshCb);

    storeTokens({ accessToken: 'tok', accessExpiresIn: 300 }); // 5 min

    vi.advanceTimersByTime(100_000); // 100s in — should not have fired yet (fires at 240s)
    expect(refreshCb).not.toHaveBeenCalled();
  });

  it('cancels a pending refresh when clearTokens is called', () => {
    const refreshCb = vi.fn().mockResolvedValue(true);
    setRefreshCallback(refreshCb);

    storeTokens({ accessToken: 'tok', accessExpiresIn: 120 });
    clearTokens();

    vi.advanceTimersByTime(120_000);
    expect(refreshCb).not.toHaveBeenCalled();
  });

  it('can be called manually to reschedule', () => {
    const refreshCb = vi.fn().mockResolvedValue(true);
    setRefreshCallback(refreshCb);

    storeTokens({ accessToken: 'tok', accessExpiresIn: 600 });
    scheduleRefresh();

    vi.advanceTimersByTime(540_001);
    expect(refreshCb).toHaveBeenCalledTimes(1);
  });
});
