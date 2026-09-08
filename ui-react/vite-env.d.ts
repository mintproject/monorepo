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
  /** Ensemble Manager REST API base URL. */
  ENSEMBLE_MANAGER_API?: string;
  /**
   * Execution backend the deployment's Ensemble Manager runs — 'tapis',
   * 'localex' or 'wings'. Selects the submission route; see
   * {@link submitRuns}. Left as `string` because the Ensemble Manager can gain
   * an engine without this app changing.
   */
  EXECUTION_ENGINE?: string;
  /** Fixed origin to register as the single Tapis callback_url (Vercel prod). */
  AUTH_CALLBACK_ORIGIN?: string;
  /** Regex source overriding the default preview-origin allowlist. */
  AUTH_PREVIEW_ORIGIN_ALLOWLIST?: string;
  /**
   * Co-branding preset for the app chrome: 'tacc' shows the TACC and UT Austin
   * strip, 'none' shows no institutional logos. Defaults to 'none' — an
   * unbranded deployment must be a default, not an accident. The logo paths,
   * link targets and alt text live in `src/lib/branding.ts`, not here.
   */
  BRANDING?: 'tacc' | 'none';
}

interface Window {
  __MINT_CONFIG__: MintConfig;
}
