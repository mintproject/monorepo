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
  /** Structured server details, when present. */
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'EnsembleManagerError';
    this.status = status;
    this.code = code;
    this.details = details;
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
function formatErrorValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value == null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function toEnsembleManagerError(resp: Response): Promise<EnsembleManagerError> {
  const body = await resp
    .json()
    .then(
      (parsed: { message?: unknown; code?: unknown; detail?: unknown; details?: unknown }) =>
        parsed,
    )
    .catch(() => undefined);
  const serverMessage = formatErrorValue(body?.message ?? body?.detail ?? body?.details);
  const message = serverMessage
    ? `Ensemble manager returned ${resp.status}: ${serverMessage}`
    : `Ensemble manager returned ${resp.status}`;
  return new EnsembleManagerError(
    resp.status,
    message,
    typeof body?.code === 'string' ? body.code : undefined,
    body?.details ?? body?.detail,
  );
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

export type UnifiedExecutor = 'ensemble_manager' | 'svo_adapter';

export interface UnifiedParameterDefinition {
  name: string;
  type?: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  allowed_values?: unknown[];
  minimum?: number;
  maximum?: number;
  source_transform?: string;
  transform_spec_id?: string;
}

export interface UnifiedExecutionPlan {
  plan_id: string | null;
  executor: UnifiedExecutor;
  version: number;
  status: string;
  parameters: UnifiedParameterDefinition[];
  parameter_values: Record<string, unknown>;
  [key: string]: unknown;
}

async function unifiedRequest<T>(
  ensembleManagerApi: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await fetch(`${ensembleManagerApi}${path}`, {
    method,
    signal,
    headers: ensembleManagerHeaders({ 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!resp.ok) throw await toEnsembleManagerError(resp);
  return (await resp.json()) as T;
}

/** Create one public plan for either the legacy engine or the SVO adapter. */
export function createExecutionPlan(
  ensembleManagerApi: string,
  body: {
    executor: UnifiedExecutor;
    thread_id?: string;
    model_id?: string;
    execution_engine?: string;
    adapter_request?: Record<string, unknown>;
    adapter_steps?: Array<{
      adapter_plan_id: string;
      model_io_id: string;
      source_resource_id: string;
    }>;
  },
): Promise<UnifiedExecutionPlan> {
  return unifiedRequest<UnifiedExecutionPlan>(ensembleManagerApi, '/plans', 'POST', body);
}

/** Submit a previously-created plan; adapter validation happens server-side. */
export function submitExecutionPlan(
  ensembleManagerApi: string,
  body: {
    plan_id: string;
    parameter_values?: Record<string, unknown>;
    run_name?: string;
    recreate?: boolean;
    dry_run?: boolean;
    execution_id?: string;
    idempotency_key?: string;
    adapter_parameter_values?: Record<string, Record<string, unknown>>;
  },
): Promise<Record<string, unknown>> {
  return unifiedRequest<Record<string, unknown>>(ensembleManagerApi, '/plans/submit', 'POST', body);
}

/** Retrieve the immutable plan snapshot and its adapter parameter definitions. */
export function fetchExecutionPlan(
  ensembleManagerApi: string,
  planId: string,
  signal?: AbortSignal,
): Promise<UnifiedExecutionPlan> {
  return unifiedRequest<UnifiedExecutionPlan>(
    ensembleManagerApi,
    `/plans/${encodeURIComponent(planId)}`,
    'GET',
    undefined,
    signal,
  );
}

/** Retrieve adapter child-run status through Ensemble Manager. */
export function fetchUnifiedRun(
  ensembleManagerApi: string,
  runId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return unifiedRequest<Record<string, unknown>>(
    ensembleManagerApi,
    `/plans/runs/${encodeURIComponent(runId)}`,
    'GET',
    undefined,
    signal,
  );
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
