/**
 * GraphQL mock for Playwright E2E.
 *
 * Intercepts the single Hasura GraphQL endpoint and dispatches on the Apollo
 * `operationName` to a fixture (static JSON) or a resolver (variable-aware).
 * Unmocked operations FAIL LOUDLY (HTTP 500 + console warning) so a forgotten
 * fixture never produces a silently-green test.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** Load a fixture JSON by basename (without extension). */
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf-8'));
}

const searchAll = fixture('searchModelConfigurations.all');
const searchPihm = fixture('searchModelConfigurations.pihm');
const searchModflow = fixture('searchModelConfigurations.modflow');
const getRegions = fixture('getRegions');
const getModelCategoryOptions = fixture('getModelCategoryOptions');
const getOutputVariableOptions = fixture('getOutputVariableOptions');
const getConfiguration = fixture('getConfiguration') as {
  data: { modelcatalog_configuration_by_pk: { id: string } };
};
const getModelFamilies = fixture('getModelFamilies');
const prefetchReferenceData = fixture('prefetchReferenceData');

const MINT_PREFIX = 'https://w3id.org/okn/i/mint/';

interface GraphqlBody {
  operationName?: string;
  variables?: Record<string, unknown>;
}

type Resolver = (body: GraphqlBody) => unknown;

/**
 * Map of operationName -> fixture (object) or resolver (function of the request).
 * Server-side-filtered queries (SearchModelConfigurations) use a resolver so the
 * mocked list actually narrows in response to the compiled `where`.
 */
const handlers: Record<string, unknown | Resolver> = {
  GetRegions: getRegions,
  GetModelCategoryOptions: getModelCategoryOptions,
  GetOutputVariableOptions: getOutputVariableOptions,
  GetModelFamilies: getModelFamilies,
  PrefetchReferenceData: prefetchReferenceData,

  SearchModelConfigurations: ({ variables }) => {
    const where = JSON.stringify(variables?.where ?? {});
    if (/%PIHM%/i.test(where)) return searchPihm;
    if (where.includes('region-texas')) return searchModflow;
    return searchAll;
  },

  // Resolve a deep-link slug back to a full configuration id. The browse list
  // links to /modelconfigurations/<slug> where slug is the trailing URI segment,
  // so reconstructing PREFIX + slug round-trips to the fixture's configuration id.
  GetConfigurationBySlug: ({ variables }) => {
    const pattern = String(variables?.pattern ?? '');
    const slug = pattern.replace(/^%\//, '');
    return {
      data: {
        modelcatalog_configuration: slug
          ? [{ __typename: 'modelcatalog_configuration', id: `${MINT_PREFIX}${slug}` }]
          : [],
      },
    };
  },

  // Detail view (browse right pane + ConfigurePage). Echo the requested id so the
  // by_pk lookup resolves regardless of which configuration was opened.
  GetConfiguration: ({ variables }) => {
    const data = structuredClone(getConfiguration) as typeof getConfiguration;
    if (variables?.id) {
      data.data.modelcatalog_configuration_by_pk.id = String(variables.id);
    }
    return data;
  },

  CreateConfiguration: ({ variables }) => ({
    data: {
      insert_modelcatalog_configuration_one: {
        __typename: 'modelcatalog_configuration',
        id: variables?.id ?? `${MINT_PREFIX}new-config`,
        label: variables?.label ?? 'New model',
        software_version_id: variables?.softwareVersionId ?? null,
      },
    },
  }),
};

export async function mockGraphql(page: Page): Promise<void> {
  await page.route('**/v1/graphql', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as GraphqlBody;
    const op = body.operationName;
    const handler = op ? handlers[op] : undefined;

    if (handler === undefined) {
      console.warn(`[e2e] UNMOCKED GraphQL operation: ${op ?? '(anonymous)'}`);
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: `No fixture for operation: ${op}` }] }),
      });
    }

    const json = typeof handler === 'function' ? (handler as Resolver)(body) : handler;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json),
    });
  });
}
