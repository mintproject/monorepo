/**
 * OAuth2 adapter for Keycloak and Tapis authentication.
 *
 * Supported flows:
 *   - Authorization code grant (Keycloak default, Tapis when hash secret is set)
 *   - Implicit grant / token response (Tapis fallback when no hash secret)
 *
 * Provider detection is done from window.__MINT_CONFIG__.AUTH_PROVIDER at runtime.
 */

import { clearTokens, setRefreshCallback, storeTokens } from './token-store';
import { encodeState, decodeState } from './oauth-state';
import { isAllowedOrigin } from './origin-allowlist';

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getConfig() {
  return (
    window.__MINT_CONFIG__ ?? {
      AUTH_SERVER: import.meta.env.VITE_AUTH_SERVER ?? 'https://portals.tapis.io',
      AUTH_CLIENT_ID: import.meta.env.VITE_AUTH_CLIENT_ID ?? 'mint-local',
      AUTH_REALM: import.meta.env.VITE_AUTH_REALM ?? '',
      AUTH_PROVIDER: (import.meta.env.VITE_AUTH_PROVIDER ?? 'tapis') as 'keycloak' | 'tapis',
      AUTH_CALLBACK_ORIGIN: import.meta.env.VITE_AUTH_CALLBACK_ORIGIN as string | undefined,
      AUTH_PREVIEW_ORIGIN_ALLOWLIST: import.meta.env.VITE_AUTH_PREVIEW_ORIGIN_ALLOWLIST as
        | string
        | undefined,
    }
  );
}

function getCallbackUrl(): string {
  const { AUTH_CALLBACK_ORIGIN } = getConfig();
  const base = AUTH_CALLBACK_ORIGIN ?? window.location.origin;
  return `${base}/oauth2/callback`;
}

// ---------------------------------------------------------------------------
// Provider-specific endpoint construction
// ---------------------------------------------------------------------------

/**
 * Returns the authorization endpoint URL for the configured IdP.
 *
 * Keycloak: <AUTH_SERVER>/realms/<AUTH_REALM>/protocol/openid-connect/auth
 * Tapis:    <AUTH_SERVER>/v3/oauth2/authorize
 */
export function getAuthorizationEndpoint(): string {
  const { AUTH_SERVER, AUTH_REALM, AUTH_PROVIDER } = getConfig();
  if (AUTH_PROVIDER === 'tapis') {
    return `${AUTH_SERVER}/v3/oauth2/authorize`;
  }
  return `${AUTH_SERVER}/realms/${AUTH_REALM}/protocol/openid-connect/auth`;
}

/**
 * Returns the token endpoint URL for the configured IdP.
 */
export function getTokenEndpoint(): string {
  const { AUTH_SERVER, AUTH_REALM, AUTH_PROVIDER } = getConfig();
  if (AUTH_PROVIDER === 'tapis') {
    return `${AUTH_SERVER}/v3/oauth2/tokens`;
  }
  return `${AUTH_SERVER}/realms/${AUTH_REALM}/protocol/openid-connect/token`;
}

/**
 * Returns the logout endpoint URL for the configured IdP.
 */
export function getLogoutEndpoint(): string {
  const { AUTH_SERVER, AUTH_REALM, AUTH_PROVIDER } = getConfig();
  if (AUTH_PROVIDER === 'tapis') {
    return `${AUTH_SERVER}/v3/oauth2/logout`;
  }
  return `${AUTH_SERVER}/realms/${AUTH_REALM}/protocol/openid-connect/logout`;
}

// ---------------------------------------------------------------------------
// Authorization URL construction
// ---------------------------------------------------------------------------

export type GrantType = 'code' | 'token';

/**
 * Determines the appropriate grant type based on the provider.
 * Tapis uses implicit grant ('token') when no client secret/hash is available.
 * Keycloak always uses authorization code.
 */
export function resolveGrantType(): GrantType {
  const { AUTH_PROVIDER } = getConfig();
  return AUTH_PROVIDER === 'tapis' ? 'token' : 'code';
}

/**
 * Builds the full authorization redirect URL.
 * Includes state parameter for CSRF protection.
 */
