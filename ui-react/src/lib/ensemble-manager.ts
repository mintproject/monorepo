/**
 * Ensemble Manager REST calls.
 *
 * These are the only two places the app talks to mint-ensemble-manager over
 * REST (everything else goes through Hasura). Both need the user's access
 * token, so the Authorization header is built here, once.
 *
 * Why one place: the two call sites used to read the token from localStorage
 * by string literal, the literal did not match the key `token-store` writes,
 * and the header was spread conditionally — so every call went out anonymous
 * with no error (#85).
 */
import { getAccessToken } from './auth/token-store';

/**
 * Request headers for the Ensemble Manager, carrying the stored access token
 * as a Bearer credential. The header is omitted when no token is stored, so
 * anonymous calls stay possible.
 */
export function ensembleManagerHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken();
  return { ...base, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/**
 * Submission route for an execution engine.
 *
 * The Ensemble Manager does not serve one route per engine under a common
 * prefix: the two older backends predate `/executionEngines` and kept their
 * own paths (`server.ts` mounts `/executionsLocal`, `/executions` and
 * `/executionEngines` separately, and the last registers `/tapis` alone). So
 * `/executionEngines/${engine}` is right for Tapis and a 404 for the other
 * two — which is what #88 was. Same mapping the legacy UI makes in
 * `ui/src/screens/modeling/thread/mint-runs.ts`.
 *
 * An unrecognised engine falls through to `/executionEngines/<engine>`, where
 * any newer backend is mounted.
 */
export function executionEnginePath(executionEngine: string): string {
  if (executionEngine === 'localex') return '/executionsLocal';
  if (executionEngine === 'wings') return '/executions';
  return `/executionEngines/${executionEngine}`;
}

/** Submit a thread's model runs to an execution engine. */
export async function submitRuns(
  ensembleManagerApi: string,
  executionEngine: string,
  /** `thread_id` is optional only so an absent route param serialises as it did before. */
  body: { thread_id: string | undefined; model_id: string },
): Promise<void> {
  const resp = await fetch(`${ensembleManagerApi}${executionEnginePath(executionEngine)}`, {
    method: 'POST',
    headers: ensembleManagerHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Ensemble manager returned ${resp.status}`);
  }
}

/** Fetch the raw log text for one execution. Caller handles ANSI cleanup. */
export async function fetchExecutionLog(
  ensembleManagerApi: string,
  executionId: string,
  signal?: AbortSignal,
): Promise<string> {
  const resp = await fetch(`${ensembleManagerApi}/executions/${executionId}/logs`, {
    signal,
    headers: ensembleManagerHeaders(),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}
