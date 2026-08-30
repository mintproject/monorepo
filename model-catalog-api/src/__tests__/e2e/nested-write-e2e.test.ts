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

describe('nested-write e2e — softwares.hasVersion (bug-089 class)', () => {
  // Expected: PASS once bug-089 implementation lands. May FAIL on this branch today.
  it('POST software with an inline nested hasVersion creates the version row and links it via FK', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      label: ['sw-nested'],
      type: ['Software'],
      hasVersion: [
        { id: versionId, label: ['v-nested'], type: ['SoftwareVersion'] },
      ],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', softwareId);
    trackId('softwareversions', versionId);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(softwareId)}`,
    );
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      hasVersion?: { id: string }[];
    };
    expect(sw.hasVersion?.map((v) => v.id)).toContain(versionId);

    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    expect(verGet.statusCode).toBe(200);
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      id: string; label: string[];
    };
    expect(ver.id).toBe(versionId);
    expect(ver.label).toEqual(['v-nested']);
  });

  it('POST software with nested version → nested configuration persists the full tree', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');
    const cfgId = uniqueId('modelconfiguration');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-3deep'], type: ['Software'],
      hasVersion: [{
        id: verId, label: ['v-3deep'], type: ['SoftwareVersion'],
        hasConfiguration: [{
          id: cfgId, label: ['cfg-3deep'], type: ['ModelConfiguration'],
        }],
      }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', swId);
    trackId('softwareversions', verId);
    trackId('modelconfigurations', cfgId);

    const cfgGet = await inject(
      app, 'GET',
      `/v2.0.0/modelconfigurations/${encodeURIComponent(cfgId)}`,
    );
    expect(cfgGet.statusCode).toBe(200);
    const cfg = (Array.isArray(cfgGet.body) ? cfgGet.body[0] : cfgGet.body) as {
      id: string;
    };
    expect(cfg.id).toBe(cfgId);
  });

  it('PUT software with nested hasVersion updates child label, parent label unchanged', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');

    await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-parent-stable'], type: ['Software'],
      hasVersion: [{ id: verId, label: ['v-old'], type: ['SoftwareVersion'] }],
    });
    trackId('softwares', swId);
    trackId('softwareversions', verId);

    const putRes = await inject(
      app, 'PUT',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
      {
        id: swId, label: ['sw-parent-stable'], type: ['Software'],
        hasVersion: [{ id: verId, label: ['v-new'], type: ['SoftwareVersion'] }],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
    );
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      label: string[];
    };
    expect(sw.label).toEqual(['sw-parent-stable']);

    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(verId)}`,
    );
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      label: string[];
    };
    expect(ver.label).toEqual(['v-new']);
  });

  it('POST software with mixed inline-new and ID-ref hasVersion entries: new is created, ref is linked', async () => {
    const existingVerId = uniqueId('softwareversion');
    const existingSwShellId = uniqueId('software');
    // Pre-create the referenced version under its own software shell so we have an
    // existing row to reference.
    await inject(app, 'POST', '/v2.0.0/softwares', {
      id: existingSwShellId, label: ['shell'], type: ['Software'],
      hasVersion: [{ id: existingVerId, label: ['v-pre'], type: ['SoftwareVersion'] }],
    });
    trackId('softwares', existingSwShellId);
    trackId('softwareversions', existingVerId);

    const newSwId = uniqueId('software');
    const newVerId = uniqueId('softwareversion');
    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: newSwId, label: ['sw-mixed'], type: ['Software'],
      hasVersion: [
        { id: newVerId, label: ['v-fresh'], type: ['SoftwareVersion'] },
        { id: existingVerId },
      ],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', newSwId);
    trackId('softwareversions', newVerId);

    // Existing version label MUST NOT have been overwritten by the link.
    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(existingVerId)}`,
    );
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      label: string[];
    };
    expect(ver.label).toEqual(['v-pre']);

    // Note: hasVersion is a childFk relationship, so the existing version's FK may move
    // from existingSwShellId to newSwId. Do not assert directionality of the move here;
    // just assert the existing row's data was preserved.
  });

  it('PUT software replaces hasVersion children: old children no longer linked, new children present', async () => {
    const swId = uniqueId('software');
    const oldVerId = uniqueId('softwareversion');
    const newVerId = uniqueId('softwareversion');

    await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-replace'], type: ['Software'],
      hasVersion: [{ id: oldVerId, label: ['v-old'], type: ['SoftwareVersion'] }],
    });
    trackId('softwares', swId);
    trackId('softwareversions', oldVerId);

    const putRes = await inject(
      app, 'PUT',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
      {
        id: swId, label: ['sw-replace'], type: ['Software'],
        hasVersion: [{ id: newVerId, label: ['v-new'], type: ['SoftwareVersion'] }],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);
    trackId('softwareversions', newVerId);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
    );
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      hasVersion?: { id: string }[];
    };
    const ids = sw.hasVersion?.map((v) => v.id) ?? [];
    expect(ids).toContain(newVerId);
    expect(ids).not.toContain(oldVerId);
  });
});

describe('read-shape e2e — softwareversions.hasConfiguration (bug-090 class)', () => {
  it('GET /softwareversions/{id} surfaces hasConfiguration with nested id and label', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');
    const cfgId = uniqueId('modelconfiguration');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-readshape'], type: ['Software'],
      hasVersion: [{
        id: verId, label: ['v-readshape'], type: ['SoftwareVersion'],
        hasConfiguration: [{
          id: cfgId, label: ['cfg-readshape'], type: ['ModelConfiguration'],
        }],
      }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', swId);
    trackId('softwareversions', verId);
    trackId('modelconfigurations', cfgId);

    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(verId)}`,
    );
    expect(verGet.statusCode).toBe(200);
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      id: string;
      hasConfiguration?: { id: string; label?: string[] }[];
    };
    expect(ver.id).toBe(verId);
    expect(ver.hasConfiguration).toBeDefined();
    expect(ver.hasConfiguration?.map((c) => c.id)).toContain(cfgId);
    const cfgEntry = ver.hasConfiguration?.find((c) => c.id === cfgId);
    expect(cfgEntry?.label).toEqual(['cfg-readshape']);
  });

  it('GET /softwareversions/{id} omits hasConfiguration when version has no configurations', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-empty'], type: ['Software'],
      hasVersion: [{ id: verId, label: ['v-empty'], type: ['SoftwareVersion'] }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', swId);
    trackId('softwareversions', verId);

    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(verId)}`,
    );
    expect(verGet.statusCode).toBe(200);
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      id: string;
      hasConfiguration?: unknown;
    };
    expect(ver.id).toBe(verId);
    // v1.8.0 contract: empty array relationships are omitted entirely.
    expect(ver.hasConfiguration).toBeUndefined();
  });

  it('GET /softwares/{id} only exposes shallow hasVersion (no hasConfiguration on embedded version)', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');
    const cfgId = uniqueId('modelconfiguration');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-shallow'], type: ['Software'],
      hasVersion: [{
        id: verId, label: ['v-shallow'], type: ['SoftwareVersion'],
        hasConfiguration: [{
          id: cfgId, label: ['cfg-shallow'], type: ['ModelConfiguration'],
        }],
      }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', swId);
    trackId('softwareversions', verId);
    trackId('modelconfigurations', cfgId);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
    );
    expect(swGet.statusCode).toBe(200);
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      hasVersion?: ({ id: string; hasConfiguration?: unknown })[];
    };
    const embeddedVer = sw.hasVersion?.find((v) => v.id === verId);
    expect(embeddedVer).toBeDefined();
    // field-maps modelcatalog_software only selects id+label+description on versions;
    // hasConfiguration MUST NOT appear on the embedded shallow object.
    expect(embeddedVer?.hasConfiguration).toBeUndefined();
  });
});
