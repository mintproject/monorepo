export interface MintConfig {
  HASURA_ENDPOINT: string;
  AUTH_SERVER: string;
  AUTH_CLIENT_ID: string;
  AUTH_REALM: string;
  AUTH_PROVIDER: string;
  GOOGLE_MAPS_KEY: string;
  DATA_CATALOG_API: string;
  DATA_CATALOG_BROWSE_URL: string;
  EXECUTION_ENGINE: string;
  ENSEMBLE_MANAGER_API?: string;
  AUTH_CALLBACK_ORIGIN?: string;
  AUTH_PREVIEW_ORIGIN_ALLOWLIST?: string;
  WELCOME_MESSAGE?: string;
  [key: string]: string | undefined;
}

export function buildEnvConfig(env?: Record<string, string | undefined>): MintConfig;
export function renderEnvConfig(config: Record<string, string | undefined>): string;
