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
} from '../lib/auth/oauth2-adapter';
import { clearTokens, getAccessToken, getRefreshToken } from '../lib/auth/token-store';

// ---------------------------------------------------------------------------
// Mock window.__MINT_CONFIG__
// ---------------------------------------------------------------------------

function setConfig(overrides: Partial<Window['__MINT_CONFIG__']>) {
  Object.defineProperty(window, '__MINT_CONFIG__', {
    value: {
      HASURA_ENDPOINT: 'http://localhost:8080/v1/graphql',
      AUTH_SERVER: 'https://iam.example.com',
      AUTH_CLIENT_ID: 'mint-ui',
      AUTH_REALM: 'production',
      AUTH_PROVIDER: 'keycloak',
      ...overrides,
    } satisfies Window['__MINT_CONFIG__'],
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  setConfig({});

  // Default location mock
  Object.defineProperty(window, 'location', {
    value: {
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/',
      search: '',
      hash: '',
      assign: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  clearTokens();
});

// ---------------------------------------------------------------------------
// Endpoint construction
// ---------------------------------------------------------------------------

describe('getAuthorizationEndpoint', () => {
  it('returns keycloak auth endpoint', () => {
    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod' });
    expect(getAuthorizationEndpoint()).toBe(
      'https://iam.example.com/realms/prod/protocol/openid-connect/auth',
    );
  });

  it('returns tapis auth endpoint', () => {
    setConfig({ AUTH_PROVIDER: 'tapis', AUTH_SERVER: 'https://api.tapis.io' });
    expect(getAuthorizationEndpoint()).toBe('https://api.tapis.io/v3/oauth2/authorize');
  });
});

describe('getTokenEndpoint', () => {
  it('returns keycloak token endpoint', () => {
    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod' });
    expect(getTokenEndpoint()).toBe(
      'https://iam.example.com/realms/prod/protocol/openid-connect/token',
    );
  });

  it('returns tapis token endpoint', () => {
    setConfig({ AUTH_PROVIDER: 'tapis', AUTH_SERVER: 'https://api.tapis.io' });
    expect(getTokenEndpoint()).toBe('https://api.tapis.io/v3/oauth2/tokens');
  });
});

describe('getLogoutEndpoint', () => {
  it('returns keycloak logout endpoint', () => {
    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod' });
    expect(getLogoutEndpoint()).toBe(
      'https://iam.example.com/realms/prod/protocol/openid-connect/logout',
    );
  });
});

// ---------------------------------------------------------------------------
// resolveGrantType
// ---------------------------------------------------------------------------

describe('resolveGrantType', () => {
  it('returns "code" for keycloak', () => {
    setConfig({ AUTH_PROVIDER: 'keycloak' });
    expect(resolveGrantType()).toBe('code');
  });

  it('returns "token" for tapis', () => {
    setConfig({ AUTH_PROVIDER: 'tapis' });
    expect(resolveGrantType()).toBe('token');
  });
});

// ---------------------------------------------------------------------------
// buildAuthorizationUrl
// ---------------------------------------------------------------------------

describe('buildAuthorizationUrl', () => {
  it('includes client_id, response_type, redirect_uri, scope, and state', () => {
    setConfig({ AUTH_CLIENT_ID: 'mint-ui', AUTH_PROVIDER: 'keycloak' });
    const url = buildAuthorizationUrl('code');
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('client_id')).toBe('mint-ui');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('redirect_uri')).toBe('http://localhost:3000/oauth2/callback');
    expect(params.get('scope')).toBe('openid profile email');
    expect(params.get('state')).toBeTruthy();
  });

  it('stores state in sessionStorage', () => {
    buildAuthorizationUrl('code');
    expect(sessionStorage.getItem('oauth2_state')).toBeTruthy();
  });

  it('uses implicit grant type for tapis', () => {
    setConfig({ AUTH_PROVIDER: 'tapis' });
    const url = buildAuthorizationUrl();
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('response_type')).toBe('token');
  });
});

// ---------------------------------------------------------------------------
// handleImplicitCallback
// ---------------------------------------------------------------------------

describe('handleImplicitCallback', () => {
  it('reads access_token from URL hash fragment', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hash: '#access_token=implicit-tok&expires_in=3600' },
      writable: true, configurable: true,
    });
    const token = handleImplicitCallback();
    expect(token).toBe('implicit-tok');
    expect(getAccessToken()).toBe('implicit-tok');
  });

  it('reads access_token from query string as fallback', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?access_token=query-tok&expires_in=1800', hash: '' },
      writable: true, configurable: true,
    });
    const token = handleImplicitCallback();
    expect(token).toBe('query-tok');
    expect(getAccessToken()).toBe('query-tok');
  });

  it('returns null when no token in URL', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '', hash: '' },
      writable: true, configurable: true,
    });
    expect(handleImplicitCallback()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// exchangeCode (Keycloak)
// ---------------------------------------------------------------------------

describe('exchangeCode — keycloak', () => {
  it('stores tokens on successful code exchange', async () => {
    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod', AUTH_CLIENT_ID: 'mint-ui' });

    const mockResponse = {
      access_token: 'kc-access',
      expires_in: 300,
      refresh_expires_in: 1800,
      refresh_token: 'kc-refresh',
      token_type: 'Bearer',
      scope: 'openid',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    await exchangeCode('auth-code-123');

    expect(getAccessToken()).toBe('kc-access');
    expect(getRefreshToken()).toBe('kc-refresh');
  });

  it('throws on non-OK response', async () => {
    setConfig({ AUTH_PROVIDER: 'keycloak' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });

    await expect(exchangeCode('bad-code')).rejects.toThrow('400');
  });
});

// ---------------------------------------------------------------------------
// exchangeCode (Tapis)
// ---------------------------------------------------------------------------

describe('exchangeCode — tapis', () => {
  it('stores tokens from tapis response envelope', async () => {
    setConfig({ AUTH_PROVIDER: 'tapis', AUTH_SERVER: 'https://api.tapis.io' });

    const mockResponse = {
      status: 'success',
      message: 'ok',
      result: {
        access_token: { access_token: 'tapis-access', expires_in: 600 },
        refresh_token: { refresh_token: 'tapis-refresh', expires_in: 3600 },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    await exchangeCode('tapis-code');

    expect(getAccessToken()).toBe('tapis-access');
    expect(getRefreshToken()).toBe('tapis-refresh');
  });
});

// ---------------------------------------------------------------------------
// handleCallback
// ---------------------------------------------------------------------------

describe('handleCallback', () => {
  it('returns error when error param is present', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?error=access_denied&error_description=User+denied+access',
        hash: '',
      },
      writable: true, configurable: true,
    });

    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toContain('User denied access');
  });

  it('returns error on state mismatch', async () => {
    sessionStorage.setItem('oauth2_state', 'expected-state');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?code=abc&state=other-state', hash: '' },
      writable: true, configurable: true,
    });

    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toContain('State mismatch');
  });

  it('exchanges code when code param is present and state matches', async () => {
    const state = 'valid-state-123';
    sessionStorage.setItem('oauth2_state', state);

    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: `?code=mycode&state=${state}`, hash: '' },
      writable: true, configurable: true,
    });

    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'fresh-token',
        expires_in: 300,
        refresh_expires_in: 1800,
        refresh_token: 'fresh-refresh',
        token_type: 'Bearer',
        scope: 'openid',
      }),
    });

    const result = await handleCallback();
    expect(result.type).toBe('code');
    expect(getAccessToken()).toBe('fresh-token');
    // State should be cleared from sessionStorage after use
    expect(sessionStorage.getItem('oauth2_state')).toBeNull();
  });

  it('handles implicit token in fragment', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '', hash: '#access_token=frag-tok&expires_in=3600' },
      writable: true, configurable: true,
    });

    const result = await handleCallback();
    expect(result.type).toBe('token');
    expect(getAccessToken()).toBe('frag-tok');
  });

  it('returns error when neither code nor token is present', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '', hash: '' },
      writable: true, configurable: true,
    });

    const result = await handleCallback();
    expect(result.type).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe('refreshAccessToken', () => {
  it('returns false when no refresh token is stored', async () => {
    expect(await refreshAccessToken()).toBe(false);
  });

  it('returns true and updates token on success', async () => {
    localStorage.setItem('mint.refresh_token', 'old-refresh');
    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
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

  it('returns false on network error', async () => {
    localStorage.setItem('mint.refresh_token', 'ref');
    setConfig({ AUTH_PROVIDER: 'keycloak' });
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    expect(await refreshAccessToken()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  it('clears tokens and redirects for keycloak', () => {
    setConfig({ AUTH_PROVIDER: 'keycloak', AUTH_CLIENT_ID: 'mint-ui', AUTH_SERVER: 'https://iam.example.com', AUTH_REALM: 'prod' });
    localStorage.setItem('mint.access_token', 'tok');

    const locationSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      get: () => ({ origin: 'http://localhost:3000', href: '' }),
      set: locationSetter,
      configurable: true,
    });

    logout();

    expect(getAccessToken()).toBeNull();
  });

  it('clears tokens for tapis without redirect', () => {
    setConfig({ AUTH_PROVIDER: 'tapis' });
    localStorage.setItem('mint.access_token', 'tok');

    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    // Spy on location.href setter
    let hrefValue = '/';
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
        get href() { return hrefValue; },
        set href(v: string) { hrefValue = v; },
      },
      writable: true, configurable: true,
    });

    logout();

    expect(getAccessToken()).toBeNull();
    expect(hrefValue).toBe('/');
  });
});
