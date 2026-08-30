import { describe, it, expect } from 'vitest';
import { print, type DocumentNode } from 'graphql';
import { GetModelTreeDocument, GetModelFamiliesDocument } from '@/graphql/generated/graphql';
import { GetModelTreeWithRegionsDocument } from '@/graphql/generated/modeling';

/**
 * Regression guard for #98.
 *
 * `modelcatalog_software.type` classifies a model — Empirical, Coupled,
 * Theory-Guided, and so on. It does not say whether a row is a model. Every row
 * the ETL migrated matched `?id a sdm:Model` in the RDF, and the column holds
 * the most specific subtype found; rows written through the REST API's generic
 * `softwares` resource carry the ontology superclass `sd#Software`. So any
 * predicate on `type` hides real, runnable models.
 *
 * Against TACC's catalog the old `type: { _eq: "sdm#Model" }` predicate reduced
 * the model tree to 18 of 175 leaf configurations, and to 0 of the 61 that have
 * every required input annotated in CKAN.
 *
 * An allowlist of "model" subtypes is not the fix either. `model-catalog-api`
 * keeps one (`getSoftwareTypeFilter` in `service.ts`) and it is already stale —
 * it returns 44 of TACC's 55 software rows, silently dropping three subtypes it
 * was never taught plus every `sd#Software` row.
 */

const DOCUMENTS: Array<[string, DocumentNode]> = [
  ['GetModelTree', GetModelTreeDocument],
  ['GetModelFamilies', GetModelFamiliesDocument],
  ['GetModelTreeWithRegions', GetModelTreeWithRegionsDocument],
];

describe('model-tree queries do not filter software by ontology type', () => {
  it.each(DOCUMENTS)('%s selects modelcatalog_software', (_name, doc) => {
    expect(print(doc)).toContain('modelcatalog_software');
  });

  it.each(DOCUMENTS)('%s carries no type predicate', (_name, doc) => {
    expect(print(doc)).not.toContain('type:');
    expect(print(doc)).not.toContain('w3id.org/okn/o/sdm#');
    expect(print(doc)).not.toContain('w3id.org/okn/o/sd#');
  });

  it.each(DOCUMENTS)('%s passes modelcatalog_software no where argument', (_name, doc) => {
    const rootField = doc.definitions
      .flatMap((def) => (def.kind === 'OperationDefinition' ? def.selectionSet.selections : []))
      .find((sel) => sel.kind === 'Field' && sel.name.value === 'modelcatalog_software');

    expect(rootField).toBeDefined();
    const args = rootField && rootField.kind === 'Field' ? (rootField.arguments ?? []) : [];
    expect(args.map((a) => a.name.value)).toEqual(['order_by']);
  });
});
