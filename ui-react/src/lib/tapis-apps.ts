/**
 * Tapis application catalogue — the component location source for a Tapis
 * deployment.
 *
 * A model configuration records where its executable component lives in
 * `has_component_location`. When the Ensemble Manager runs on Tapis, that value
 * must be the canonical app URL
 * `https://{tenant}.tapis.io/v3/apps/{id}/{version}`:
 * `ExecutionCreation.loadComponentFromTapis` splits it back into an id and a
 * version, so a URL missing either one fails the run. The sharing endpoint
 * `/v3/apps/share/{id}` carries neither and must never be stored.
 *
 * The app list comes from the model catalog API, not from Tapis directly: the
 * proxy (`custom_tapis_apps_get`) forwards the user's Bearer token as the Tapis
 * `X-Tapis-Token`, so the browser needs no Tapis CORS grant.
 */
import { getAccessToken } from './auth/token-store';
import { getModelCatalogApiUrl, getRuntimeConfig } from './config';

/** Identity of one Tapis application version. */
export interface TapisAppRef {
  tenant: string;
  id: string;
  version: string;
}

/** One Tapis file input, as the app declares it. */
export interface TapisFileInput {
  name?: string;
  description?: string;
  /** REQUIRED, OPTIONAL or FIXED. A FIXED input is supplied by the app itself. */
  inputMode?: string;
}

/** One Tapis application argument, as the app declares it. */
export interface TapisAppArg {
  name?: string;
  description?: string;
  inputMode?: string;
  /** The default command-line value. */
  arg?: string;
  notes?: { fieldType?: string };
}

/** The subset of a Tapis application the seed needs. */
export interface TapisApp extends TapisAppRef {
  jobAttributes?: {
    fileInputs?: TapisFileInput[];
    parameterSet?: { appArgs?: TapisAppArg[] };
  };
}

/** Model rows derived from a Tapis application. */
export interface TapisAppSeed {
  inputs: { label: string; description: string; isOptional: boolean }[];
  parameters: {
    label: string;
    description: string;
    hasDefaultValue: string;
    hasDataType: string;
  }[];
}

/**
 * The canonical Tapis app URL. Same pattern the legacy UI used
 * (`ui/src/screens/models/configure/resources/tapis-app.ts`), so a value written
 * by either app parses in both.
 */
export const TAPIS_APP_URL_PATTERN = /^https:\/\/([^.]+)\.tapis\.io\/v3\/apps\/([^/]+)\/([^/]+)$/;

export function buildTapisAppUrl(app: TapisAppRef): string {
  return `https://${app.tenant}.tapis.io/v3/apps/${app.id}/${app.version}`;
}

/**
 * Splits a component location back into an app reference, or null when it is
 * not one.
 *
 * `share` is not an app id: `/v3/apps/share/{id}` is the Tapis sharing
 * endpoint, and it has the same shape as an app URL. It answers
 * `{"publicShare": true}` and names no version, so a job built from it has no
 * app to run. Tapis owns that path segment, so no reachable app uses it as an
 * id.
 */
export function parseTapisAppUrl(url: string): TapisAppRef | null {
  const m = TAPIS_APP_URL_PATTERN.exec(url.trim());
  if (!m) return null;
  const [, tenant, id, version] = m;
  if (!tenant || !id || !version) return null;
  if (id === 'share') return null;
  return { tenant, id, version };
}

/**
 * The Tapis tenant this deployment signs in against, or null when it does not
 * use Tapis. Derived from AUTH_SERVER rather than configured separately: one
 * deployment has one Tapis tenant, and a second key could disagree with it.
 */
export function getTapisTenant(): string | null {
  const config = getRuntimeConfig();
  if (config.AUTH_PROVIDER !== 'tapis') return null;
  const m = /^https:\/\/([^.]+)\.tapis\.io\/?$/.exec(config.AUTH_SERVER ?? '');
  return m?.[1] ?? null;
}

/**
 * True when a new model's component should be picked from the Tapis app
 * catalogue. The deployment's execution engine decides it, the user does not —
 * the same value that already selects the run-submission route.
 */
export function usesTapisComponents(): boolean {
  return getRuntimeConfig().EXECUTION_ENGINE === 'tapis' && getTapisTenant() !== null;
}

/** Bearer headers for the model catalog API. Its Tapis routes answer 401 without one. */
function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Sign in to list Tapis applications.');
  }
  return { Authorization: `Bearer ${token}` };
}

async function getJson(path: string): Promise<unknown> {
  const headers = authHeaders();
  const resp = await fetch(`${getModelCatalogApiUrl()}${path}`, { headers });
  if (!resp.ok) {
    throw new Error(`Model catalog API returned ${resp.status}`);
  }
  return resp.json();
}

/** Lists the applications the signed-in user can see in one tenant. */
export async function listTapisApps(tenant: string): Promise<TapisAppRef[]> {
  const body = await getJson(`/tapis/${tenant}/apps`);
  const rows = Array.isArray(body) ? (body as Partial<TapisAppRef>[]) : [];
  // An app with no version cannot be run, so it is not offerable.
  return rows
    .filter((a): a is TapisAppRef => Boolean(a?.id && a?.version))
    .map((a) => ({ tenant, id: a.id, version: a.version }));
}

/** Reads one application, with the job attributes the seed needs. */
export async function getTapisApp(ref: TapisAppRef): Promise<TapisApp> {
  const body = await getJson(`/tapis/${ref.tenant}/apps/${ref.id}/${ref.version}`);
  return { ...ref, ...(body as Omit<TapisApp, keyof TapisAppRef>) };
}

/**
 * Turns an application into the model's inputs and parameters.
 *
 * Every label is the Tapis name, unchanged. `TapisJobService` matches a model
 * input label against `fileInput.name` and a model parameter label against
 * `appArgs.name`, so a reworded label makes the run throw. A FIXED file input
 * gets no model input: the app supplies it and the user cannot override it.
 */
export function buildSeedFromTapisApp(app: TapisApp): TapisAppSeed {
  const job = app.jobAttributes ?? {};

  const inputs = (job.fileInputs ?? [])
    .filter((f) => Boolean(f.name) && f.inputMode !== 'FIXED')
    .map((f) => ({
      label: f.name ?? '',
      description: f.description ?? '',
      isOptional: f.inputMode === 'OPTIONAL',
    }));

  const parameters = (job.parameterSet?.appArgs ?? [])
    .filter((a) => Boolean(a.name) && a.inputMode !== 'FIXED')
    .map((a) => ({
      label: a.name ?? '',
      description: a.description ?? '',
      hasDefaultValue: a.arg ?? '',
      // Tapis states the widget type, not a data type. 'number' is the only one
      // it uses, and the form's nearest type is float.
      hasDataType: a.notes?.fieldType === 'number' ? 'float' : 'string',
    }));

  return { inputs, parameters };
}
