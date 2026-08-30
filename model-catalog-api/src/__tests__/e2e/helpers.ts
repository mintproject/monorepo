import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export const RUN_ID = `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;

const ID_PREFIX = 'https://w3id.org/okn/i/mint';

export function uniqueId(kind: string): string {
  return `${ID_PREFIX}/${kind}-${RUN_ID}-${randomUUID().slice(0, 6)}`;
}

export const E2E_HEADERS: Record<string, string> = {
  Authorization: 'Bearer e2e-test',
  'Content-Type': 'application/json',
};

interface Tracked {
  resource: string;
  id: string;
}

const created: Tracked[] = [];

export function trackId(resource: string, id: string): void {
  created.push({ resource, id });
}

export interface InjectResult {
  statusCode: number;
  body: unknown;
  rawPayload: string;
}

export async function inject(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  payload?: unknown,
): Promise<InjectResult> {
  const res = await app.inject({
    method,
    url: path,
    headers: E2E_HEADERS,
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  });
  let body: unknown = undefined;
  if (res.payload && res.payload.length > 0) {
    try {
      body = JSON.parse(res.payload);
    } catch {
      body = res.payload;
    }
  }
  return { statusCode: res.statusCode, body, rawPayload: res.payload };
}

export async function cleanup(app: FastifyInstance): Promise<void> {
  const orphans: Tracked[] = [];
  // DELETE has no body — strip Content-Type so Fastify doesn't reject empty payload.
  const { 'Content-Type': _ct, ...deleteHeaders } = E2E_HEADERS;
  for (const t of [...created].reverse()) {
    try {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v2.0.0/${t.resource}/${encodeURIComponent(t.id)}`,
        headers: deleteHeaders,
      });
      if (res.statusCode >= 400 && res.statusCode !== 404) {
        orphans.push(t);
        // eslint-disable-next-line no-console
        console.warn(
          `cleanup: ${t.resource}/${t.id} delete returned ${res.statusCode}: ${res.payload}`,
        );
      }
    } catch (err) {
      orphans.push(t);
      // eslint-disable-next-line no-console
      console.warn(`cleanup: ${t.resource}/${t.id} threw`, err);
    }
  }
  if (orphans.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `cleanup: ${orphans.length} orphan(s) remain. RUN_ID=${RUN_ID}. Manual SQL:\n` +
        `  DELETE FROM modelcatalog_software_version WHERE id LIKE '%-${RUN_ID}-%';\n` +
        `  DELETE FROM modelcatalog_software WHERE id LIKE '%-${RUN_ID}-%';\n` +
        `  DELETE FROM modelcatalog_grid WHERE id LIKE '%-${RUN_ID}-%';`,
    );
  }
  created.length = 0;
}
