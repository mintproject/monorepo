// @vitest-environment jsdom
/**
 * Unit tests for oauth2-adapter.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthorizationUrl,
  exchangeCode,
  getAuthorizationEndpoint,
  getLogoutEndpoint,
  getTokenEndpoint,
  handleCallback,
  handleImplicitCallback,
  logout,
  refreshAccessToken,
  resolveGrantType,
} from '@/lib/auth/oauth2-adapter';
import { decodeState, encodeState } from '@/lib/auth/oauth-state';
import { clearTokens, getAccessToken, getRefreshToken } from '@/lib/auth/token-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setMintConfig(overrides: Partial<MintConfig> = {}) {
  const config: MintConfig = {
    HASURA_ENDPOINT: 'http://localhost:8080/v1/graphql',
    AUTH_SERVER: 'https://iam.example.com',
    AUTH_CLIENT_ID: 'mint-ui',
    AUTH_REALM: 'myrealm',
    AUTH_PROVIDER: 'keycloak',
    ...overrides,
  };
  window.__MINT_CONFIG__ = config;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setMintConfig();
  localStorage.clear();
  sessionStorage.clear();
  // Stub location so tests don't actually navigate
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      href: 'http://localhost/',
      origin: 'http://localhost',
      hash: '',
      search: '',
    },
  });
  // Stub crypto.getRandomValues
  Object.defineProperty(window, 'crypto', {
    writable: true,
    value: {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    },
  });
  vi.clearAllMocks();
});

afterEach(() => {
  clearTokens();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Endpoint construction
// ---------------------------------------------------------------------------

describe('endpoint construction', () => {
  it('builds Keycloak authorization endpoint', () => {
    const url = getAuthorizationEndpoint();
    expect(url).toBe('https://iam.example.com/realms/myrealm/protocol/openid-connect/auth');
  });

  it('builds Tapis authorization endpoint', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    expect(getAuthorizationEndpoint()).toBe('https://iam.example.com/v3/oauth2/authorize');
  });

  it('builds Keycloak token endpoint', () => {
    expect(getTokenEndpoint()).toBe(
      'https://iam.example.com/realms/myrealm/protocol/openid-connect/token',
    );
  });

  it('builds Tapis token endpoint', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    expect(getTokenEndpoint()).toBe('https://iam.example.com/v3/oauth2/tokens');
  });

  it('builds Keycloak logout endpoint', () => {
    expect(getLogoutEndpoint()).toBe(
      'https://iam.example.com/realms/myrealm/protocol/openid-connect/logout',
    );
  });

  it('builds Tapis logout endpoint', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    expect(getLogoutEndpoint()).toBe('https://iam.example.com/v3/oauth2/logout');
  });
});

// ---------------------------------------------------------------------------
// resolveGrantType
// ---------------------------------------------------------------------------

describe('resolveGrantType', () => {
  it('returns code for keycloak', () => {
    expect(resolveGrantType()).toBe('code');
  });

  it('returns token for tapis', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    expect(resolveGrantType()).toBe('token');
  });
});

// ---------------------------------------------------------------------------
// buildAuthorizationUrl
// ---------------------------------------------------------------------------

describe('buildAuthorizationUrl', () => {
  it('includes client_id, response_type=code, redirect_uri, scope, state for keycloak', () => {
    const url = buildAuthorizationUrl();
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('client_id')).toBe('mint-ui');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('redirect_uri')).toBe('http://localhost/oauth2/callback');
    expect(params.get('scope')).toContain('openid');
    expect(params.get('state')).toBeTruthy();
  });

  it('stores state in sessionStorage', () => {
    buildAuthorizationUrl();
    expect(sessionStorage.getItem('oauth2_state')).toBeTruthy();
  });

  it('uses response_type=token for tapis', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const url = buildAuthorizationUrl();
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('response_type')).toBe('token');
  });
});

// ---------------------------------------------------------------------------
// exchangeCode
// ---------------------------------------------------------------------------

describe('exchangeCode', () => {
  it('stores tokens after successful Keycloak code exchange', async () => {
    const keycloakResponse = {
      access_token: 'kc-access',
      expires_in: 300,
      refresh_expires_in: 1800,
      refresh_token: 'kc-refresh',
      token_type: 'Bearer',
      scope: 'openid',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(keycloakResponse),
    });

    await exchangeCode('auth-code-123');

    expect(getAccessToken()).toBe('kc-access');
    expect(getRefreshToken()).toBe('kc-refresh');
  });

  it('stores tokens after successful Tapis code exchange', async () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const tapisResponse = {
      status: 'success',
      message: 'Token created.',
      result: {
        access_token: { access_token: 'tapis-access', expires_in: 14400 },
        refresh_token: { refresh_token: 'tapis-refresh', expires_in: 86400 },
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tapisResponse),
    });

    await exchangeCode('auth-code-456');

    expect(getAccessToken()).toBe('tapis-access');
    expect(getRefreshToken()).toBe('tapis-refresh');
  });

  it('throws on HTTP error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });

    await expect(exchangeCode('bad-code')).rejects.toThrow('Token exchange failed: 400');
  });
});

// ---------------------------------------------------------------------------
// handleImplicitCallback
// ---------------------------------------------------------------------------

describe('handleImplicitCallback', () => {
  it('extracts token from URL hash fragment', () => {
    window.location.hash = '#access_token=frag-tok&expires_in=3600';
    const token = handleImplicitCallback();
    expect(token).toBe('frag-tok');
    expect(getAccessToken()).toBe('frag-tok');
  });

  it('extracts token from query string when no hash', () => {
    window.location.hash = '';
    window.location.search = '?access_token=query-tok&expires_in=3600';
    const token = handleImplicitCallback();
    expect(token).toBe('query-tok');
  });

  it('returns null when no token in URL', () => {
    window.location.hash = '';
    window.location.search = '';
    const token = handleImplicitCallback();
    expect(token).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// handleCallback
// ---------------------------------------------------------------------------

describe('handleCallback', () => {
  it('returns error when IdP sends error param', async () => {
    window.location.search = '?error=access_denied&error_description=User+cancelled';
    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toContain('User cancelled');
  });

  it('returns error on state mismatch (CSRF)', async () => {
    sessionStorage.setItem('oauth2_state', 'correct-state');
    // State must now be encoded JSON so decodeState returns a valid object;
    // the nonce inside must differ from the stored nonce to trigger CSRF rejection.
    const wrongState = encodeState({ nonce: 'wrong-state', origin: 'http://localhost' });
    window.location.search = `?code=abc&state=${wrongState}`;
    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toContain('State mismatch');
  });

  it('processes authorization code when state matches', async () => {
    sessionStorage.setItem('oauth2_state', 'good-state');
    const state = encodeState({ nonce: 'good-state', origin: 'http://localhost' });
    window.location.search = `?code=real-code&state=${state}`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'result-tok',
          expires_in: 300,
          refresh_expires_in: 1800,
          refresh_token: 'ref',
          token_type: 'Bearer',
          scope: 'openid',
        }),
    });

    const result = await handleCallback();
    expect(result.type).toBe('code');
    expect(getAccessToken()).toBe('result-tok');
  });

  it('processes implicit token from hash when no code present', async () => {
    window.location.search = '';
    window.location.hash = '#access_token=impl-tok&expires_in=3600';
    const result = await handleCallback();
    expect(result.type).toBe('token');
    expect(getAccessToken()).toBe('impl-tok');
  });

  it('returns error when no code or token in URL', async () => {
    window.location.search = '';
    window.location.hash = '';
    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toContain('No code or token');
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe('refreshAccessToken', () => {
  it('returns false when no refresh token stored', async () => {
    const result = await refreshAccessToken();
    expect(result).toBe(false);
  });

  it('returns true and stores new tokens on success', async () => {
    localStorage.setItem('mint.refresh_token', 'stored-refresh');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-access',
          expires_in: 300,
          refresh_expires_in: 1800,
          refresh_token: 'new-refresh',
          token_type: 'Bearer',
          scope: 'openid',
        }),
    });

    const result = await refreshAccessToken();
    expect(result).toBe(true);
    expect(getAccessToken()).toBe('new-access');
  });

  it('returns false on HTTP error', async () => {
    localStorage.setItem('mint.refresh_token', 'stored-refresh');
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await refreshAccessToken();
    expect(result).toBe(false);
  });

  it('returns false on fetch exception', async () => {
    localStorage.setItem('mint.refresh_token', 'stored-refresh');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await refreshAccessToken();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  it('clears tokens and redirects for Keycloak', () => {
    localStorage.setItem('mint.access_token', 'tok');
    logout();
    expect(getAccessToken()).toBeNull();
    expect(window.location.href).toContain('openid-connect/logout');
    expect(window.location.href).toContain('client_id=mint-ui');
  });

  it('clears tokens and redirects to / for Tapis', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    logout();
    expect(getAccessToken()).toBeNull();
    expect(window.location.href).toBe('/');
  });
});

describe('preview-aware authorization URL', () => {
  it('uses window.location.origin for redirect_uri when AUTH_CALLBACK_ORIGIN is unset', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const url = new URL(buildAuthorizationUrl());
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost/oauth2/callback');
  });

  it('uses AUTH_CALLBACK_ORIGIN for redirect_uri when set', () => {
    setMintConfig({
      AUTH_PROVIDER: 'tapis',
      AUTH_CALLBACK_ORIGIN: 'https://monorepo-mosoriobs-projects.vercel.app',
    });
    const url = new URL(buildAuthorizationUrl());
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://monorepo-mosoriobs-projects.vercel.app/oauth2/callback',
    );
  });

  it('encodes {nonce, origin} in state and mirrors the nonce in sessionStorage', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const url = new URL(buildAuthorizationUrl());
    const decoded = decodeState(url.searchParams.get('state'));
    expect(decoded).not.toBeNull();
    expect(decoded!.origin).toBe('http://localhost');
    expect(decoded!.nonce).toBe(sessionStorage.getItem('oauth2_state'));
  });
});

describe('handleCallback CSRF via encoded state', () => {
  it('reads implicit token + state from the fragment and stores the token', async () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    sessionStorage.setItem('oauth2_state', 'nonce-1');
    const state = encodeState({ nonce: 'nonce-1', origin: 'http://localhost' });
    window.location.hash = `#access_token=tok-abc&expires_in=3600&state=${state}`;

    const result = await handleCallback();
    expect(result.type).toBe('token');
    expect(getAccessToken()).toBe('tok-abc');
  });

  it('rejects a forged nonce in the fragment state', async () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    sessionStorage.setItem('oauth2_state', 'nonce-1');
    const state = encodeState({ nonce: 'WRONG', origin: 'http://localhost' });
    window.location.hash = `#access_token=tok-abc&state=${state}`;

    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toMatch(/CSRF/i);
  });
});

describe('auth round-trip: buildAuthorizationUrl state survives handleCallback', () => {
  it('accepts the state produced by buildAuthorizationUrl on the same origin (implicit)', async () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    // Build the authorization URL — this sets sessionStorage nonce and returns encoded state.
    const authUrl = new URL(buildAuthorizationUrl());
    const state = authUrl.searchParams.get('state')!;
    // Simulate the IdP echoing the token + state back in the fragment.
    window.location.hash = `#access_token=tok-rt&expires_in=3600&state=${state}`;

    const result = await handleCallback();
    expect(result.type).toBe('token');
    expect(getAccessToken()).toBe('tok-rt');
  });
});
