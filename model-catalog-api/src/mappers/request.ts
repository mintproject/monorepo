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

import { randomUUID } from 'crypto';
import { FIELD_SELECTIONS } from '../hasura/field-maps.js';
import { getResourceConfig, type ResourceConfig } from './resource-registry.js';

const ID_PREFIX = 'https://w3id.org/okn/i/mint/';

/** Cache of parsed scalar column sets per table name */
const scalarColumnsCache = new Map<string, Set<string>>();

/**
 * Parse the field selection string for a Hasura table and return the set of
 * scalar column names (lines that are plain identifiers with no `{` or `}`).
 */
function getScalarColumns(tableName: string): Set<string> {
  const cached = scalarColumnsCache.get(tableName);
  if (cached) return cached;

  const selection = FIELD_SELECTIONS[tableName];
  if (!selection) {
    const empty = new Set<string>();
    scalarColumnsCache.set(tableName, empty);
    return empty;
  }

  const columns = new Set<string>();
  for (const rawLine of selection.split('\n')) {
    const line = rawLine.trim();
    // Skip blank lines and lines that open/close relationship blocks
    if (!line || line.includes('{') || line.includes('}')) continue;
    // Only keep simple identifiers (no spaces, no special chars)
    if (/^\w+$/.test(line)) {
      columns.add(line);
    }
  }

  scalarColumnsCache.set(tableName, columns);
  return columns;
}

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
 *
 * Non-primitive values (objects, nested arrays) are rejected and returned as
 * null so they get omitted rather than forwarded to Hasura scalar columns.
 * This prevents "parsing Text failed, expected String, but encountered Object"
 * errors when clients send placeholder values like intervalUnit:[{}].
 */
function unwrapValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 1) {
      const item = value[0];
      // Reject non-primitive values (objects, arrays) -- Hasura scalar columns
      // cannot store objects. This handles cases like intervalUnit:[{}] where
      // the client sends an empty object placeholder instead of a string value.
      if (item !== null && typeof item === 'object') return null;
      return item;
    }
    // Multi-element arrays: filter out non-primitive items
    const filtered = value.filter(
      (item) => item === null || typeof item !== 'object'
    );
    return filtered.length > 0 ? filtered : null;
  }
  // Non-array objects at top level should also be rejected for scalar columns
  if (value !== null && typeof value === 'object') return null;
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

  // Get the valid scalar columns for this resource's Hasura table
  const scalarColumns =
    resourceConfig.hasuraTable !== null ? getScalarColumns(resourceConfig.hasuraTable) : new Set<string>();

  for (const [key, value] of Object.entries(body)) {
    // Skip type field: not stored in Hasura
    if (key === 'type') continue;

    // id field: pass through as-is (always valid; checked before column validation)
    if (key === 'id') {
      if (value !== null && value !== undefined) {
        result['id'] = value;
      }
      continue;
    }

    // Skip relationship fields -- they are handled separately as FK updates
    // The caller is responsible for extracting IDs from nested objects
    if (relationshipApiNames.has(key)) continue;

    // Convert camelCase to snake_case for Hasura column name
    const snakeKey = camelToSnake(key);

    // Drop unknown fields: only allow known scalar columns for this table
    if (!scalarColumns.has(snakeKey)) continue;

    // Unwrap scalar value
    const unwrapped = unwrapValue(value);

    // Omit null/undefined values
    if (unwrapped === null || unwrapped === undefined) continue;

    result[snakeKey] = unwrapped;
  }

  return result;
}

/**
 * Build Hasura nested insert objects for all junction-based relationships
 * found in the request body. Per D-03, these are included in a single
 * atomic mutation (not sequential inserts). Per D-04, on_conflict with
 * update_columns:[] handles link-or-create.
 *
 * @param body - v1.8.0 JSON request body (camelCase keys)
 * @param resourceConfig - The resource config for this resource type
 * @returns Map of Hasura relationship names to nested insert objects
 */
export function buildJunctionInserts(
  body: Record<string, unknown>,
  resourceConfig: ResourceConfig,
): Record<string, unknown> {
  const junctionData: Record<string, unknown> = {};

  for (const [apiFieldName, relConfig] of Object.entries(resourceConfig.relationships)) {
    // Skip non-junction relationships (per D-06: only junction-based)
    if (!relConfig.junctionTable || !relConfig.junctionRelName) continue;

    const rawValue = body[apiFieldName];
    if (rawValue === undefined || rawValue === null) continue;

    // Normalize: accept both array-of-objects and array-of-strings (Pitfall 6)
    const items: Record<string, unknown>[] = [];
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (typeof item === 'string') {
          items.push({ id: item });
        } else if (item !== null && typeof item === 'object') {
          items.push(item as Record<string, unknown>);
        }
      }
    }

    // Resolve target resource config for the constraint name
    const targetConfig = getResourceConfig(relConfig.targetResource);
    const targetTable = targetConfig?.hasuraTable;
    if (!targetTable) continue; // target has no backing table, skip

    junctionData[relConfig.hasuraRelName] = {
      data: items.map((item) => {
        const nestedData: Record<string, unknown> = {};

        // Resolve ID: full URI passes through, short ID gets prefix prepended
        const rawId = item['id'] as string | undefined;
        if (rawId) {
          nestedData['id'] = rawId.startsWith('https://') ? rawId : `${ID_PREFIX}${rawId}`;
        } else {
          // D-02: generate UUID if no ID provided
          nestedData['id'] = `${ID_PREFIX}${randomUUID()}`;
        }

        // Copy scalar fields from nested object (camelCase -> snake_case)
        // Skip 'id' (already handled), 'type' (not stored)
        for (const [key, value] of Object.entries(item)) {
          if (key === 'id' || key === 'type') continue;
          const snakeKey = camelToSnake(key);
          const unwrapped = Array.isArray(value)
            ? value.length === 1
              ? value[0]
              : value.length === 0
                ? null
                : value
            : value;
          if (unwrapped !== null && unwrapped !== undefined) {
            nestedData[snakeKey] = unwrapped;
          }
        }

        return {
          [relConfig.junctionRelName!]: {
            data: nestedData,
            on_conflict: {
              constraint: `${targetTable}_pkey`,
              update_columns: [],
            },
          },
        };
      }),
      on_conflict: {
        constraint: `${relConfig.junctionTable}_pkey`,
        update_columns: [],
      },
    };
  }

  return junctionData;
}
