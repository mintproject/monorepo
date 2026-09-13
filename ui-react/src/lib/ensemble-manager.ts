/**
 * Ensemble Manager REST calls.
 *
 * These are the only places the app talks to mint-ensemble-manager over REST
 * (everything else goes through Hasura). All of them need the user's access
 * token, so the Authorization header is built here, once.
 *
 * Why one place: the two call sites used to read the token from localStorage
 * by string literal, the literal did not match the key `token-store` writes,
 * and the header was spread conditionally — so every call went out anonymous
 * with no error (#85).
 */
import { getAccessToken } from './auth/token-store';

/**
 * A failed Ensemble Manager response, carrying the machine-readable `code` the
 * server sends beside the message.
 *
 * The status alone does not say what to do about it. `NO_OUTPUTS_DECLARED`
 * (422) means the model configuration declares no output — a state the user
 * fixes by promoting a file from a finished run, not an error to read and
 * dismiss (#267). `message` keeps the shape the Results step already renders.
 */
export class EnsembleManagerError extends Error {
  readonly status: number;
  /** The server's own error code, when it sends one. */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'EnsembleManagerError';
    this.status = status;
    this.code = code;
  }
}

/** The code the server sends when a model configuration declares no output. */
export const NO_OUTPUTS_DECLARED = 'NO_OUTPUTS_DECLARED';

/**
 * Turn a failed response into an `EnsembleManagerError`.
 *
 * A body that is not JSON, or that carries no message, still yields the status
 * — the Results step showed a bare status before the server learned to explain
 * itself, and that path must keep working.
 */
async function toEnsembleManagerError(resp: Response): Promise<EnsembleManagerError> {
  const body = await resp
    .json()
    .then((parsed: { message?: string; code?: string }) => parsed)
    .catch(() => undefined);
  const message = body?.message
    ? `Ensemble manager returned ${resp.status}: ${body.message}`
    : `Ensemble manager returned ${resp.status}`;
  return new EnsembleManagerError(resp.status, message, body?.code);
}

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

/** The three path segments that address one thread on the publish routes. */
export interface SubtaskIds {
  problemStatementId: string;
  taskId: string;
  threadId: string;
}

/**
 * Base URL of one subtask (thread) on the Ensemble Manager.
 *
 * Each id is one path segment. TACC's are opaque and need no escaping, but the
 * legacy `mint://…/…` form carries slashes, which would otherwise split into
 * extra segments and miss the route entirely.
 */
function subtaskUrl(ensembleManagerApi: string, ids: SubtaskIds): string {
  return (
    `${ensembleManagerApi}/problemStatements/${encodeURIComponent(ids.problemStatementId)}` +
    `/tasks/${encodeURIComponent(ids.taskId)}` +
    `/subtasks/${encodeURIComponent(ids.threadId)}`
  );
}

/**
 * Register a thread's run outputs in the data catalog, so the Results step can
 * show them.
 *
 * The route publishes every execution under the *subtask* (thread), not under
 * one model, which is why `modelId` is not a parameter — the legacy UI calls
 * the same route from its own per-model button
 * (`ui/src/screens/modeling/thread/mint-results.ts:_fetchAllResults`).
 *
 * The server answers 400 `No executions found to publish` when every
 * per-execution registration threw, because it catches each one and counts
 * successes — so a 400 here means "all of them failed", not "there were none".
 * The caller surfaces the message rather than dropping it (#110).
 */
export async function publishResults(ensembleManagerApi: string, ids: SubtaskIds): Promise<void> {
  const resp = await fetch(`${subtaskUrl(ensembleManagerApi, ids)}/outputs`, {
    method: 'POST',
    headers: ensembleManagerHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    throw await toEnsembleManagerError(resp);
  }
}

/**
 * Register the outputs of ONE execution.
 *
 * Nothing republishes by itself, so this is the call behind the per-run
 * "Publish this execution now" button: the user promotes a file, then presses
 * it (#261). The bulk route above walks every execution of the thread instead.
 *
 * It answers the same 422 `NO_OUTPUTS_DECLARED` as the bulk route when the
 * model configuration declares no output.
 */
export async function publishExecution(
  ensembleManagerApi: string,
  ids: SubtaskIds,
  executionId: string,
): Promise<void> {
  const url = `${subtaskUrl(ensembleManagerApi, ids)}/executions/${encodeURIComponent(executionId)}/outputs`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: ensembleManagerHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    throw await toEnsembleManagerError(resp);
  }
}

/** One file that an execution archived. Mirrors the server's `ExecutionFile`. */
export interface ExecutionFile {
  /** The file name, without the folder. */
  name: string;
  /** The path on the archive system. It tells two files of the same name apart. */
  path: string;
  /** The size in bytes. */
  size: number;
  /** The `tapis://` URI. CKAN reads this URI as it is. */
  url: string;
}

/**
 * List the files that an execution archived.
 *
 * MINT stores none of these files: the server reads them live from Tapis with
 * the user's own token. An execution that archived nothing answers an empty
 * list, which is not an error — the run may still be on its way.
 */
export async function fetchExecutionFiles(
  ensembleManagerApi: string,
  executionId: string,
  signal?: AbortSignal,
): Promise<ExecutionFile[]> {
  const url = `${ensembleManagerApi}/executions/${encodeURIComponent(executionId)}/files`;
  const resp = await fetch(url, { signal, headers: ensembleManagerHeaders() });
  if (!resp.ok) {
    throw await toEnsembleManagerError(resp);
  }
  const body = (await resp.json()) as { files?: ExecutionFile[] };
  return body.files ?? [];
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
