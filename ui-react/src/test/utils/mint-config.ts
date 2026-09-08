/**
 * `window.__MINT_CONFIG__` for tests.
 *
 * The app reads its runtime configuration from this global (see the Runtime
 * configuration section of ui-react/CLAUDE.md). Tests that exercise a
 * config-dependent branch set it through here rather than writing the whole
 * literal out again.
 */

type MintConfig = NonNullable<Window['__MINT_CONFIG__']>;

const BASE: MintConfig = {
  HASURA_ENDPOINT: 'http://localhost:8080/v1/graphql',
  AUTH_SERVER: '',
  AUTH_CLIENT_ID: '',
  AUTH_REALM: '',
  AUTH_PROVIDER: 'keycloak',
};

/** Install a runtime config, overriding or omitting individual keys. */
export function setMintConfig(overrides: Partial<MintConfig> = {}): void {
  window.__MINT_CONFIG__ = { ...BASE, ...overrides };
}
