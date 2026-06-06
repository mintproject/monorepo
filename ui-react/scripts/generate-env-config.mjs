// Build-time generation of dist/env-config.js for Vercel deployments.
//
// Locally and in Docker the committed public/env-config.js (or the Docker
// entrypoint's generated file) is the source of truth, so this script is a
// no-op unless running on Vercel (process.env.VERCEL is set). On Vercel it
// rewrites dist/env-config.js from environment variables, each falling back to
// the committed defaults, so only the values that differ (e.g. AUTH_CLIENT_ID,
// AUTH_CALLBACK_ORIGIN) need to be set in the Vercel project settings.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Returns the first non-empty value among the given env var names. */
function pick(env, ...names) {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

/**
 * Builds the __MINT_CONFIG__ object from environment variables.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string | undefined>}
 */
export function buildEnvConfig(env = process.env) {
  // NOTE: these defaults must mirror public/env-config.js — update both together.
  const config = /** @type {Record<string, string | undefined>} */ ({
    HASURA_ENDPOINT:
      pick(env, 'HASURA_ENDPOINT', 'VITE_HASURA_ENDPOINT') ?? 'http://graphql.mint.local/v1/graphql',
    AUTH_SERVER: pick(env, 'AUTH_SERVER', 'VITE_AUTH_SERVER') ?? 'https://portals.tapis.io',
    AUTH_CLIENT_ID: pick(env, 'AUTH_CLIENT_ID', 'VITE_AUTH_CLIENT_ID') ?? 'mint-local',
    AUTH_REALM: pick(env, 'AUTH_REALM', 'VITE_AUTH_REALM') ?? '',
    AUTH_PROVIDER: pick(env, 'AUTH_PROVIDER', 'VITE_AUTH_PROVIDER') ?? 'tapis',
    GOOGLE_MAPS_KEY:
      pick(env, 'GOOGLE_MAPS_KEY', 'VITE_GOOGLE_MAPS_KEY') ??
      'AIzaSyDf8bXwyV7v9whOpZl64SRVWKdE6yBbt2k',
  });

  const callbackOrigin = pick(env, 'AUTH_CALLBACK_ORIGIN', 'VITE_AUTH_CALLBACK_ORIGIN');
  if (callbackOrigin) config.AUTH_CALLBACK_ORIGIN = callbackOrigin;

  const allowlist = pick(env, 'AUTH_PREVIEW_ORIGIN_ALLOWLIST', 'VITE_AUTH_PREVIEW_ORIGIN_ALLOWLIST');
  if (allowlist) config.AUTH_PREVIEW_ORIGIN_ALLOWLIST = allowlist;

  const welcome = pick(env, 'WELCOME_MESSAGE', 'VITE_WELCOME_MESSAGE');
  if (welcome) config.WELCOME_MESSAGE = welcome;

  return config;
}

/** Renders the config object as an assignable env-config.js script. */
export function renderEnvConfig(config) {
  return (
    '// Generated at build time by scripts/generate-env-config.mjs — do not edit.\n' +
    `window.__MINT_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`
  );
}

function main() {
  if (!process.env.VERCEL) {
    console.log(
      '[generate-env-config] VERCEL not set; leaving the existing dist/env-config.js untouched.',
    );
    return;
  }
  const config = buildEnvConfig(process.env);
  const outPath = path.join(process.cwd(), 'dist', 'env-config.js');
  fs.writeFileSync(outPath, renderEnvConfig(config));
  console.log(
    `[generate-env-config] Wrote ${outPath} (AUTH_CLIENT_ID=${config.AUTH_CLIENT_ID}, ` +
      `AUTH_CALLBACK_ORIGIN=${config.AUTH_CALLBACK_ORIGIN ?? '(unset)'})`,
  );
}

// Only execute main() when run directly (node scripts/generate-env-config.mjs),
// not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
