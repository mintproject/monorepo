// Runtime configuration for LOCAL DEVELOPMENT ONLY.
//
// index.html loads this file before the app, and Vite serves public/ as-is, so
// window.__MINT_CONFIG__ is ALWAYS defined under `npm run dev`. The
// `import.meta.env.VITE_*` fallbacks in src/ read a whole-object default that
// only applies when window.__MINT_CONFIG__ is absent — so they never fire
// locally. This file, not a .env, is what configures the dev server.
//
// Every deployed context overwrites it via scripts/generate-env-config.mjs:
// the container entrypoint at startup, Vercel at build time. Nothing set here
// reaches a deployment.
//
// To point local dev elsewhere: edit this file directly, or put the values in a
// .env (copy .env.example) and run `npm run config:local` to regenerate it.
//
// These values intentionally DIFFER from the defaults in
// scripts/generate-env-config.mjs. Those target an in-cluster MINT deployment
// (*.mint.local); the values below target the compose stack in this repository,
// which is what a laptop actually runs. Start it first:
//
//   docker compose up -d
//
// Ports follow compose.yaml: Hasura 8080, Ensemble Manager 3001,
// model-catalog-api 3002 (the UI reads Hasura directly and never calls it).
// Without the stack running the app loads and every query fails — that is the
// intended trade: local dev must not write to production by default. To browse
// TACC's public deployment instead, set HASURA_ENDPOINT to
// https://graphql.mint.tacc.utexas.edu/v1/graphql, whose `anonymous` role
// serves read-only queries and sends CORS `*`. Note that its schema can lag
// this checkout's migrations, so a branch that adds one will fail against it.
window.__MINT_CONFIG__ = {
  // Hasura in the compose stack. Its CORS list already names
  // http://localhost:3000, so the dev server is an allowed origin.
  HASURA_ENDPOINT: "http://localhost:8080/v1/graphql",
  // Tapis stays remote: the stack runs no identity provider. The compose auth
  // webhook validates real `portals` tenant tokens, so signing in locally works
  // and gives you the `user` role. `mint-localhost-3000` is registered for the
  // callback http://localhost:3000/oauth2/callback — Tapis allows one callback
  // per client, so the dev server must stay on port 3000.
  AUTH_SERVER: "https://portals.tapis.io",
  AUTH_CLIENT_ID: "mint-localhost-3000",
  AUTH_REALM: "",
  AUTH_PROVIDER: "tapis",
  GOOGLE_MAPS_KEY: "AIzaSyDf8bXwyV7v9whOpZl64SRVWKdE6yBbt2k",
  // CKAN stays remote too. The stack runs no CKAN, and this one echoes CORS
  // headers for the localhost origin.
  DATA_CATALOG_API: "https://ckan.tacc.utexas.edu",
  DATA_CATALOG_BROWSE_URL: "https://ckan.tacc.utexas.edu",
  // Ensemble Manager in the compose stack. It listens on 3000 in its container;
  // compose publishes it on 3001. This is a HOST url — the browser resolves it,
  // so a compose service name would not work.
  ENSEMBLE_MANAGER_API: "http://localhost:3001/v1",
  // Which backend the Ensemble Manager you point at runs: 'tapis', 'localex'
  // or 'wings'. It picks the submission route, so a value that disagrees with
  // that deployment reaches the wrong handler or none. 'tapis' matches
  // compose/ensemble-manager.json, which sets execution_engine to tapis.
  EXECUTION_ENGINE: "tapis",
  // Shows the TACC + UT Austin strip and footer locally, so the branded chrome
  // is visible while developing it. This file never reaches a deployment (see
  // the header), so it does not weaken the 'none' default in
  // scripts/generate-env-config.mjs. Set it to "none" to see the unbranded
  // chrome.
  BRANDING: "tacc",
};
