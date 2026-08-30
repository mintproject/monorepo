import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';

const API = process.env.MODEL_CATALOG_API_URL ?? 'http://localhost:3000/v2.0.0';
const TOKEN = process.env.TEST_BEARER_TOKEN;

const skipIfNoToken = TOKEN ? describe : describe.skip;

skipIfNoToken('integration: recursive nested writes', () => {
  const authHeader = { authorization: `Bearer ${TOKEN}` };
  const newId = (prefix: string) => `${prefix}-${randomUUID()}`;

  it('POST ModelConfiguration with nested DatasetSpecification + nested VariablePresentation persists all rows', async () => {
    const cfgId = newId('cfg');
    const dsId = newId('ds');
    const vpId = newId('vp');
    const res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({
        id: cfgId,
        label: 'nested test cfg',
        hasInput: [
          {
            id: dsId,
            label: 'nested ds',
            hasPresentation: [{ id: vpId, label: 'nested vp' }],
          },
        ],
      }),
    });
    expect(res.status).toBe(201);

    const got = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, { headers: authHeader });
    const cfg = await got.json();
    expect(cfg.label).toEqual(['nested test cfg']);
    expect((cfg.hasInput ?? [])[0]?.id).toBe(dsId);
    // The persisted hasPresentation is on the nested ds; fetch the ds:
    const dsRes = await fetch(`${API}/datasetspecifications/${encodeURIComponent(dsId)}`, { headers: authHeader });
    const ds = await dsRes.json();
    expect((ds.hasPresentation ?? [])[0]?.id).toBe(vpId);
  });

  it('PUT ModelConfiguration replacing hasInput drops old junction rows and inserts new', async () => {
    const cfgId = newId('cfg');
    const dsOld = newId('ds-old');
    const dsNew = newId('ds-new');

    // Create with one input
    let res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: cfgId, hasInput: [{ id: dsOld, label: 'old' }] }),
    });
    expect(res.status).toBe(201);

    // PUT with a different input
    res = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ hasInput: [{ id: dsNew, label: 'new' }] }),
    });
    expect(res.status).toBe(200);

    const got = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, { headers: authHeader });
    const cfg = await got.json();
    const inputIds = (cfg.hasInput ?? []).map((x: any) => x.id);
    expect(inputIds).toContain(dsNew);
    expect(inputIds).not.toContain(dsOld);
  });

  it('POST link-only payload does not clobber existing target scalars (bug-087 regression)', async () => {
    // Pre-create a DatasetSpecification with a known label
    const dsId = newId('ds-precreate');
    let res = await fetch(`${API}/datasetspecifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: dsId, label: 'preserved label' }),
    });
    expect(res.status).toBe(201);

    // Create a ModelConfiguration that LINKS to it (id-only payload)
    const cfgId = newId('cfg');
    res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: cfgId, hasInput: [{ id: dsId }] }),
    });
    expect(res.status).toBe(201);

    // Verify ds label preserved
    const got = await fetch(`${API}/datasetspecifications/${encodeURIComponent(dsId)}`, { headers: authHeader });
    const ds = await got.json();
    expect(ds.label).toEqual(['preserved label']);
  });

  it('PUT FK violation on wrong-type id returns 400 with hint', async () => {
    const cfgId = newId('cfg-fkfail');
    const vpId = newId('vp-wrongtype');

    // Pre-create a VariablePresentation
    let res = await fetch(`${API}/variablepresentations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: vpId, label: 'vp' }),
    });
    expect(res.status).toBe(201);

    // Create a ModelConfiguration first
    res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ id: cfgId, label: 'fk fail test' }),
    });
    expect(res.status).toBe(201);

    // Attempt to PUT VP id where DatasetSpecification expected
    res = await fetch(`${API}/modelconfigurations/${encodeURIComponent(cfgId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ hasInput: [{ id: vpId }] }),
    });
    expect(res.status).toBe(400);
    const errBody = await res.json();
    expect(errBody.error).toMatch(/wrong resource type/);
  });

  it('rejects string-id form with 400 STRING_ID_DEPRECATED', async () => {
    const res = await fetch(`${API}/modelconfigurations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader },
      body: JSON.stringify({ label: 'test', hasInput: ['some-ds-id'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('STRING_ID_DEPRECATED');
  });
});
