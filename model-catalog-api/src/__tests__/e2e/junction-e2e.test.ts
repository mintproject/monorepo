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
  if (app) {
    await cleanup(app);
    await app.close();
  }
});

describe('junction e2e — softwareversions.hasGrid (bug-087 class)', () => {
  it('does NOT clobber an existing grid label when linked from a new softwareversion (bug-087 regression)', async () => {
    // 1. Create a grid with a known label.
    const gridId = uniqueId('grid');
    const ORIGINAL_LABEL = 'original-grid-label-DO-NOT-CLOBBER';
    const gridCreate = await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId,
      label: [ORIGINAL_LABEL],
      type: ['Grid'],
    });
    expect(gridCreate.statusCode).toBeGreaterThanOrEqual(200);
    expect(gridCreate.statusCode).toBeLessThan(300);
    trackId('grids', gridId);

    // 2. Create a softwareversion linking to that grid by ID only (no label in the link payload).
    const versionId = uniqueId('softwareversion');
    const versionCreate = await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId,
      label: ['e2e-version'],
      type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }],
    });
    expect(versionCreate.statusCode).toBeGreaterThanOrEqual(200);
    expect(versionCreate.statusCode).toBeLessThan(300);
    trackId('softwareversions', versionId);

    // 3. Fetch the grid back and assert its label was NOT touched.
    const gridGet = await inject(
      app,
      'GET',
      `/v2.0.0/grids/${encodeURIComponent(gridId)}`,
    );
    expect(gridGet.statusCode).toBe(200);
    const grid = (Array.isArray(gridGet.body) ? gridGet.body[0] : gridGet.body) as {
      id: string;
      label: string[];
    };
    expect(grid.id).toBe(gridId);
    expect(grid.label).toEqual([ORIGINAL_LABEL]);
  });

  it('POST softwareversion with hasGrid persists the junction; GET returns it', async () => {
    const gridId = uniqueId('grid');
    await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId,
      label: ['grid-roundtrip'],
      type: ['Grid'],
    });
    trackId('grids', gridId);

    const versionId = uniqueId('softwareversion');
    await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId,
      label: ['v-roundtrip'],
      type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }],
    });
    trackId('softwareversions', versionId);

    const got = await inject(
      app,
      'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    expect(got.statusCode).toBe(200);
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    expect(v.hasGrid?.map((g) => g.id)).toContain(gridId);
  });

  it('PUT softwareversion replaces hasGrid: old links removed, new links present', async () => {
    const gridA = uniqueId('grid');
    const gridB = uniqueId('grid');
    for (const [id, lbl] of [[gridA, 'A'], [gridB, 'B']] as const) {
      await inject(app, 'POST', '/v2.0.0/grids', {
        id, label: [lbl], type: ['Grid'],
      });
      trackId('grids', id);
    }

    const versionId = uniqueId('softwareversion');
    await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-put'], type: ['SoftwareVersion'],
      hasGrid: [{ id: gridA }],
    });
    trackId('softwareversions', versionId);

    const putRes = await inject(
      app,
      'PUT',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
      {
        id: versionId, label: ['v-put'], type: ['SoftwareVersion'],
        hasGrid: [{ id: gridB }],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);

    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    const ids = v.hasGrid?.map((g) => g.id) ?? [];
    expect(ids).toContain(gridB);
    expect(ids).not.toContain(gridA);
  });

  it('PUT softwareversion with hasGrid: [] removes all junction links', async () => {
    const gridId = uniqueId('grid');
    await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId, label: ['G'], type: ['Grid'],
    });
    trackId('grids', gridId);

    const versionId = uniqueId('softwareversion');
    await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-empty'], type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }],
    });
    trackId('softwareversions', versionId);

    const putRes = await inject(
      app, 'PUT',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
      {
        id: versionId, label: ['v-empty'], type: ['SoftwareVersion'],
        hasGrid: [],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);

    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    expect(v.hasGrid ?? []).toEqual([]);
  });

  it('POST softwareversion with duplicate hasGrid entries deduplicates without violating unique constraints', async () => {
    const gridId = uniqueId('grid');
    await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId, label: ['dup'], type: ['Grid'],
    });
    trackId('grids', gridId);

    const versionId = uniqueId('softwareversion');
    const res = await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-dup'], type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }, { id: gridId }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwareversions', versionId);

    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    expect(v.hasGrid?.length).toBe(1);
    expect(v.hasGrid?.[0].id).toBe(gridId);
  });

  it('POST softwareversion with hasGrid referencing a non-existent grid id returns 4xx', async () => {
    const fakeGridId = uniqueId('grid-does-not-exist');
    const versionId = uniqueId('softwareversion');
    const res = await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-bad-ref'], type: ['SoftwareVersion'],
      hasGrid: [{ id: fakeGridId }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);

    // The version itself should NOT have been created.
    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    expect([404, 200]).toContain(got.statusCode);
    if (got.statusCode === 200) {
      const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
        hasGrid?: { id: string }[];
      };
      expect(v?.hasGrid ?? []).toEqual([]);
      // If a row was actually created, track for cleanup.
      trackId('softwareversions', versionId);
    }
  });
});
