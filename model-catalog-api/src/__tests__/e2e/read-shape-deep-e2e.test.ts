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

describe('read-shape-deep e2e — GET /modelconfigurations/{id}', () => {
  it('deep read returns Config → DSS → VP tree in one round trip', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');
    const inputAId = uniqueId('datasetspecification');
    const inputBId = uniqueId('datasetspecification');
    const outputAId = uniqueId('datasetspecification');
    const outputBId = uniqueId('datasetspecification');
    const outputCId = uniqueId('datasetspecification');
    const vpInAId = uniqueId('variablepresentation');
    const vpInBId = uniqueId('variablepresentation');
    const vpOutAId = uniqueId('variablepresentation');
    const vpOutBId = uniqueId('variablepresentation');
    const vpOutCId = uniqueId('variablepresentation');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      type: ['Software'],
      label: ['sw-deepread'],
      hasVersion: [
        {
          id: versionId,
          type: ['SoftwareVersion'],
          label: ['v-deepread'],
          hasConfiguration: [
            {
              id: configId,
              type: ['ModelConfiguration'],
              label: ['cfg-deepread'],
              hasInput: [
                { id: inputAId, type: ['DataSetSpecification'], label: ['input-A'],
                  hasPresentation: [{ id: vpInAId, type: ['VariablePresentation'], label: ['vp-input-A'], hasLongName: ['Input A long'], hasShortName: ['input-a'] }] },
                { id: inputBId, type: ['DataSetSpecification'], label: ['input-B'],
                  hasPresentation: [{ id: vpInBId, type: ['VariablePresentation'], label: ['vp-input-B'], hasLongName: ['Input B long'], hasShortName: ['input-b'] }] },
              ],
              hasOutput: [
                { id: outputAId, type: ['DataSetSpecification'], label: ['output-A'],
                  hasPresentation: [{ id: vpOutAId, type: ['VariablePresentation'], label: ['vp-output-A'], hasLongName: ['Output A long'], hasShortName: ['output-a'] }] },
                { id: outputBId, type: ['DataSetSpecification'], label: ['output-B'],
                  hasPresentation: [{ id: vpOutBId, type: ['VariablePresentation'], label: ['vp-output-B'], hasLongName: ['Output B long'], hasShortName: ['output-b'] }] },
                { id: outputCId, type: ['DataSetSpecification'], label: ['output-C'],
                  hasPresentation: [{ id: vpOutCId, type: ['VariablePresentation'], label: ['vp-output-C'], hasLongName: ['Output C long'], hasShortName: ['output-c'] }] },
              ],
            },
          ],
        },
      ],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('variablepresentations', vpInAId);
    trackId('variablepresentations', vpInBId);
    trackId('variablepresentations', vpOutAId);
    trackId('variablepresentations', vpOutBId);
    trackId('variablepresentations', vpOutCId);
    trackId('datasetspecifications', inputAId);
    trackId('datasetspecifications', inputBId);
    trackId('datasetspecifications', outputAId);
    trackId('datasetspecifications', outputBId);
    trackId('datasetspecifications', outputCId);
    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    const get = await inject(app, 'GET', `/v2.0.0/modelconfigurations/${encodeURIComponent(configId)}`);
    expect(get.statusCode).toBe(200);

    type VP = { id: string; label?: string[]; hasShortName?: string[]; hasLongName?: string[]; standardVariable?: unknown; unit?: unknown };
    type DSS = { id: string; label?: string[]; hasPresentation?: VP[] };
    type Cfg = { id: string; hasInput?: DSS[]; hasOutput?: DSS[] };
    const cfg = (Array.isArray(get.body) ? get.body[0] : get.body) as Cfg;

    expect(cfg.id).toBe(configId);
    expect(cfg.hasInput?.length).toBe(2);
    expect(cfg.hasOutput?.length).toBe(3);

    for (const dss of [...(cfg.hasInput ?? []), ...(cfg.hasOutput ?? [])]) {
      expect(dss.hasPresentation).toBeDefined();
      expect(dss.hasPresentation!.length).toBeGreaterThan(0);
      const vp = dss.hasPresentation![0];
      expect(typeof vp.id).toBe('string');
      expect(vp.label).toBeDefined();
      expect(vp.hasShortName).toBeDefined();
    }

    const firstVp = cfg.hasOutput![0].hasPresentation![0];
    expect(firstVp.standardVariable).toBeUndefined();
    expect(firstVp.unit).toBeUndefined();

    const inVpIds = new Set(cfg.hasInput!.flatMap((d) => d.hasPresentation!.map((v) => v.id)));
    const outVpIds = new Set(cfg.hasOutput!.flatMap((d) => d.hasPresentation!.map((v) => v.id)));
    expect(inVpIds).toEqual(new Set([vpInAId, vpInBId]));
    expect(outVpIds).toEqual(new Set([vpOutAId, vpOutBId, vpOutCId]));
  });

  it('preserves isOptional junction-column hoist alongside hasPresentation', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');
    const inputId = uniqueId('datasetspecification');
    const vpId = uniqueId('variablepresentation');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      type: ['Software'],
      label: ['sw-isopt'],
      hasVersion: [{ id: versionId, type: ['SoftwareVersion'], label: ['v-isopt'],
        hasConfiguration: [{ id: configId, type: ['ModelConfiguration'], label: ['cfg-isopt'],
          hasInput: [{ id: inputId, type: ['DataSetSpecification'], label: ['optional-input'], isOptional: true,
            hasPresentation: [{ id: vpId, type: ['VariablePresentation'], label: ['vp-isopt'], hasShortName: ['opt-vp'] }] }] }] }],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('variablepresentations', vpId);
    trackId('datasetspecifications', inputId);
    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    const get = await inject(app, 'GET', `/v2.0.0/modelconfigurations/${encodeURIComponent(configId)}`);
    expect(get.statusCode).toBe(200);

    type VP = { id: string };
    type DSS = { id: string; isOptional?: boolean; hasPresentation?: VP[] };
    type Cfg = { id: string; hasInput?: DSS[] };
    const cfg = (Array.isArray(get.body) ? get.body[0] : get.body) as Cfg;

    const target = cfg.hasInput?.find((d) => d.id === inputId);
    expect(target).toBeDefined();
    expect(target!.isOptional).toBe(true);
    expect(target!.hasPresentation).toBeDefined();
    expect(target!.hasPresentation![0].id).toBe(vpId);
  });

  it('list path GET /modelconfigurations does NOT include hasPresentation', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');
    const inputId = uniqueId('datasetspecification');
    const vpId = uniqueId('variablepresentation');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId, type: ['Software'], label: ['sw-list-lean'],
      hasVersion: [{ id: versionId, type: ['SoftwareVersion'], label: ['v-list-lean'],
        hasConfiguration: [{ id: configId, type: ['ModelConfiguration'], label: ['cfg-list-lean'],
          hasInput: [{ id: inputId, type: ['DataSetSpecification'], label: ['input-list-lean'],
            hasPresentation: [{ id: vpId, type: ['VariablePresentation'], label: ['vp-list-lean'], hasShortName: ['list-lean-vp'] }] }] }] }],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('variablepresentations', vpId);
    trackId('datasetspecifications', inputId);
    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    const list = await inject(app, 'GET', '/v2.0.0/modelconfigurations?label=cfg-list-lean&per_page=10');
    expect(list.statusCode).toBe(200);

    type VP = { id: string };
    type DSS = { id: string; label?: string[]; hasPresentation?: VP[] };
    type Cfg = { id: string; hasInput?: DSS[] };
    const rows = list.body as Cfg[];
    expect(Array.isArray(rows)).toBe(true);

    const row = rows.find((r) => r.id === configId);
    expect(row).toBeDefined();
    expect(row!.hasInput?.length).toBeGreaterThan(0);
    const firstInput = row!.hasInput![0];
    expect(firstInput.id).toBeDefined();
    expect(firstInput.label).toBeDefined();
    expect(firstInput.hasPresentation).toBeUndefined();
  });

  it('config with zero inputs/outputs returns no hasInput/hasOutput keys', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');
    const configId = uniqueId('modelconfiguration');

    const post = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId, type: ['Software'], label: ['sw-empty'],
      hasVersion: [{ id: versionId, type: ['SoftwareVersion'], label: ['v-empty'],
        hasConfiguration: [{ id: configId, type: ['ModelConfiguration'], label: ['cfg-empty'] }] }],
    });
    expect(post.statusCode).toBeGreaterThanOrEqual(200);
    expect(post.statusCode).toBeLessThan(300);

    trackId('modelconfigurations', configId);
    trackId('softwareversions', versionId);
    trackId('softwares', softwareId);

    const get = await inject(app, 'GET', `/v2.0.0/modelconfigurations/${encodeURIComponent(configId)}`);
    expect(get.statusCode).toBe(200);

    type Cfg = { id: string; hasInput?: unknown; hasOutput?: unknown };
    const cfg = (Array.isArray(get.body) ? get.body[0] : get.body) as Cfg;
    expect(cfg.id).toBe(configId);
    expect(cfg.hasInput).toBeUndefined();
    expect(cfg.hasOutput).toBeUndefined();
  });
});
