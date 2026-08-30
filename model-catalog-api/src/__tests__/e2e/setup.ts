import type { FastifyInstance } from 'fastify';

const DEFAULTS: Record<string, string> = {
  HASURA_GRAPHQL_URL: 'http://graphql.mint.local/v1/graphql',
  HASURA_ADMIN_SECRET: 'CHANGEME',
  MINT_E2E_MODE: '1',
  LOG_LEVEL: 'warn',
};

export function applyE2EEnv(): void {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }
}

export async function buildE2EApp(): Promise<FastifyInstance> {
  applyE2EEnv();
  const { buildApp } = await import('../../app.js');
  return buildApp();
}

export async function assertHasuraReachable(): Promise<void> {
  applyE2EEnv();
  const url = process.env.HASURA_GRAPHQL_URL!;
  const adminSecret = process.env.HASURA_ADMIN_SECRET!;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Admin-Secret': adminSecret,
      },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
  } catch (err) {
    throw new Error(
      `Local Hasura unreachable at ${url}. Check kubectl port-forward / /etc/hosts. Underlying error: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(
      `Local Hasura health-check failed at ${url}: ${res.status} ${res.statusText}. Body: ${text}`,
    );
  }
}
