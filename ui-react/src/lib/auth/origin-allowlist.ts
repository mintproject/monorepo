/**
 * Anti–open-redirect allowlist for OAuth2 callback forwarding.
 *
 * The fixed-origin callback page forwards the login result back to the
 * deployment that started the flow (carried in `state.origin`). That origin
 * MUST be validated here before we hand it the access token.
 */

/** Default: Vercel preview deployments of the `monorepo` project. */
export const DEFAULT_PREVIEW_ORIGIN_PATTERN =
  '^https://monorepo-git-[a-z0-9-]+-mosoriobs-projects\\.vercel\\.app$';

const LOCALHOST_PATTERN = /^http:\/\/localhost(:\d+)?$/;
const MAX_ORIGIN_LENGTH = 269; // hostname cap (253) + scheme/port slack

export interface AllowlistOptions {
  /** The single registered fixed origin (always allowed). */
  fixedOrigin?: string;
  /** Regex source string overriding DEFAULT_PREVIEW_ORIGIN_PATTERN. */
  patternSource?: string;
}

export function isAllowedOrigin(origin: string, opts: AllowlistOptions = {}): boolean {
  if (typeof origin !== 'string' || origin.length === 0 || origin.length > MAX_ORIGIN_LENGTH) {
    return false;
  }

  // Must be a well-formed absolute origin — no path, query, fragment, or userinfo.
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;

  if (LOCALHOST_PATTERN.test(origin)) return true;
  if (opts.fixedOrigin && origin === opts.fixedOrigin) return true;

  const source = opts.patternSource ?? DEFAULT_PREVIEW_ORIGIN_PATTERN;
  let re: RegExp;
  try {
    re = new RegExp(source);
  } catch {
    return false;
  }
  return re.test(origin);
}
