import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getWriteClient — MINT_E2E_MODE', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  // Note: caller MUST set process.env BEFORE invoking — module-level constants
  // in client.ts are captured at import time.
  async function captureHeaders(
    bearerToken: string,
  ): Promise<Record<string, string>> {
    const captured: Record<string, string> = {};

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      Object.assign(captured, headers);
      // Return a minimal valid GraphQL response to prevent Apollo errors
      return new Response(JSON.stringify({ data: { __typename: 'Query' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Patch globalThis.fetch before importing so the module picks it up
    vi.stubGlobal('fetch', mockFetch);

    const { getWriteClient } = await import('../hasura/client.js');
    const client = getWriteClient(bearerToken);

    // Fire a minimal query to trigger fetch
    try {
      await client.query({
        query: (await import('../hasura/client.js')).gql`{ __typename }`,
      });
    } catch {
      // Ignore Apollo errors — we only care about the fetch call headers
    }

    return captured;
  }

  it('uses Authorization: Bearer when MINT_E2E_MODE is unset', async () => {
    delete process.env.MINT_E2E_MODE;
    process.env.HASURA_GRAPHQL_URL = 'http://hasura.test/v1/graphql';
    process.env.HASURA_ADMIN_SECRET = 'secret';

    const headers = await captureHeaders('Bearer real-jwt');
    expect(headers).toMatchObject({ authorization: 'Bearer real-jwt' });
    expect(headers).not.toHaveProperty('x-hasura-admin-secret');
  });

  it('uses X-Hasura-Admin-Secret when MINT_E2E_MODE=1', async () => {
    process.env.MINT_E2E_MODE = '1';
    process.env.HASURA_GRAPHQL_URL = 'http://hasura.test/v1/graphql';
    process.env.HASURA_ADMIN_SECRET = 'secret';

    const headers = await captureHeaders('Bearer ignored');
    expect(headers).toMatchObject({ 'x-hasura-admin-secret': 'secret' });
    expect(headers).not.toHaveProperty('authorization');
  });
});
