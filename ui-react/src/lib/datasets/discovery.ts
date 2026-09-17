import { searchSemanticCatalog, type SemanticSearchResult } from '@/hooks/useSemanticSearch';
import {
  canonicalStandardVariable,
  packagesMatchingCanonicalVariables,
  searchAllPackages,
  type CkanPackage,
} from './ckan';
import { mapDataset } from './data-catalog-api';
import type { DatasetDiscoveryResult } from './types';

export interface DatasetDiscoveryOptions {
  query?: string;
  variableLabels?: string[];
  limit?: number;
  signal?: AbortSignal;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = canonicalStandardVariable(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function packageVariables(pkg: CkanPackage): string[] {
  return unique(
    (pkg.resources ?? []).flatMap((resource) => {
      const raw = resource.mint_standard_variables;
      const values = Array.isArray(raw)
        ? raw.flatMap((value) => value.split(','))
        : typeof raw === 'string'
          ? raw.split(',')
          : [];
      return values.map(canonicalStandardVariable);
    }),
  );
}

function semanticRank(results: SemanticSearchResult[]): Map<string, SemanticSearchResult> {
  const byVariable = new Map<string, SemanticSearchResult>();
  for (const result of results) {
    const label = typeof result.label === 'string' ? result.label : '';
    const id = typeof result.id === 'string' ? result.id : '';
    for (const value of [label, id]) {
      const key = canonicalStandardVariable(value);
      if (key && !byVariable.has(key)) byVariable.set(key, result);
    }
  }
  return byVariable;
}

function enrich(
  packages: CkanPackage[],
  semanticResults: SemanticSearchResult[],
  limit: number,
): DatasetDiscoveryResult[] {
  const ranks = semanticRank(semanticResults);
  return packages
    .map((pkg) => {
      const variables = packageVariables(pkg);
      const matched = variables.filter((variable) =>
        ranks.has(canonicalStandardVariable(variable)),
      );
      const scores = matched
        .map((variable) => ranks.get(canonicalStandardVariable(variable))?.score)
        .filter((score): score is number => typeof score === 'number');
      const dataset = mapDataset(pkg);
      return {
        ...dataset,
        variables,
        matched_variables: matched,
        ...(scores.length ? { semantic_score: Math.max(...scores) } : {}),
      };
    })
    .sort(
      (a, b) => (b.semantic_score ?? 0) - (a.semantic_score ?? 0) || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

/**
 * Resolve natural language to SVOs, then retrieve CKAN datasets by exact
 * resource annotation. Browse mode uses OR semantics across resolved SVOs.
 */
export async function discoverDatasets(
  options: DatasetDiscoveryOptions,
): Promise<{ datasets: DatasetDiscoveryResult[]; semanticResults: SemanticSearchResult[] }> {
  const query = options.query?.trim() ?? '';
  const limit = options.limit ?? 50;
  let semanticResults: SemanticSearchResult[] = [];

  if (query) {
    semanticResults = await searchSemanticCatalog(query, {
      target: 'svo',
      limit: Math.min(limit, 25),
      signal: options.signal,
    });
  }

  const labels = unique([
    ...(options.variableLabels ?? []),
    ...semanticResults.flatMap((result) => {
      if (typeof result.label === 'string' && result.label.trim()) return [result.label];
      return typeof result.id === 'string' ? [result.id] : [];
    }),
  ]);

  if (labels.length === 0) {
    return { datasets: [], semanticResults };
  }

  const packages = await searchAllPackages({ signal: options.signal });
  const matched = packagesMatchingCanonicalVariables(packages, labels);
  return { datasets: enrich(matched, semanticResults, limit), semanticResults };
}
