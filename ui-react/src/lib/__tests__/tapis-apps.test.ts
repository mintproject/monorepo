import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildSeedFromTapisApp,
  buildTapisAppUrl,
  getTapisTenant,
  listTapisApps,
  parseTapisAppUrl,
  usesTapisComponents,
  type TapisApp,
} from '@/lib/tapis-apps';
import { setMintConfig } from '@/test/utils/mint-config';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('parseTapisAppUrl / buildTapisAppUrl', () => {
  it('round-trips a canonical app URL', () => {
    const url = 'https://portals.tapis.io/v3/apps/hello-world-fileinput-test/0.0.5';
    const ref = parseTapisAppUrl(url);
    expect(ref).toEqual({
      tenant: 'portals',
      id: 'hello-world-fileinput-test',
      version: '0.0.5',
    });
    expect(buildTapisAppUrl(ref!)).toBe(url);
  });

  it('rejects the sharing endpoint, which carries no id and no version', () => {
    // https://portals.tapis.io/v3/apps/share/<id> answers {publicShare: true}.
    // The Ensemble Manager needs both the id and the version, so this URL must
    // never reach has_component_location.
    expect(parseTapisAppUrl('https://portals.tapis.io/v3/apps/share/hello-world')).toBeNull();
  });

  it('rejects a non-Tapis URL', () => {
    expect(parseTapisAppUrl('https://example.org/components/model.zip')).toBeNull();
    expect(parseTapisAppUrl('')).toBeNull();
  });
});

describe('getTapisTenant', () => {
  it('reads the tenant from the Tapis auth server', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis', AUTH_SERVER: 'https://portals.tapis.io' });
    expect(getTapisTenant()).toBe('portals');
  });

  it('returns null for a Keycloak deployment', () => {
    setMintConfig({ AUTH_PROVIDER: 'keycloak', AUTH_SERVER: 'https://auth.example.org' });
    expect(getTapisTenant()).toBeNull();
  });

  it('returns null when the auth server is not a Tapis host', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis', AUTH_SERVER: 'https://auth.example.org' });
    expect(getTapisTenant()).toBeNull();
  });
});

describe('usesTapisComponents', () => {
  it('is true only when the deployment runs Tapis and a tenant is known', () => {
    setMintConfig({
      AUTH_PROVIDER: 'tapis',
      AUTH_SERVER: 'https://portals.tapis.io',
      EXECUTION_ENGINE: 'tapis',
    });
    expect(usesTapisComponents()).toBe(true);

    setMintConfig({
      AUTH_PROVIDER: 'tapis',
      AUTH_SERVER: 'https://portals.tapis.io',
      EXECUTION_ENGINE: 'localex',
    });
    expect(usesTapisComponents()).toBe(false);

    setMintConfig({ AUTH_PROVIDER: 'keycloak', EXECUTION_ENGINE: 'tapis' });
    expect(usesTapisComponents()).toBe(false);
  });
});

describe('listTapisApps', () => {
  it('calls the model catalog API with the stored bearer token', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0/' });
    localStorage.setItem('mint.access_token', 'tok-123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ tenant: 'portals', id: 'hello', version: '0.0.5' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const apps = await listTapisApps('portals');

    expect(apps).toEqual([{ tenant: 'portals', id: 'hello', version: '0.0.5' }]);
    const [url, init] = fetchMock.mock.calls[0]!;
    // The trailing slash of the configured base must not double up.
    expect(url).toBe('http://localhost:3002/v2.0.0/tapis/portals/apps');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('throws a readable error when the API refuses the request', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0' });
    localStorage.setItem('mint.access_token', 'tok-123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));

    await expect(listTapisApps('portals')).rejects.toThrow(/401/);
  });

  it('refuses to call anonymously — the proxy always answers 401', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0' });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(listTapisApps('portals')).rejects.toThrow(/sign in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops an entry with no id or no version', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0' });
    localStorage.setItem('mint.access_token', 'tok-123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          { tenant: 'portals', id: 'hello', version: '0.0.5' },
          { tenant: 'portals', id: 'broken' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(listTapisApps('portals')).resolves.toHaveLength(1);
  });
});

describe('buildSeedFromTapisApp', () => {
  // Trimmed from the real hello-world-fileinput-test 0.0.5 response.
  const app: TapisApp = {
    tenant: 'portals',
    id: 'hello-world-fileinput-test',
    version: '0.0.5',
    jobAttributes: {
      fileInputs: [
        {
          name: 'Required Input',
          description: 'User must provide sourceUrl at submission',
          inputMode: 'REQUIRED',
        },
        {
          name: 'Optional Input',
          description: 'User may omit at submission',
          inputMode: 'OPTIONAL',
        },
        {
          name: 'Fixed Input',
          description: 'Locked by app, user cannot override',
          inputMode: 'FIXED',
        },
      ],
      parameterSet: {
        appArgs: [
          {
            name: 'Greeting',
            description: 'Choose a greeting',
            inputMode: 'REQUIRED',
            arg: 'hello',
          },
          { name: 'Target', description: 'Whom to address', inputMode: 'REQUIRED', arg: 'world' },
          {
            name: 'Sleep Time',
            description: 'How long to sleep',
            inputMode: 'REQUIRED',
            arg: '1',
            notes: { fieldType: 'number' },
          },
        ],
      },
    },
  };

  it('takes one input per non-FIXED file input, keeping the Tapis name verbatim', () => {
    // TapisJobService.createJobFileInputsFromSeed matches the model input label
    // against fileInput.name, so the label must not be reworded.
    const seed = buildSeedFromTapisApp(app);
    expect(seed.inputs).toEqual([
      {
        label: 'Required Input',
        description: 'User must provide sourceUrl at submission',
        isOptional: false,
      },
      { label: 'Optional Input', description: 'User may omit at submission', isOptional: true },
    ]);
  });

  it('takes one parameter per app argument, with its default value', () => {
    const seed = buildSeedFromTapisApp(app);
    expect(seed.parameters).toEqual([
      {
        label: 'Greeting',
        description: 'Choose a greeting',
        hasDefaultValue: 'hello',
        hasDataType: 'string',
      },
      {
        label: 'Target',
        description: 'Whom to address',
        hasDefaultValue: 'world',
        hasDataType: 'string',
      },
      {
        label: 'Sleep Time',
        description: 'How long to sleep',
        hasDefaultValue: '1',
        hasDataType: 'float',
      },
    ]);
  });

  it('returns empty lists for an app that declares nothing', () => {
    expect(buildSeedFromTapisApp({ tenant: 't', id: 'a', version: '1' })).toEqual({
      inputs: [],
      parameters: [],
    });
  });
});
