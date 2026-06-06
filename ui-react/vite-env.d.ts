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
}

interface Window {
  __MINT_CONFIG__: MintConfig;
}
