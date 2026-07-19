import { describe, expect, it } from 'vitest';

import { buildEnvConfig, renderEnvConfig } from '../../scripts/generate-env-config.mjs';

describe('buildEnvConfig', () => {
  it('uses committed defaults when env is empty', () => {
    const c = buildEnvConfig({});
    expect(c.AUTH_CLIENT_ID).toBe('mint-local');
    expect(c.AUTH_SERVER).toBe('https://portals.tapis.io');
    expect(c.AUTH_PROVIDER).toBe('tapis');
    expect(c.AUTH_REALM).toBe('');
    expect(c.HASURA_ENDPOINT).toBe('http://graphql.mint.local/v1/graphql');
    expect('AUTH_CALLBACK_ORIGIN' in c).toBe(false);
  });

  it('overrides from explicit (unprefixed) env vars', () => {
    const c = buildEnvConfig({
      AUTH_CLIENT_ID: 'mint-vercel',
      AUTH_CALLBACK_ORIGIN: 'https://monorepo-mosoriobs-projects.vercel.app',
    });
    expect(c.AUTH_CLIENT_ID).toBe('mint-vercel');
    expect(c.AUTH_CALLBACK_ORIGIN).toBe('https://monorepo-mosoriobs-projects.vercel.app');
  });

  it('supports VITE_-prefixed fallbacks', () => {
    const c = buildEnvConfig({ VITE_AUTH_CLIENT_ID: 'mint-vercel' });
    expect(c.AUTH_CLIENT_ID).toBe('mint-vercel');
  });

  it('treats empty string as unset (falls back to default)', () => {
    const c = buildEnvConfig({ AUTH_CLIENT_ID: '' });
    expect(c.AUTH_CLIENT_ID).toBe('mint-local');
  });

  it('omits optional keys when unset', () => {
    const c = buildEnvConfig({});
    expect('AUTH_PREVIEW_ORIGIN_ALLOWLIST' in c).toBe(false);
    expect('WELCOME_MESSAGE' in c).toBe(false);
    expect('ENSEMBLE_MANAGER_API' in c).toBe(false);
  });

  it('emits the service endpoint keys the application reads', () => {
    const c = buildEnvConfig({});
    expect(c.DATA_CATALOG_API).toBe('http://datacatalog.mint.local');
    expect(c.MODEL_CATALOG_API).toBe('http://api.models.mint.local/v1.8.0');
  });

  it('overrides the service endpoints from env, bare or VITE_-prefixed', () => {
    const c = buildEnvConfig({
      DATA_CATALOG_API: 'https://data.example.org',
      VITE_MODEL_CATALOG_API: 'https://models.example.org/v2',
      ENSEMBLE_MANAGER_API: 'https://ensemble.example.org',
    });
    expect(c.DATA_CATALOG_API).toBe('https://data.example.org');
    expect(c.MODEL_CATALOG_API).toBe('https://models.example.org/v2');
    expect(c.ENSEMBLE_MANAGER_API).toBe('https://ensemble.example.org');
  });

  it('prefers the bare name over the VITE_-prefixed one', () => {
    const c = buildEnvConfig({
      DATA_CATALOG_API: 'https://bare.example.org',
      VITE_DATA_CATALOG_API: 'https://prefixed.example.org',
    });
    expect(c.DATA_CATALOG_API).toBe('https://bare.example.org');
  });

  it('treats an empty service endpoint as unset', () => {
    const c = buildEnvConfig({ DATA_CATALOG_API: '', ENSEMBLE_MANAGER_API: '' });
    expect(c.DATA_CATALOG_API).toBe('http://datacatalog.mint.local');
    expect('ENSEMBLE_MANAGER_API' in c).toBe(false);
  });

  it('includes optional allowlist + welcome when provided', () => {
    const c = buildEnvConfig({
      AUTH_PREVIEW_ORIGIN_ALLOWLIST: '^https://x$',
      WELCOME_MESSAGE: 'hi',
    });
    expect(c.AUTH_PREVIEW_ORIGIN_ALLOWLIST).toBe('^https://x$');
    expect(c.WELCOME_MESSAGE).toBe('hi');
  });
});

describe('renderEnvConfig', () => {
  it('produces an assignable global script ending in a semicolon', () => {
    const out = renderEnvConfig({ AUTH_CLIENT_ID: 'x' });
    expect(out).toContain('window.__MINT_CONFIG__ =');
    expect(out.trim().endsWith(';')).toBe(true);
    expect(out).toContain('"AUTH_CLIENT_ID": "x"');
  });

  it('escapes values so the output is valid JSON-parseable JS', () => {
    const out = renderEnvConfig({ WELCOME_MESSAGE: 'he said "hi"\nline2', AUTH_CLIENT_ID: 'x' });
    // Extract the object literal between the first '{' and the trailing '};'
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json);
    expect(parsed.WELCOME_MESSAGE).toBe('he said "hi"\nline2');
    expect(parsed.AUTH_CLIENT_ID).toBe('x');
  });
});
