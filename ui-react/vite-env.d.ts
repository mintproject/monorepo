/// <reference types="vite/client" />

interface MintConfig {
  HASURA_ENDPOINT: string;
  AUTH_SERVER: string;
  AUTH_CLIENT_ID: string;
  AUTH_REALM: string;
  AUTH_PROVIDER: 'keycloak' | 'tapis';
  GOOGLE_MAPS_KEY?: string;
  WELCOME_MESSAGE?: string;
  /** Fixed origin to register as the single Tapis callback_url (Vercel prod). */
  AUTH_CALLBACK_ORIGIN?: string;
  /** Regex source overriding the default preview-origin allowlist. */
  AUTH_PREVIEW_ORIGIN_ALLOWLIST?: string;
}

interface Window {
  __MINT_CONFIG__: MintConfig;
}
