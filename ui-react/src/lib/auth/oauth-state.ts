/**
 * Codec for the OAuth2 `state` parameter.
 *
 * We pack two values into `state`:
 *   - nonce:  CSRF token, also mirrored in sessionStorage on the initiating origin.
 *   - origin: window.location.origin of the deployment that started login, so the
 *             fixed-origin callback can forward the result back to it.
 *
 * Encoded as URL-safe base64 of a JSON object.
 */

export interface OAuthState {
  nonce: string;
  origin: string;
}

const MAX_STATE_LENGTH = 2048;

function toBase64Url(input: string): string {
  // btoa operates on Latin1; nonce and origin are ASCII, so this is safe.
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  return atob(input.replace(/-/g, '+').replace(/_/g, '/'));
}

export function encodeState(payload: OAuthState): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeState(raw: string | null | undefined): OAuthState | null {
  if (!raw || raw.length > MAX_STATE_LENGTH) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as OAuthState).nonce === 'string' &&
      (parsed as OAuthState).nonce.length > 0 &&
      typeof (parsed as OAuthState).origin === 'string' &&
      (parsed as OAuthState).origin.length > 0
    ) {
      const { nonce, origin } = parsed as OAuthState;
      return { nonce, origin };
    }
    return null;
  } catch {
    return null;
  }
}
