/**
 * Response mapper: transforms Hasura query results to v1.8.0 API response format.
 *
 * v1.8.0 contract rules (derived from live API inspection):
 * 1. `id` field stays as-is (URI string, NOT array-wrapped)
 * 2. `type` field is synthesized from resourceConfig.typeArray
 * 3. All other scalar fields are wrapped in single-element arrays: value -> [value]
 * 4. Null/undefined fields are OMITTED entirely (not null, not empty array)
 * 5. Field names are converted from snake_case (Hasura) to camelCase (API)
 * 6. Related objects (Hasura object_relationships) become nested objects with id and type
 * 7. Related arrays (Hasura array_relationships) become arrays of nested objects
 */

import type { ResourceConfig } from './resource-registry.js';
import { RESOURCE_REGISTRY } from './resource-registry.js';

/**
 * Convert a snake_case string to camelCase.
 * Examples: "has_documentation" -> "hasDocumentation", "date_created" -> "dateCreated"
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Transform a single Hasura row to the v1.8.0 JSON response shape.
 *
 * @param row - Raw Hasura row (snake_case column names, plain scalar values)
 * @param resourceConfig - The resource config for this row's type
 * @param depth - Recursion depth guard (prevents infinite nesting; max 2 levels)
 * @returns v1.8.0-shaped object with array-wrapped scalars, synthesized type, omitted nulls
 */
export function transformRow(
  row: Record<string, unknown>,
  resourceConfig: ResourceConfig,
  depth = 0,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Step 1: Set id (URI string, no array wrapping)
  if (row['id'] !== null && row['id'] !== undefined) {
    result['id'] = row['id'];
  }

  // Step 2: Synthesize type field from resourceConfig
  result['type'] = resourceConfig.typeArray;

  // Step 3: Build a set of known relationship field names (snake_case Hasura names)
  // so we can skip them in the scalar loop below
  const relationshipHasuraNames = new Set(
    Object.values(resourceConfig.relationships).map((rel) => rel.hasuraRelName),
  );

  // Step 4: Process all scalar fields (skip id, and any relationship fields)
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id') continue;
    if (relationshipHasuraNames.has(key)) continue;

    // Skip null/undefined values entirely
    if (value === null || value === undefined) continue;

    // Convert snake_case key to camelCase
    const camelKey = snakeToCamel(key);

    // Wrap scalar in array (v1.8.0 contract)
    result[camelKey] = [value];
  }

  // Step 5: Process relationship fields (if present in the row and depth allows)
  if (depth < 2) {
    for (const [apiFieldName, relConfig] of Object.entries(resourceConfig.relationships)) {
      const relValue = row[relConfig.hasuraRelName];

      if (relValue === null || relValue === undefined) continue;

      // Find the target resource config for nested type synthesis
      const targetConfig = RESOURCE_REGISTRY[relConfig.targetResource];

      if (relConfig.type === 'object') {
        // Single related object: transform recursively
        const nestedRow = relValue as Record<string, unknown>;
        if (targetConfig) {
          result[apiFieldName] = [transformRow(nestedRow, targetConfig, depth + 1)];
        } else {
          // Fallback: just include id if available
          const nestedId = nestedRow['id'];
          if (nestedId !== null && nestedId !== undefined) {
            result[apiFieldName] = [{ id: nestedId }];
          }
        }
      } else {
        // Array of related objects: transform each one
        const relArray = relValue as Array<Record<string, unknown>>;
        if (!Array.isArray(relArray) || relArray.length === 0) continue;

        if (targetConfig) {
          // If this relationship goes through a junction table, each item is a junction row.
          // The actual target entity is nested under junctionRelName inside the junction row.
          const junctionRelName = relConfig.junctionRelName;
          const transformed = relArray
            .map((item) => {
              // Junction traversal: extract the nested target entity if junctionRelName is set
              // and the nested entity exists as a key in the junction row.
              const targetRow = (junctionRelName && item[junctionRelName] != null)
                ? item[junctionRelName] as Record<string, unknown>
                : item;
              return transformRow(targetRow, targetConfig, depth + 1);
            })
            .filter((item) => item['id'] !== null && item['id'] !== undefined);
          if (transformed.length > 0) {
            result[apiFieldName] = transformed;
          }
        } else {
          // Fallback: include id-only objects (no target config found)
          const idOnly = relArray
            .filter((item) => item['id'] !== null && item['id'] !== undefined)
            .map((item) => ({ id: item['id'] }));
          if (idOnly.length > 0) {
            result[apiFieldName] = idOnly;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Transform an array of Hasura rows to v1.8.0 response format.
 *
 * @param rows - Array of raw Hasura rows
 * @param resourceConfig - The resource config for these rows' type
 * @returns Array of v1.8.0-shaped objects
 */
export function transformList(
  rows: Record<string, unknown>[],
  resourceConfig: ResourceConfig,
): Record<string, unknown>[] {
  return rows.map((row) => transformRow(row, resourceConfig));
}
