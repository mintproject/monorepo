import { v4 as uuidv4 } from 'uuid';

const MINT_URI_PREFIX = 'https://w3id.org/okn/i/mint/';

/**
 * Generate a MINT-style URI for new entities.
 * Format: https://w3id.org/okn/i/mint/{uuid}
 */
export function generateMintUri(): string {
  return `${MINT_URI_PREFIX}${uuidv4()}`;
}

/**
 * Extract the UUID portion from a MINT URI.
 */
export function extractUuidFromUri(uri: string): string {
  return uri.replace(MINT_URI_PREFIX, '');
}

/**
 * Derive a URL slug from a catalog URI: the trailing path segment.
 * Works regardless of host/namespace (catalog data mixes prefixes), so it is
 * more robust than stripping a fixed prefix.
 */
export function slugFromUri(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

/**
 * Build a Hasura `_ilike` pattern that suffix-matches a URI by its slug.
 * Used to resolve a deep-link slug back to a full configuration id.
 */
export function slugMatchPattern(slug: string): string {
  return `%/${slug}`;
}
