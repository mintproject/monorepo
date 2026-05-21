// Runtime configuration — injected by Docker entrypoint at container startup.
// In development, Vite env vars (VITE_*) are used as fallbacks.
// In production, this file is generated from environment variables.
window.__MINT_CONFIG__ = {
  HASURA_ENDPOINT: "http://localhost:8080/v1/graphql",
  AUTH_SERVER: "https://iam.mint.isi.edu",
  AUTH_CLIENT_ID: "mint-ui",
  AUTH_REALM: "production",
  AUTH_PROVIDER: "keycloak",
};
