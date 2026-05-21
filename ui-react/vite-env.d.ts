/// <reference types="vite/client" />

interface MintConfig {
  HASURA_ENDPOINT: string;
  AUTH_SERVER: string;
  AUTH_CLIENT_ID: string;
  AUTH_REALM: string;
  AUTH_PROVIDER: 'keycloak' | 'tapis';
}

interface Window {
  __MINT_CONFIG__: MintConfig;
}
