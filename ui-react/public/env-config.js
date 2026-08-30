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
// (*.mint.local); a laptop is not in that cluster, so the same default cannot
// serve both. The values below target TACC's public deployment so that a fresh
// clone runs with no cluster access at all: Hasura's `anonymous` role serves
// read-only queries and sends CORS `*`, and CKAN allowlists the localhost
// origin. Signing in is the one thing this does not buy you — that additionally
// needs an OAuth2 client whose registered callback is
// http://localhost:3000/oauth2/callback.
window.__MINT_CONFIG__ = {
  HASURA_ENDPOINT: "https://graphql.mint.tacc.utexas.edu/v1/graphql",
  AUTH_SERVER: "https://portals.tapis.io",
  AUTH_CLIENT_ID: "mint-localhost-3000",
  AUTH_REALM: "",
  AUTH_PROVIDER: "tapis",
  GOOGLE_MAPS_KEY: "AIzaSyDf8bXwyV7v9whOpZl64SRVWKdE6yBbt2k",
  DATA_CATALOG_API: "https://ckan.tacc.utexas.edu",
  DATA_CATALOG_BROWSE_URL: "https://ckan.tacc.utexas.edu",
  // Which backend the Ensemble Manager you point at runs: 'tapis', 'localex'
  // or 'wings'. It picks the submission route, so a value that disagrees with
  // that deployment reaches the wrong handler or none. 'tapis' rather than the
  // generator's 'localex' default, to match the TACC endpoints above — set it
  // to your own engine if you point ENSEMBLE_MANAGER_API elsewhere.
  EXECUTION_ENGINE: "tapis",
  // ENSEMBLE_MANAGER_API is deliberately omitted: the thread pages check for
  // its absence and degrade rather than call a wrong host. Set it here if you
  // are working on model execution.
};
