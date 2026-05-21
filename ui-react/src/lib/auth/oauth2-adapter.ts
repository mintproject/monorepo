/**
 * OAuth2 adapter for Keycloak/Tapis authentication.
 * Handles authorization code grant and implicit grant flows.
 *
 * This module will be fully implemented in the auth integration task.
 * The interface matches the legacy OAuth2Adapter contract.
 */

export interface OAuth2Config {
  authServer: string;
  clientId: string;
  realm: string;
  provider: 'keycloak' | 'tapis';
}

export function getAuthorizationUrl(_config: OAuth2Config): string {
  // TODO: Implement authorization URL construction
  return '';
}

export function handleCallback(_code: string): Promise<string> {
  // TODO: Implement token exchange
  return Promise.resolve('');
}
