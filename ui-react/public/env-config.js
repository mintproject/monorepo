// Runtime configuration defaults, used as-is for local development.
//
// In a container these values are overwritten at startup by
// docker/entrypoint.sh, and on Vercel at build time — both via
// scripts/generate-env-config.mjs, which owns the configuration shape and
// carries the same defaults. Update both together.
window.__MINT_CONFIG__ = {
  HASURA_ENDPOINT: "http://graphql.mint.local/v1/graphql",
  AUTH_SERVER: "https://portals.tapis.io",
  AUTH_CLIENT_ID: "mint-local",
  AUTH_REALM: "",
  AUTH_PROVIDER: "tapis",
  GOOGLE_MAPS_KEY: "AIzaSyDf8bXwyV7v9whOpZl64SRVWKdE6yBbt2k",
  DATA_CATALOG_API: "http://datacatalog.mint.local",
  MODEL_CATALOG_API: "http://api.models.mint.local/v1.8.0",
};
