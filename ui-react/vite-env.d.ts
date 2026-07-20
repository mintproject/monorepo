/// <reference types="vite/client" />

interface MintConfig {
  HASURA_ENDPOINT: string;
  AUTH_SERVER: string;
  AUTH_CLIENT_ID: string;
  AUTH_REALM: string;
  AUTH_PROVIDER: 'keycloak' | 'tapis';
  GOOGLE_MAPS_KEY?: string;
  WELCOME_MESSAGE?: string;
  /** CKAN data catalog REST API base URL, no /api suffix (e.g. https://ckan.tacc.utexas.edu) */
  DATA_CATALOG_API?: string;
  /** Human-browsable data catalog UI URL, used as the datasets browse iframe src. */
  DATA_CATALOG_BROWSE_URL?: string;
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