export function buildAuthorizationUrl(grantType?: GrantType): string {
  const { AUTH_CLIENT_ID } = getConfig();
  const type = grantType ?? resolveGrantType();
  const nonce = generateState();
  sessionStorage.setItem('oauth2_state', nonce);
  const state = encodeState({ nonce, origin: window.location.origin });

  const params = new URLSearchParams({
    client_id: AUTH_CLIENT_ID,
    response_type: type,
    redirect_uri: getCallbackUrl(),
    scope: 'openid profile email',
    state,
  });

  return `${getAuthorizationEndpoint()}?${params.toString()}`;
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Redirect to IdP
// ---------------------------------------------------------------------------

/**
 * Initiates the OAuth2 flow by redirecting to the authorization endpoint.
 */
export function authorize(): void {
  window.location.href = buildAuthorizationUrl();
}

// ---------------------------------------------------------------------------
// Keycloak token response shapes
// ---------------------------------------------------------------------------

interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  scope: string;
}

// ---------------------------------------------------------------------------
// Tapis token response shapes
// ---------------------------------------------------------------------------

interface TapisTokenResult {
  access_token: {
    access_token: string;
    expires_in?: number;
    expires_at?: string;
  };
  refresh_token?: {
    refresh_token: string;
    expires_in?: number;
    expires_at?: string;
  };
}

interface TapisTokenResponse {
  status: string;
  message: string;
  result: TapisTokenResult;
}

// ---------------------------------------------------------------------------
// Token exchange: authorization code → access token
// ---------------------------------------------------------------------------

/**
 * Exchanges the authorization code for an access token.
 * Provider-specific response shapes are normalised to TokenPayload.
 */
export async function exchangeCode(code: string): Promise<void> {
  const { AUTH_CLIENT_ID, AUTH_PROVIDER } = getConfig();
  const tokenUrl = getTokenEndpoint();

  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    redirect_uri: getCallbackUrl(),
    code,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Both Keycloak and Tapis public clients send client_id in the body
  body.client_id = AUTH_CLIENT_ID;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as KeycloakTokenResponse | TapisTokenResponse;

  if (AUTH_PROVIDER === 'tapis' && 'result' in data) {
    saveTapisTokenResponse(data.result);
  } else {
    saveKeycloakTokenResponse(data as KeycloakTokenResponse);
  }
}

// ---------------------------------------------------------------------------
// Implicit flow: access token in URL fragment/query
// ---------------------------------------------------------------------------

/**
 * Handles the implicit grant callback where the token arrives in the URL.
 * Accepts both hash fragment (#access_token=...) and query string parameters.
 */
