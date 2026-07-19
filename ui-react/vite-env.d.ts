/// <reference types="vite/client" />

interface MintConfig {
  HASURA_ENDPOINT: string;
  AUTH_SERVER: string;
  AUTH_CLIENT_ID: string;
  AUTH_REALM: string;
  AUTH_PROVIDER: 'keycloak' | 'tapis';
  GOOGLE_MAPS_KEY?: string;
  WELCOME_MESSAGE?: string;
  /** Data Catalog REST API base URL (e.g. https://datacatalog.mint.isi.edu/api/v1) */
  DATA_CATALOG_API?: string;
  /** Model Catalog REST API base URL. */
  MODEL_CATALOG_API?: string;
  /** Ensemble Manager REST API base URL. */
  ENSEMBLE_MANAGER_API?: string;
  /** Fixed origin to register as the single Tapis callback_url (Vercel prod). */
  AUTH_CALLBACK_ORIGIN?: string;
  /** Regex source overriding the default preview-origin allowlist. */
  AUTH_PREVIEW_ORIGIN_ALLOWLIST?: string;
}

interface Window {
  __MINT_CONFIG__: MintConfig;
}
