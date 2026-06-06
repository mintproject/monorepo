// Runtime configuration — injected by Docker entrypoint at container startup.
// In development, Vite env vars (VITE_*) are used as fallbacks.
// In production, this file is generated from environment variables by the
// Docker entrypoint script (scripts/entrypoint.sh).
window.__MINT_CONFIG__ = {
  HASURA_ENDPOINT: "http://graphql.mint.local/v1/graphql",
  AUTH_SERVER: "https://portals.tapis.io",
  AUTH_CLIENT_ID: "mint-local",
  AUTH_REALM: "",
  AUTH_PROVIDER: "tapis",
};
