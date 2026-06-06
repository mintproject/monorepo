// @vitest-environment jsdom
/**
 * Unit tests for token-store.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTokens,
  decodeJwtPayload,
  decodeUserFromToken,
  getAccessExpiresAt,
  getAccessToken,
  getRefreshExpiresAt,
  getRefreshToken,
  isTokenValid,
  loadPersistedToken,
  setRefreshCallback,
  setTokenChangeCallback,
  storeTokens,
} from '@/lib/auth/token-store';

// Minimal valid JWT with payload { sub: 'u1', email: 'a@b.com', preferred_username: 'alice' }
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '');
  return `${header}.${body}.fakesig`;
}

describe('token-store', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearTokens();
    setTokenChangeCallback(() => {});
    setRefreshCallback(() => Promise.resolve(false));
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // storeTokens / getAccessToken / getRefreshToken
  // -------------------------------------------------------------------------

  describe('storeTokens', () => {
    it('stores access token', () => {
      storeTokens({ accessToken: 'tok123' });
      expect(getAccessToken()).toBe('tok123');
    });

    it('stores refresh token when provided', () => {
      storeTokens({ accessToken: 'tok', refreshToken: 'ref' });
      expect(getRefreshToken()).toBe('ref');
    });

    it('stores expiry timestamps when accessExpiresIn provided', () => {
      storeTokens({ accessToken: 'tok', accessExpiresIn: 3600 });
      const exp = getAccessExpiresAt();
      expect(exp).not.toBeNull();
      // Should be roughly now + 3600s
      const diff = exp!.getTime() - Date.now();
      expect(diff).toBeGreaterThan(3590_000);
      expect(diff).toBeLessThan(3610_000);
    });

    it('stores refresh expiry when refreshExpiresIn provided', () => {
      storeTokens({ accessToken: 'tok', refreshExpiresIn: 7200 });
      const exp = getRefreshExpiresAt();
      expect(exp).not.toBeNull();
    });

    it('notifies token change callback on store', () => {
      const cb = vi.fn();
      setTokenChangeCallback(cb);
      storeTokens({ accessToken: 'new-tok' });
      expect(cb).toHaveBeenCalledWith('new-tok');
    });
  });

  // -------------------------------------------------------------------------
  // clearTokens
  // -------------------------------------------------------------------------

  describe('clearTokens', () => {
    it('removes all token keys from localStorage', () => {
      storeTokens({ accessToken: 'tok', refreshToken: 'ref', accessExpiresIn: 300 });
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(getAccessExpiresAt()).toBeNull();
    });

    it('notifies token change callback with null', () => {
      const cb = vi.fn();
      storeTokens({ accessToken: 'tok' });
      setTokenChangeCallback(cb);
      clearTokens();
      expect(cb).toHaveBeenCalledWith(null);
    });
  });

  // -------------------------------------------------------------------------
  // decodeJwtPayload
  // -------------------------------------------------------------------------

  describe('decodeJwtPayload', () => {
    it('decodes a valid JWT payload', () => {
      const token = makeJwt({ sub: 'u1', email: 'a@b.com' });
      const payload = decodeJwtPayload(token);
      expect(payload).toMatchObject({ sub: 'u1', email: 'a@b.com' });
    });

    it('returns null for a non-JWT string', () => {
      expect(decodeJwtPayload('not.a.jwt.at.all')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(decodeJwtPayload('')).toBeNull();
    });

    it('returns null for a malformed base64 payload', () => {
      expect(decodeJwtPayload('hdr.!!bad!!.sig')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // decodeUserFromToken
  // -------------------------------------------------------------------------

  describe('decodeUserFromToken', () => {
    it('extracts sub, email, and preferred_username (Keycloak)', () => {
      const token = makeJwt({ sub: 'u1', email: 'alice@test.com', preferred_username: 'alice' });
      const user = decodeUserFromToken(token);
      expect(user).toEqual({ sub: 'u1', email: 'alice@test.com', username: 'alice' });
    });

    it('extracts username from tapis/username claim', () => {
      const token = makeJwt({ sub: 'u2', 'tapis/username': 'tapis-user' });
      const user = decodeUserFromToken(token);
      expect(user).not.toBeNull();
      expect(user!.username).toBe('tapis-user');
    });

    it('falls back to sub when no username claim present', () => {
      const token = makeJwt({ sub: 'user-id' });
      const user = decodeUserFromToken(token);
      expect(user!.username).toBe('user-id');
    });

    it('returns null for invalid token', () => {
      expect(decodeUserFromToken('invalid')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isTokenValid
  // -------------------------------------------------------------------------

  describe('isTokenValid', () => {
    it('returns false when no token stored', () => {
      expect(isTokenValid()).toBe(false);
    });

    it('returns true when token is present with no expiry info', () => {
      storeTokens({ accessToken: 'tok' });
      expect(isTokenValid()).toBe(true);
    });

    it('returns true when token has not expired', () => {
      storeTokens({ accessToken: 'tok', accessExpiresIn: 3600 });
      expect(isTokenValid()).toBe(true);
    });

    it('returns true when access expired but refresh token still valid', () => {
      // Store with access expiring immediately
      storeTokens({
        accessToken: 'tok',
        accessExpiresIn: -1,
        refreshToken: 'ref',
        refreshExpiresIn: 3600,
      });
      // Access is expired, refresh is valid
      expect(isTokenValid()).toBe(true);
    });

    it('clears tokens and returns false when both tokens expired', () => {
      storeTokens({
        accessToken: 'tok',
        accessExpiresIn: -1,
        refreshToken: 'ref',
        refreshExpiresIn: -1,
      });
      expect(isTokenValid()).toBe(false);
      expect(getAccessToken()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // scheduleRefresh
  // -------------------------------------------------------------------------

  describe('scheduleRefresh', () => {
    it('calls refresh callback 60s before expiry', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(true);
      setRefreshCallback(mockRefresh);

      // Store token expiring in 120 seconds — refresh should fire in 60s
      storeTokens({ accessToken: 'tok', accessExpiresIn: 120 });

      // Advance to 59 seconds — should not fire yet
      vi.advanceTimersByTime(59_000);
      expect(mockRefresh).not.toHaveBeenCalled();

      // Advance to 61 seconds — should fire now
      vi.advanceTimersByTime(2_000);
      await vi.runAllTimersAsync();
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('fires immediately when token already close to expiry', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(true);
      setRefreshCallback(mockRefresh);

      // Token expiring in 30s — already within 60s window, delay=0
      storeTokens({ accessToken: 'tok', accessExpiresIn: 30 });
      await vi.runAllTimersAsync();
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not schedule when no expiry stored', () => {
      const mockRefresh = vi.fn().mockResolvedValue(true);
      setRefreshCallback(mockRefresh);

      storeTokens({ accessToken: 'tok' }); // no expiry
      vi.advanceTimersByTime(999_999);
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // loadPersistedToken
  // -------------------------------------------------------------------------

  describe('loadPersistedToken', () => {
    it('returns access token when valid', () => {
      storeTokens({ accessToken: 'persisted', accessExpiresIn: 3600 });
      expect(loadPersistedToken()).toBe('persisted');
    });

    it('returns null when no valid token stored', () => {
      expect(loadPersistedToken()).toBeNull();
    });

    it('returns null when token expired', () => {
      storeTokens({ accessToken: 'expired', accessExpiresIn: -1 });
      expect(loadPersistedToken()).toBeNull();
    });
  });
});