export function handleImplicitCallback(): string | null {
  // Try hash fragment first (standard implicit flow)
  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const fragmentToken = hashParams.get('access_token');
  const fragmentExpiry = hashParams.get('expires_in');

  if (fragmentToken) {
    storeTokens({
      accessToken: fragmentToken,
      accessExpiresIn: fragmentExpiry ? Number(fragmentExpiry) : undefined,
    });
    return fragmentToken;
  }

  // Fall back to query string (some providers put implicit token in query)
  const queryParams = new URLSearchParams(window.location.search);
  const queryToken = queryParams.get('access_token');
  const queryExpiry = queryParams.get('expires_in');

  if (queryToken) {
    storeTokens({
      accessToken: queryToken,
      accessExpiresIn: queryExpiry ? Number(queryExpiry) : undefined,
    });
    return queryToken;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Callback handler (dispatches by grant type detected in URL)
// ---------------------------------------------------------------------------

export interface CallbackResult {
  type: 'code' | 'token' | 'error';
  error?: string;
}

/** Reads the raw `state` value from the URL fragment (implicit) or query (code). */
function getReturnedRawState(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fromHash = hashParams.get('state');
  if (fromHash) return fromHash;
  return new URLSearchParams(window.location.search).get('state');
}

export interface ForwardResult {
  forwarded: boolean;
  error?: string;
}

/**
 * When login lands on the fixed callback origin but was initiated from a
 * different (preview) origin, forward the result back there — gated by the
 * allowlist. Returns { forwarded:true } when a redirect was issued OR refused;
 * { forwarded:false } when this origin should handle the callback itself.
 */
export function maybeForwardToOrigin(): ForwardResult {
  const decoded = decodeState(getReturnedRawState());
  if (!decoded || decoded.origin === window.location.origin) {
    return { forwarded: false };
  }

  const { AUTH_CALLBACK_ORIGIN, AUTH_PREVIEW_ORIGIN_ALLOWLIST } = getConfig();
  const allowed = isAllowedOrigin(decoded.origin, {
    fixedOrigin: AUTH_CALLBACK_ORIGIN,
    patternSource: AUTH_PREVIEW_ORIGIN_ALLOWLIST,
  });
  if (!allowed) {
    return {
      forwarded: true,
      error: `Refusing to forward authentication to a disallowed origin: ${decoded.origin}`,
    };
  }

  window.location.href = `${decoded.origin}/oauth2/callback${window.location.search}${window.location.hash}`;
  return { forwarded: true };
}

/**
 * Handles the OAuth2 callback URL.
 * Detects whether we got a code or an implicit token and processes accordingly.
 * Returns the result type so the callback page can route appropriately.
 */
export async function handleCallback(): Promise<CallbackResult> {
  const queryParams = new URLSearchParams(window.location.search);
  const error = queryParams.get('error');

  if (error) {
    const description = queryParams.get('error_description') ?? error;
    return { type: 'error', error: description };
  }

  // Validate the state nonce to prevent CSRF. Fail closed: if this browser
  // initiated login (a stored nonce exists), the callback MUST present a
  // decodable state whose nonce matches. Missing/garbled state is rejected.
  const decoded = decodeState(getReturnedRawState());
  const storedNonce = sessionStorage.getItem('oauth2_state');
  if (storedNonce && (!decoded || decoded.nonce !== storedNonce)) {
    sessionStorage.removeItem('oauth2_state');
    return { type: 'error', error: 'State mismatch — possible CSRF attack' };
  }
  sessionStorage.removeItem('oauth2_state');

  const code = queryParams.get('code');
  if (code) {
    await exchangeCode(code);
    return { type: 'code' };
  }

  // Check for implicit token in fragment or query
  const token = handleImplicitCallback();
  if (token) {
    return { type: 'token' };
  }

  return { type: 'error', error: 'No code or token found in callback URL' };
}

// ---------------------------------------------------------------------------
// Token normalisation helpers
// ---------------------------------------------------------------------------

function saveKeycloakTokenResponse(data: KeycloakTokenResponse): void {
  storeTokens({
    accessToken: data.access_token,
    accessExpiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    refreshExpiresIn: data.refresh_expires_in,
  });
}

function saveTapisTokenResponse(result: TapisTokenResult): void {
  const accessExpiresIn =
    result.access_token.expires_in ??
    (result.access_token.expires_at
      ? Math.floor((new Date(result.access_token.expires_at).getTime() - Date.now()) / 1000)
      : undefined);

  const refreshExpiresIn =
    result.refresh_token?.expires_in ??
    (result.refresh_token?.expires_at
      ? Math.floor((new Date(result.refresh_token.expires_at).getTime() - Date.now()) / 1000)
      : undefined);

  storeTokens({
    accessToken: result.access_token.access_token,
    accessExpiresIn,
    refreshToken: result.refresh_token?.refresh_token,
    refreshExpiresIn,
  });
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Attempts to refresh the access token using the stored refresh token.
 * Returns true on success, false on failure.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('mint.refresh_token');
  if (!refreshToken) return false;

  const { AUTH_CLIENT_ID, AUTH_PROVIDER } = getConfig();
  const tokenUrl = getTokenEndpoint();

  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: AUTH_CLIENT_ID,
  };

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as KeycloakTokenResponse | TapisTokenResponse;

    if (AUTH_PROVIDER === 'tapis' && 'result' in data) {
      saveTapisTokenResponse(data.result);
    } else {
      saveKeycloakTokenResponse(data as KeycloakTokenResponse);
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * Clears local token state and redirects to the IdP logout endpoint.
 */
export function logout(): void {
  const { AUTH_CLIENT_ID, AUTH_PROVIDER } = getConfig();

  if (AUTH_PROVIDER === 'keycloak') {
    const params = new URLSearchParams({
      client_id: AUTH_CLIENT_ID,
      post_logout_redirect_uri: window.location.origin,
    });
    clearTokens();
    window.location.href = `${getLogoutEndpoint()}?${params.toString()}`;
    return;
  }

  // Tapis: clear locally, optionally POST to logout endpoint
  const refreshToken = localStorage.getItem('mint.refresh_token');
  clearTokens();

  if (refreshToken) {
    // Fire-and-forget — don't await, just clean up server-side session
    fetch(getLogoutEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshToken }),
    }).catch(() => {
      // Ignore logout endpoint errors
    });
  }

  window.location.href = '/';
}

// ---------------------------------------------------------------------------
// Register refresh callback with token-store
// ---------------------------------------------------------------------------

setRefreshCallback(refreshAccessToken);
