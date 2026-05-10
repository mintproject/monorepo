import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { assertHasuraReachable, buildE2EApp } from './setup.js';
import { cleanup, inject, trackId, uniqueId } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  await assertHasuraReachable();
  app = await buildE2EApp();
});

afterAll(async () => {
  await cleanup(app);
  await app.close();
});

describe('e2e smoke — flat entity', () => {
  it('POST /persons round-trips through Hasura', async () => {
    const id = uniqueId('person');

    const post = await inject(app, 'POST', '/v2.0.0/persons', {
      id,
      label: ['E2E Smoke Person'],
    });

    expect(post.statusCode, `POST /persons body: ${JSON.stringify(post.body)}`).toBe(201);
    trackId('persons', id);

    const get = await inject(app, 'GET', `/v2.0.0/persons/${encodeURIComponent(id)}`);
    expect(get.statusCode).toBe(200);

    const person = get.body as Record<string, unknown>;
    expect(person.id).toBe(id);
    expect((person.label as string[])[0]).toBe('E2E Smoke Person');
  });
});
