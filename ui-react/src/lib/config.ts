/**
 * Runtime config accessor.
 *
 * Reads window.__MINT_CONFIG__ at call time so that changes to env-config.js
 * between page loads are always reflected. Falls back to VITE_ env vars for
 * local development without a Docker setup.
 */
export function getRuntimeConfig() {
  return (
    window.__MINT_CONFIG__ ?? {
      HASURA_ENDPOINT: import.meta.env.VITE_HASURA_ENDPOINT ?? 'http://localhost:8080/v1/graphql',
      AUTH_SERVER: import.meta.env.VITE_AUTH_SERVER ?? '',
      AUTH_CLIENT_ID: import.meta.env.VITE_AUTH_CLIENT_ID ?? '',
      AUTH_REALM: import.meta.env.VITE_AUTH_REALM ?? '',
      AUTH_PROVIDER: (import.meta.env.VITE_AUTH_PROVIDER as 'keycloak' | 'tapis') ?? 'keycloak',
      DATA_CATALOG_API: import.meta.env.VITE_DATA_CATALOG_API ?? 'https://ckan.tacc.utexas.edu',
      DATA_CATALOG_BROWSE_URL:
        import.meta.env.VITE_DATA_CATALOG_BROWSE_URL ?? 'https://ckan.tacc.utexas.edu',
      MODEL_CATALOG_API:
        import.meta.env.VITE_MODEL_CATALOG_API ?? 'https://api.models.mint.isi.edu/v1.8.0',
    }
  );
}

/**
 * Returns the Data Catalog REST API base URL (no trailing slash).
 *
 * This is the CKAN Action API base; callers append `/api/3/action/...`. It is
 * NOT a browser-facing URL — for the human-browsable catalog page use
 * {@link getDataCatalogBrowseUrl}.
 */
export function getDataCatalogApiUrl(): string {
  const url = getRuntimeConfig().DATA_CATALOG_API ?? 'https://ckan.tacc.utexas.edu';
  return url.replace(/\/$/, '');
}

/**
 * Returns the human-browsable Data Catalog UI URL (no trailing slash), used as
 * the iframe src on the datasets browse page.
 *
 * Distinct from {@link getDataCatalogApiUrl}: a REST API base and a
 * browser-facing catalog page need not share a host. Falls back to the REST
 * API base for backward compatibility when the browse key is unset, since for a
 * single CKAN deployment both are served from the same origin.
 */
export function getDataCatalogBrowseUrl(): string {
  const url =
    getRuntimeConfig().DATA_CATALOG_BROWSE_URL ??
    getRuntimeConfig().DATA_CATALOG_API ??
    'https://ckan.tacc.utexas.edu';
  return url.replace(/\/$/, '');
}

/** Returns the Model Catalog REST API base URL (no trailing slash). */
export function getModelCatalogApiUrl(): string {
  const url = getRuntimeConfig().MODEL_CATALOG_API ?? 'https://api.models.mint.isi.edu/v1.8.0';
  return url.replace(/\/$/, '');
}
