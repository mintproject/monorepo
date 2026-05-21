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
