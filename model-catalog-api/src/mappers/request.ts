/**
 * Request mapper: transforms v1.8.0 API request bodies to Hasura insert/update format.
 *
 * This is the reverse of the response transformer:
 * 1. Unwrap single-element arrays back to scalars
 * 2. Convert camelCase field names to snake_case
 * 3. Extract `id` as-is
 * 4. Ignore `type` field (not stored in Hasura)
 * 5. Handle nested related objects by extracting their IDs for FK columns
 */

import type { ResourceConfig } from './resource-registry.js';

/**
 * Convert a camelCase string to snake_case.
 * Examples: "hasDocumentation" -> "has_documentation", "dateCreated" -> "date_created"
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, (letter: string) => `_${letter.toLowerCase()}`);
}

/**
 * Unwrap a v1.8.0 field value back to a scalar.
 * Single-element arrays are unwrapped: ["value"] -> "value"
 * Empty arrays are treated as null (will be omitted).
 * Non-array values are returned as-is.
 */
function unwrapValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 1) return value[0];
    // Multi-element arrays: return the array as-is (Hasura handles array columns)
    return value;
  }
  return value;
}

/**
 * Transform a v1.8.0 API request body to Hasura insert/update input format.
 *
 * @param body - v1.8.0 JSON request body (camelCase keys, array-wrapped scalars)
 * @param resourceConfig - The resource config for this resource type
 * @returns Flat Hasura column object (snake_case keys, unwrapped scalar values)
 */
export function toHasuraInput(
  body: Record<string, unknown>,
  resourceConfig: ResourceConfig,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Build a set of known API relationship field names (camelCase) -> skip from scalar processing
  const relationshipApiNames = new Set(Object.keys(resourceConfig.relationships));

  for (const [key, value] of Object.entries(body)) {
    // Skip type field: not stored in Hasura
    if (key === 'type') continue;

    // id field: pass through as-is (already a URI string)
    if (key === 'id') {
      if (value !== null && value !== undefined) {
        result['id'] = value;
      }
      continue;
    }

    // Skip relationship fields -- they are handled separately as FK updates
    // The caller is responsible for extracting IDs from nested objects
    if (relationshipApiNames.has(key)) continue;

    // Unwrap scalar value
    const unwrapped = unwrapValue(value);

    // Omit null/undefined values
    if (unwrapped === null || unwrapped === undefined) continue;

    // Convert camelCase to snake_case for Hasura column name
    const snakeKey = camelToSnake(key);
    result[snakeKey] = unwrapped;
  }

  return result;
}
