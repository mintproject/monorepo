# Local Hasura E2E Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-Hasura-backed e2e integration test suite for `model-catalog-api` that exercises the full Fastify → Apollo → real Hasura → PostgreSQL pipeline against `http://graphql.mint.local`, covering junction (`on_conflict`) and recursive nested-write (POST/PUT) failure classes that the existing mocked unit tests cannot detect.

**Architecture:** In-process Fastify (`buildApp()` + `fastify.inject()`), real Apollo Client over real network to local Hasura, admin-secret auth flipped on by `MINT_E2E_MODE=1`. Per-test-file `RUN_ID` produces collision-proof entity IDs. `afterAll` deletes tracked IDs in reverse creation order. Suite gated behind a separate vitest config and `npm run test:e2e` script so the default `npm test` stays mock-only and fast.

**Tech Stack:** TypeScript, Fastify 5, fastify-openapi-glue, Apollo Client 4, Vitest 4, Hasura GraphQL Engine, PostgreSQL.

---

## Important Findings From Codebase Read

These differ from the design spec; the plan supersedes the spec where they disagree.

1. **`hasGrid` lives on `softwareversions`**, not `softwares`. Junction table is `modelcatalog_software_version_grid`. All junction-class tests target `/v2.0.0/softwareversions`.
2. **`hasVersion` on `softwares` is a childFk nested relationship** (FK column `software_id` on `modelcatalog_software_version`), NOT a junction. Used for the nested-write tests.
3. **`SecurityHandler.BearerAuth`** (`src/security.ts:14`) rejects requests without `Authorization: Bearer <anything>`. In `MINT_E2E_MODE`, tests still send a placeholder bearer header (e.g. `Bearer e2e-test`), but `getWriteClient` ignores its value and uses the admin secret instead. No edit to `security.ts` required.
4. **Existing mocked tests under `src/__tests__/*.test.ts`** must continue to run via `npm test`. The new vitest config uses an `include` glob limited to `src/__tests__/e2e/**` and the default `vitest.config` (or absence thereof) means the existing `"test": "vitest run"` script still runs only the mocked files since e2e files won't match its default glob until they exist — therefore the default `vitest.config.ts` MUST be created with an explicit `exclude` for e2e to keep `npm test` fast and mock-only.
5. **bug-087 is already fixed on the current branch** (`fix/bug-087-junction-on-conflict-label-clobber`). The junction e2e tests are regression coverage; they should pass green.
6. **bug-089 is NOT yet implemented** (design + plan committed, code not yet). The nested-write e2e tests may fail until bug-089 ships; each nested-write test documents expected status in a comment.

## File Structure

### Files to create

| Path | Responsibility |
|------|---------------|
| `model-catalog-api/vitest.config.ts` | Default vitest config that excludes `src/__tests__/e2e/**` so `npm test` stays mock-only. |
| `model-catalog-api/vitest.e2e.config.ts` | E2E vitest config: include only `src/__tests__/e2e/**`, sequential, longer timeout. |
| `model-catalog-api/src/__tests__/e2e/setup.ts` | Set env defaults; expose `buildE2EApp()` that builds Fastify after env is set; expose `assertHasuraReachable()` health-check. |
| `model-catalog-api/src/__tests__/e2e/helpers.ts` | `RUN_ID`, `uniqueId(kind)`, `trackId(resource, id)`, `cleanup(app)`, `inject(app, ...)`, `E2E_HEADERS`. |
| `model-catalog-api/src/__tests__/e2e/junction-e2e.test.ts` | 6 junction tests on `softwareversions.hasGrid` (bug-087 class). |
| `model-catalog-api/src/__tests__/e2e/nested-write-e2e.test.ts` | 5 nested-write tests on `softwares.hasVersion` and `softwareversions.hasConfiguration` (bug-089 class). |
| `model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md` | Project-local skill for future Claude sessions. |

### Files to modify

| Path | Change |
|------|--------|
| `model-catalog-api/src/hasura/client.ts` | Add `MINT_E2E_MODE === '1'` branch in `getWriteClient()` to use admin-secret instead of Bearer. |
| `model-catalog-api/package.json` | Add `"test:e2e"` script. |
| `model-catalog-api/CLAUDE.md` | Add one-line pointer to `run-e2e-hasura` skill. |

---

## Task 1: Default vitest config keeps `npm test` mock-only

**Files:**
- Create: `model-catalog-api/vitest.config.ts`

- [ ] **Step 1: Verify default `npm test` currently picks up only the mocked tests**

Run: `cd model-catalog-api && npm test 2>&1 | tail -20`

Expected: 4 test files run (`integration.test.ts`, `junction-integration.test.ts`, `request-mapper.test.ts`, `service-type-filter.test.ts`). All tests should be in `src/__tests__/`. Note the count for comparison after the e2e dir exists.

- [ ] **Step 2: Create the default vitest config that excludes the future e2e dir**

Create `model-catalog-api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
```

- [ ] **Step 3: Re-run default tests to confirm same files still run**

Run: `cd model-catalog-api && npm test 2>&1 | tail -20`

Expected: same 4 test files as Step 1, same pass count. The new config is functionally identical for now (e2e dir does not yet exist), but locks in the exclusion for later.

- [ ] **Step 4: Commit**

```bash
cd model-catalog-api
git add vitest.config.ts
git commit -m "test: add explicit vitest config excluding future e2e dir"
```

---

## Task 2: E2E vitest config + npm script

**Files:**
- Create: `model-catalog-api/vitest.e2e.config.ts`
- Modify: `model-catalog-api/package.json`

- [ ] **Step 1: Create the e2e vitest config**

Create `model-catalog-api/vitest.e2e.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/e2e/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

Rationale: `singleFork` keeps tests sequential within and across files to avoid step-on-each-other behavior on a shared dev DB. 30s timeout covers cold Hasura responses and cleanup loops.

- [ ] **Step 2: Add the npm script**

Modify `model-catalog-api/package.json`. In the `"scripts"` block (currently `"test": "vitest run"` on line 12), add a `test:e2e` entry on a new line after `test`:

```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "codegen": "graphql-codegen --config codegen.ts",
    "test": "vitest run",
    "test:e2e": "vitest run --config vitest.e2e.config.ts"
  },
```

- [ ] **Step 3: Verify e2e command runs (no tests yet, no error)**

Run: `cd model-catalog-api && npm run test:e2e 2>&1 | tail -10`

Expected: vitest reports "No test files found, exiting with code 1" (or equivalent). Acceptable. The script is wired correctly.

- [ ] **Step 4: Commit**

```bash
cd model-catalog-api
git add vitest.e2e.config.ts package.json
git commit -m "test: add vitest e2e config and test:e2e script"
```

---

## Task 3: `getWriteClient` admin-secret branch under `MINT_E2E_MODE`

**Files:**
- Modify: `model-catalog-api/src/hasura/client.ts:35-51`
- Test: `model-catalog-api/src/__tests__/hasura-client.test.ts` (new)

- [ ] **Step 1: Write the failing unit test**

Create `model-catalog-api/src/__tests__/hasura-client.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getWriteClient — MINT_E2E_MODE', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses Authorization: Bearer when MINT_E2E_MODE is unset', async () => {
    delete process.env.MINT_E2E_MODE;
    process.env.HASURA_GRAPHQL_URL = 'http://hasura.test/v1/graphql';
    process.env.HASURA_ADMIN_SECRET = 'secret';

    const { getWriteClient } = await import('../hasura/client.js');
    const client = getWriteClient('Bearer real-jwt');
    const link = (client as unknown as { link: { options?: { headers?: Record<string, string> } } }).link;
    const headers = link.options?.headers ?? {};
    expect(headers).toMatchObject({ Authorization: 'Bearer real-jwt' });
    expect(headers).not.toHaveProperty('X-Hasura-Admin-Secret');
  });

  it('uses X-Hasura-Admin-Secret when MINT_E2E_MODE=1', async () => {
    process.env.MINT_E2E_MODE = '1';
    process.env.HASURA_GRAPHQL_URL = 'http://hasura.test/v1/graphql';
    process.env.HASURA_ADMIN_SECRET = 'secret';

    const { getWriteClient } = await import('../hasura/client.js');
    const client = getWriteClient('Bearer ignored');
    const link = (client as unknown as { link: { options?: { headers?: Record<string, string> } } }).link;
    const headers = link.options?.headers ?? {};
    expect(headers).toMatchObject({ 'X-Hasura-Admin-Secret': 'secret' });
    expect(headers).not.toHaveProperty('Authorization');
  });
});
```

- [ ] **Step 2: Run test to verify both fail (or one fails)**

Run: `cd model-catalog-api && npx vitest run src/__tests__/hasura-client.test.ts`

Expected: Second test FAILS — current `getWriteClient` always sets `Authorization`, never sets `X-Hasura-Admin-Secret`. First test should pass.

If the test cannot read headers off the link object via the shown property path, instrument differently: add a one-time log inside `getWriteClient` and assert it once during exploration; then remove. The simplest path is shown — adapt only if Apollo's link shape differs in the installed version.

- [ ] **Step 3: Modify `getWriteClient` to switch on `MINT_E2E_MODE`**

Edit `model-catalog-api/src/hasura/client.ts`. Replace the `getWriteClient` function body (lines 35–51 in the current file) with:

```ts
export function getWriteClient(bearerToken: string): ApolloClient {
  const headers: Record<string, string> =
    process.env.MINT_E2E_MODE === '1'
      ? { 'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET }
      : { Authorization: bearerToken };

  return new ApolloClient({
    link: new HttpLink({
      uri: HASURA_GRAPHQL_URL,
      headers,
      fetch: globalThis.fetch,
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
      },
    },
  });
}
```

- [ ] **Step 4: Run the test to verify both pass**

Run: `cd model-catalog-api && npx vitest run src/__tests__/hasura-client.test.ts`

Expected: both tests PASS.

- [ ] **Step 5: Run the full mocked test suite to confirm nothing regressed**

Run: `cd model-catalog-api && npm test`

Expected: same pass count as before plus the 2 new tests; no failures.

- [ ] **Step 6: Commit**

```bash
cd model-catalog-api
git add src/hasura/client.ts src/__tests__/hasura-client.test.ts
git commit -m "feat(hasura/client): MINT_E2E_MODE flips writeClient to admin-secret auth"
```

---

## Task 4: E2E helpers — IDs, tracking, cleanup, injection

**Files:**
- Create: `model-catalog-api/src/__tests__/e2e/helpers.ts`

- [ ] **Step 1: Create the helpers module**

Create `model-catalog-api/src/__tests__/e2e/helpers.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export const RUN_ID = `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;

const ID_PREFIX = 'https://w3id.org/okn/i/mint';

export function uniqueId(kind: string): string {
  return `${ID_PREFIX}/${kind}-${RUN_ID}-${randomUUID().slice(0, 6)}`;
}

export const E2E_HEADERS: Record<string, string> = {
  Authorization: 'Bearer e2e-test',
  'Content-Type': 'application/json',
};

interface Tracked {
  resource: string;
  id: string;
}

const created: Tracked[] = [];

export function trackId(resource: string, id: string): void {
  created.push({ resource, id });
}

export interface InjectResult {
  statusCode: number;
  body: unknown;
  rawPayload: string;
}

export async function inject(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  payload?: unknown,
): Promise<InjectResult> {
  const res = await app.inject({
    method,
    url: path,
    headers: E2E_HEADERS,
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  });
  let body: unknown = undefined;
  if (res.payload && res.payload.length > 0) {
    try {
      body = JSON.parse(res.payload);
    } catch {
      body = res.payload;
    }
  }
  return { statusCode: res.statusCode, body, rawPayload: res.payload };
}

export async function cleanup(app: FastifyInstance): Promise<void> {
  const orphans: Tracked[] = [];
  for (const t of [...created].reverse()) {
    try {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v2.0.0/${t.resource}/${encodeURIComponent(t.id)}`,
        headers: E2E_HEADERS,
      });
      if (res.statusCode >= 400 && res.statusCode !== 404) {
        orphans.push(t);
        // eslint-disable-next-line no-console
        console.warn(
          `cleanup: ${t.resource}/${t.id} delete returned ${res.statusCode}: ${res.payload}`,
        );
      }
    } catch (err) {
      orphans.push(t);
      // eslint-disable-next-line no-console
      console.warn(`cleanup: ${t.resource}/${t.id} threw`, err);
    }
  }
  if (orphans.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `cleanup: ${orphans.length} orphan(s) remain. RUN_ID=${RUN_ID}. Manual SQL:\n` +
        `  DELETE FROM modelcatalog_software_version WHERE id LIKE '%-${RUN_ID}-%';\n` +
        `  DELETE FROM modelcatalog_software WHERE id LIKE '%-${RUN_ID}-%';\n` +
        `  DELETE FROM modelcatalog_grid WHERE id LIKE '%-${RUN_ID}-%';`,
    );
  }
  created.length = 0;
}
```

- [ ] **Step 2: Verify the file type-checks**

Run: `cd model-catalog-api && npx tsc --noEmit -p tsconfig.json`

Expected: no errors. If `tsconfig.json` has `"noUnusedLocals": true` and the unused `RUN_ID` import warning appears in any place that imports it but does not use it, that's a downstream concern handled in later tasks.

- [ ] **Step 3: Commit**

```bash
cd model-catalog-api
git add src/__tests__/e2e/helpers.ts
git commit -m "test(e2e): add helpers — uniqueId, trackId, inject, cleanup"
```

---

## Task 5: E2E setup — env defaults, app builder, Hasura health-check

**Files:**
- Create: `model-catalog-api/src/__tests__/e2e/setup.ts`

- [ ] **Step 1: Create the setup module**

Create `model-catalog-api/src/__tests__/e2e/setup.ts`:

```ts
import type { FastifyInstance } from 'fastify';

const DEFAULTS: Record<string, string> = {
  HASURA_GRAPHQL_URL: 'http://graphql.mint.local/v1/graphql',
  HASURA_ADMIN_SECRET: 'CHANGEME',
  MINT_E2E_MODE: '1',
  LOG_LEVEL: 'warn',
};

export function applyE2EEnv(): void {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }
}

export async function buildE2EApp(): Promise<FastifyInstance> {
  applyE2EEnv();
  const { buildApp } = await import('../../app.js');
  return buildApp();
}

export async function assertHasuraReachable(): Promise<void> {
  applyE2EEnv();
  const url = process.env.HASURA_GRAPHQL_URL!;
  const adminSecret = process.env.HASURA_ADMIN_SECRET!;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Admin-Secret': adminSecret,
      },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
  } catch (err) {
    throw new Error(
      `Local Hasura unreachable at ${url}. Check kubectl port-forward / /etc/hosts. Underlying error: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(
      `Local Hasura health-check failed at ${url}: ${res.status} ${res.statusText}. Body: ${text}`,
    );
  }
}
```

Rationale:
- `applyE2EEnv` sets defaults but does not overwrite existing values, so a developer can `HASURA_GRAPHQL_URL=… npm run test:e2e` against a different instance.
- `buildE2EApp` imports `app.js` AFTER env vars are set so `hasura/client.ts` reads the correct URL/secret at module-load time.
- `assertHasuraReachable` fails fast with an actionable message before any test runs.

- [ ] **Step 2: Verify type-checks**

Run: `cd model-catalog-api && npx tsc --noEmit -p tsconfig.json`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd model-catalog-api
git add src/__tests__/e2e/setup.ts
git commit -m "test(e2e): add setup — env defaults, app builder, Hasura health-check"
```

---

## Task 6: First junction e2e test — bug-087 regression (label clobber)

This task proves the harness end-to-end with the highest-value test (bug-087 regression).

**Files:**
- Create: `model-catalog-api/src/__tests__/e2e/junction-e2e.test.ts`

- [ ] **Step 1: Confirm Hasura reachable**

Run: `curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://graphql.mint.local/v1/graphql -H "X-Hasura-Admin-Secret: CHANGEME" -H "Content-Type: application/json" -d '{"query":"{ __typename }"}' --max-time 5`

Expected: `200`. If not, do not proceed — surface the unreachable Hasura to the user before continuing.

- [ ] **Step 2: Write the bug-087 regression test**

Create `model-catalog-api/src/__tests__/e2e/junction-e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { assertHasuraReachable, buildE2EApp } from './setup.js';
import { cleanup, inject, trackId, uniqueId } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  await assertHasuraReachable();
  app = await buildE2EApp();
});

afterAll(async () => {
  if (app) {
    await cleanup(app);
    await app.close();
  }
});

describe('junction e2e — softwareversions.hasGrid (bug-087 class)', () => {
  it('does NOT clobber an existing grid label when linked from a new softwareversion (bug-087 regression)', async () => {
    // 1. Create a grid with a known label.
    const gridId = uniqueId('grid');
    const ORIGINAL_LABEL = 'original-grid-label-DO-NOT-CLOBBER';
    const gridCreate = await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId,
      label: [ORIGINAL_LABEL],
      type: ['Grid'],
    });
    expect(gridCreate.statusCode).toBeGreaterThanOrEqual(200);
    expect(gridCreate.statusCode).toBeLessThan(300);
    trackId('grids', gridId);

    // 2. Create a softwareversion linking to that grid by ID only (no label in the link payload).
    const versionId = uniqueId('softwareversion');
    const versionCreate = await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId,
      label: ['e2e-version'],
      type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }],
    });
    expect(versionCreate.statusCode).toBeGreaterThanOrEqual(200);
    expect(versionCreate.statusCode).toBeLessThan(300);
    trackId('softwareversions', versionId);

    // 3. Fetch the grid back and assert its label was NOT touched.
    const gridGet = await inject(
      app,
      'GET',
      `/v2.0.0/grids/${encodeURIComponent(gridId)}`,
    );
    expect(gridGet.statusCode).toBe(200);
    const grid = (Array.isArray(gridGet.body) ? gridGet.body[0] : gridGet.body) as {
      id: string;
      label: string[];
    };
    expect(grid.id).toBe(gridId);
    expect(grid.label).toEqual([ORIGINAL_LABEL]);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd model-catalog-api && npm run test:e2e -- junction-e2e`

Expected: test PASSES (bug-087 is fixed on this branch). If it fails, the harness or the fix has regressed — debug before continuing.

- [ ] **Step 4: Run the test a second time to verify cleanup leaves no debris**

Run: `cd model-catalog-api && npm run test:e2e -- junction-e2e`

Expected: test PASSES again. Each run uses a fresh `RUN_ID`, so collisions are not the concern — the concern is that the previous run cleaned up properly. If you see `cleanup: N orphan(s) remain` in stderr, investigate before adding more tests.

- [ ] **Step 5: Commit**

```bash
cd model-catalog-api
git add src/__tests__/e2e/junction-e2e.test.ts
git commit -m "test(e2e): junction-e2e — bug-087 label-clobber regression"
```

---

## Task 7: Remaining junction e2e tests

**Files:**
- Modify: `model-catalog-api/src/__tests__/e2e/junction-e2e.test.ts`

For each step below, add the test, run the file, confirm pass, then commit.

- [ ] **Step 1: Add — POST then GET round-trip persists junction IDs**

Inside the existing `describe(...)` block in `junction-e2e.test.ts`, append:

```ts
  it('POST softwareversion with hasGrid persists the junction; GET returns it', async () => {
    const gridId = uniqueId('grid');
    await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId,
      label: ['grid-roundtrip'],
      type: ['Grid'],
    });
    trackId('grids', gridId);

    const versionId = uniqueId('softwareversion');
    await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId,
      label: ['v-roundtrip'],
      type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }],
    });
    trackId('softwareversions', versionId);

    const got = await inject(
      app,
      'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    expect(got.statusCode).toBe(200);
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    expect(v.hasGrid?.map((g) => g.id)).toContain(gridId);
  });
```

- [ ] **Step 2: Run the file**

Run: `cd model-catalog-api && npm run test:e2e -- junction-e2e`

Expected: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd model-catalog-api
git add src/__tests__/e2e/junction-e2e.test.ts
git commit -m "test(e2e): junction round-trip GET after POST"
```

- [ ] **Step 4: Add — PUT replaces the junction set**

Append to the same `describe`:

```ts
  it('PUT softwareversion replaces hasGrid: old links removed, new links present', async () => {
    const gridA = uniqueId('grid');
    const gridB = uniqueId('grid');
    for (const [id, lbl] of [[gridA, 'A'], [gridB, 'B']] as const) {
      await inject(app, 'POST', '/v2.0.0/grids', {
        id, label: [lbl], type: ['Grid'],
      });
      trackId('grids', id);
    }

    const versionId = uniqueId('softwareversion');
    await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-put'], type: ['SoftwareVersion'],
      hasGrid: [{ id: gridA }],
    });
    trackId('softwareversions', versionId);

    const putRes = await inject(
      app,
      'PUT',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
      {
        id: versionId, label: ['v-put'], type: ['SoftwareVersion'],
        hasGrid: [{ id: gridB }],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);

    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    const ids = v.hasGrid?.map((g) => g.id) ?? [];
    expect(ids).toContain(gridB);
    expect(ids).not.toContain(gridA);
  });
```

- [ ] **Step 5: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- junction-e2e
```

Expected: 3 PASS.

```bash
cd model-catalog-api
git add src/__tests__/e2e/junction-e2e.test.ts
git commit -m "test(e2e): junction PUT replace set"
```

- [ ] **Step 6: Add — PUT empty junction array clears all links**

Append:

```ts
  it('PUT softwareversion with hasGrid: [] removes all junction links', async () => {
    const gridId = uniqueId('grid');
    await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId, label: ['G'], type: ['Grid'],
    });
    trackId('grids', gridId);

    const versionId = uniqueId('softwareversion');
    await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-empty'], type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }],
    });
    trackId('softwareversions', versionId);

    const putRes = await inject(
      app, 'PUT',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
      {
        id: versionId, label: ['v-empty'], type: ['SoftwareVersion'],
        hasGrid: [],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);

    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    expect(v.hasGrid ?? []).toEqual([]);
  });
```

- [ ] **Step 7: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- junction-e2e
```

Expected: 4 PASS.

```bash
cd model-catalog-api
git add src/__tests__/e2e/junction-e2e.test.ts
git commit -m "test(e2e): junction PUT [] clears all links"
```

- [ ] **Step 8: Add — POST with duplicate junction targets dedupes (no constraint violation)**

Append:

```ts
  it('POST softwareversion with duplicate hasGrid entries deduplicates without violating unique constraints', async () => {
    const gridId = uniqueId('grid');
    await inject(app, 'POST', '/v2.0.0/grids', {
      id: gridId, label: ['dup'], type: ['Grid'],
    });
    trackId('grids', gridId);

    const versionId = uniqueId('softwareversion');
    const res = await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-dup'], type: ['SoftwareVersion'],
      hasGrid: [{ id: gridId }, { id: gridId }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwareversions', versionId);

    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
      hasGrid?: { id: string }[];
    };
    expect(v.hasGrid?.length).toBe(1);
    expect(v.hasGrid?.[0].id).toBe(gridId);
  });
```

- [ ] **Step 9: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- junction-e2e
```

Expected: 5 PASS. If this test FAILS because the API rejects duplicates with a 4xx, that is a true defect to surface to the user — do not silence it. Pause and report.

```bash
cd model-catalog-api
git add src/__tests__/e2e/junction-e2e.test.ts
git commit -m "test(e2e): junction POST dedup duplicates"
```

- [ ] **Step 10: Add — POST referencing a non-existent grid yields 4xx, no orphan junction**

Append:

```ts
  it('POST softwareversion with hasGrid referencing a non-existent grid id returns 4xx', async () => {
    const fakeGridId = uniqueId('grid-does-not-exist');
    const versionId = uniqueId('softwareversion');
    const res = await inject(app, 'POST', '/v2.0.0/softwareversions', {
      id: versionId, label: ['v-bad-ref'], type: ['SoftwareVersion'],
      hasGrid: [{ id: fakeGridId }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);

    // The version itself should NOT have been created.
    const got = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    expect([404, 200]).toContain(got.statusCode);
    if (got.statusCode === 200) {
      const v = (Array.isArray(got.body) ? got.body[0] : got.body) as {
        hasGrid?: { id: string }[];
      };
      expect(v?.hasGrid ?? []).toEqual([]);
      // If a row was actually created, track for cleanup.
      trackId('softwareversions', versionId);
    }
  });
```

- [ ] **Step 11: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- junction-e2e
```

Expected: 6 PASS. If the API silently creates the version with no junction (rather than 4xx), the assertion logic above accepts that as a non-orphan case (statusCode 200 + empty hasGrid). If it creates an orphan junction or returns 5xx, that is a true defect — pause and report.

```bash
cd model-catalog-api
git add src/__tests__/e2e/junction-e2e.test.ts
git commit -m "test(e2e): junction POST rejects unknown FK target"
```

---

## Task 8: First nested-write e2e test — POST software with inline nested version

**Files:**
- Create: `model-catalog-api/src/__tests__/e2e/nested-write-e2e.test.ts`

> **Note on bug-089:** Recursive nested POST/PUT (bug-089) is in design/plan but NOT implemented yet on this branch. The tests in Tasks 8–9 may FAIL until bug-089 is implemented. Each test header documents the expected status. When the bug-089 implementation lands, these become passing regression tests.

- [ ] **Step 1: Write the simplest nested-write test**

Create `model-catalog-api/src/__tests__/e2e/nested-write-e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { assertHasuraReachable, buildE2EApp } from './setup.js';
import { cleanup, inject, trackId, uniqueId } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  await assertHasuraReachable();
  app = await buildE2EApp();
});

afterAll(async () => {
  if (app) {
    await cleanup(app);
    await app.close();
  }
});

describe('nested-write e2e — softwares.hasVersion (bug-089 class)', () => {
  // Expected: PASS once bug-089 implementation lands. May FAIL on this branch today.
  it('POST software with an inline nested hasVersion creates the version row and links it via FK', async () => {
    const softwareId = uniqueId('software');
    const versionId = uniqueId('softwareversion');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: softwareId,
      label: ['sw-nested'],
      type: ['Software'],
      hasVersion: [
        { id: versionId, label: ['v-nested'], type: ['SoftwareVersion'] },
      ],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', softwareId);
    trackId('softwareversions', versionId);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(softwareId)}`,
    );
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      hasVersion?: { id: string }[];
    };
    expect(sw.hasVersion?.map((v) => v.id)).toContain(versionId);

    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(versionId)}`,
    );
    expect(verGet.statusCode).toBe(200);
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      id: string; label: string[];
    };
    expect(ver.id).toBe(versionId);
    expect(ver.label).toEqual(['v-nested']);
  });
});
```

- [ ] **Step 2: Run**

Run: `cd model-catalog-api && npm run test:e2e -- nested-write-e2e`

Expected:
- If PASS: nested write already works. Note in commit message.
- If FAIL: confirms the bug-089 gap. Capture the actual error in the commit message body. Do NOT alter the test to make it pass — this is the regression target for the bug-089 implementation.

- [ ] **Step 3: Commit**

```bash
cd model-catalog-api
git add src/__tests__/e2e/nested-write-e2e.test.ts
git commit -m "test(e2e): nested POST inline hasVersion (bug-089 target)"
```

---

## Task 9: Remaining nested-write tests

For each step, add the test, run, then commit. Tests may FAIL pending bug-089 — that is acceptable; commit the test as a regression target.

**Files:**
- Modify: `model-catalog-api/src/__tests__/e2e/nested-write-e2e.test.ts`

- [ ] **Step 1: Add — 3-deep nest software → version → configuration**

Append to the `describe`:

```ts
  it('POST software with nested version → nested configuration persists the full tree', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');
    const cfgId = uniqueId('modelconfiguration');

    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-3deep'], type: ['Software'],
      hasVersion: [{
        id: verId, label: ['v-3deep'], type: ['SoftwareVersion'],
        hasConfiguration: [{
          id: cfgId, label: ['cfg-3deep'], type: ['ModelConfiguration'],
        }],
      }],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', swId);
    trackId('softwareversions', verId);
    trackId('modelconfigurations', cfgId);

    const cfgGet = await inject(
      app, 'GET',
      `/v2.0.0/modelconfigurations/${encodeURIComponent(cfgId)}`,
    );
    expect(cfgGet.statusCode).toBe(200);
    const cfg = (Array.isArray(cfgGet.body) ? cfgGet.body[0] : cfgGet.body) as {
      id: string;
    };
    expect(cfg.id).toBe(cfgId);
  });
```

- [ ] **Step 2: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- nested-write-e2e
```

```bash
cd model-catalog-api
git add src/__tests__/e2e/nested-write-e2e.test.ts
git commit -m "test(e2e): nested POST 3-deep sw→ver→cfg (bug-089 target)"
```

- [ ] **Step 3: Add — PUT updates a nested version's label without touching parent**

Append:

```ts
  it('PUT software with nested hasVersion updates child label, parent label unchanged', async () => {
    const swId = uniqueId('software');
    const verId = uniqueId('softwareversion');

    await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-parent-stable'], type: ['Software'],
      hasVersion: [{ id: verId, label: ['v-old'], type: ['SoftwareVersion'] }],
    });
    trackId('softwares', swId);
    trackId('softwareversions', verId);

    const putRes = await inject(
      app, 'PUT',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
      {
        id: swId, label: ['sw-parent-stable'], type: ['Software'],
        hasVersion: [{ id: verId, label: ['v-new'], type: ['SoftwareVersion'] }],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
    );
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      label: string[];
    };
    expect(sw.label).toEqual(['sw-parent-stable']);

    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(verId)}`,
    );
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      label: string[];
    };
    expect(ver.label).toEqual(['v-new']);
  });
```

- [ ] **Step 4: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- nested-write-e2e
```

```bash
cd model-catalog-api
git add src/__tests__/e2e/nested-write-e2e.test.ts
git commit -m "test(e2e): nested PUT updates child label only (bug-089 target)"
```

- [ ] **Step 5: Add — POST mixes inline-new and ID-ref children**

Append:

```ts
  it('POST software with mixed inline-new and ID-ref hasVersion entries: new is created, ref is linked', async () => {
    const existingVerId = uniqueId('softwareversion');
    const existingSwShellId = uniqueId('software');
    // Pre-create the referenced version under its own software shell so we have an
    // existing row to reference.
    await inject(app, 'POST', '/v2.0.0/softwares', {
      id: existingSwShellId, label: ['shell'], type: ['Software'],
      hasVersion: [{ id: existingVerId, label: ['v-pre'], type: ['SoftwareVersion'] }],
    });
    trackId('softwares', existingSwShellId);
    trackId('softwareversions', existingVerId);

    const newSwId = uniqueId('software');
    const newVerId = uniqueId('softwareversion');
    const res = await inject(app, 'POST', '/v2.0.0/softwares', {
      id: newSwId, label: ['sw-mixed'], type: ['Software'],
      hasVersion: [
        { id: newVerId, label: ['v-fresh'], type: ['SoftwareVersion'] },
        { id: existingVerId },
      ],
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    trackId('softwares', newSwId);
    trackId('softwareversions', newVerId);

    // Existing version label MUST NOT have been overwritten by the link.
    const verGet = await inject(
      app, 'GET',
      `/v2.0.0/softwareversions/${encodeURIComponent(existingVerId)}`,
    );
    const ver = (Array.isArray(verGet.body) ? verGet.body[0] : verGet.body) as {
      label: string[];
    };
    expect(ver.label).toEqual(['v-pre']);

    // Note: hasVersion is a childFk relationship, so the existing version's FK may move
    // from existingSwShellId to newSwId. Do not assert directionality of the move here;
    // just assert the existing row's data was preserved.
  });
```

- [ ] **Step 6: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- nested-write-e2e
```

```bash
cd model-catalog-api
git add src/__tests__/e2e/nested-write-e2e.test.ts
git commit -m "test(e2e): nested POST mixed inline+ref preserves existing data (bug-089 target)"
```

- [ ] **Step 7: Add — PUT replaces nested children**

Append:

```ts
  it('PUT software replaces hasVersion children: old children no longer linked, new children present', async () => {
    const swId = uniqueId('software');
    const oldVerId = uniqueId('softwareversion');
    const newVerId = uniqueId('softwareversion');

    await inject(app, 'POST', '/v2.0.0/softwares', {
      id: swId, label: ['sw-replace'], type: ['Software'],
      hasVersion: [{ id: oldVerId, label: ['v-old'], type: ['SoftwareVersion'] }],
    });
    trackId('softwares', swId);
    trackId('softwareversions', oldVerId);

    const putRes = await inject(
      app, 'PUT',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
      {
        id: swId, label: ['sw-replace'], type: ['Software'],
        hasVersion: [{ id: newVerId, label: ['v-new'], type: ['SoftwareVersion'] }],
      },
    );
    expect(putRes.statusCode).toBeGreaterThanOrEqual(200);
    expect(putRes.statusCode).toBeLessThan(300);
    trackId('softwareversions', newVerId);

    const swGet = await inject(
      app, 'GET',
      `/v2.0.0/softwares/${encodeURIComponent(swId)}`,
    );
    const sw = (Array.isArray(swGet.body) ? swGet.body[0] : swGet.body) as {
      hasVersion?: { id: string }[];
    };
    const ids = sw.hasVersion?.map((v) => v.id) ?? [];
    expect(ids).toContain(newVerId);
    expect(ids).not.toContain(oldVerId);
  });
```

- [ ] **Step 8: Run + commit**

```
cd model-catalog-api && npm run test:e2e -- nested-write-e2e
```

```bash
cd model-catalog-api
git add src/__tests__/e2e/nested-write-e2e.test.ts
git commit -m "test(e2e): nested PUT replaces child set (bug-089 target)"
```

---

## Task 10: Project-local skill `run-e2e-hasura`

**Files:**
- Create: `model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md`

- [ ] **Step 1: Create the skills directory + SKILL.md**

Run: `mkdir -p model-catalog-api/.claude/skills/run-e2e-hasura`

Create `model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md`:

````markdown
---
name: run-e2e-hasura
description: Use when running, writing, or debugging end-to-end integration tests for model-catalog-api against the local Hasura dev server at http://graphql.mint.local. Triggers on "run e2e", "test against hasura", "e2e fails", or working with files under model-catalog-api/src/__tests__/e2e/.
---

# Run E2E Tests Against Local Hasura

## What this is

End-to-end integration tests that exercise the full pipeline:

```
Vitest → buildApp() → fastify.inject() → routes → service.ts
       → Apollo Client → http://graphql.mint.local/v1/graphql → Postgres
```

In-process Fastify + real Apollo + real local Hasura. No mocks below the HTTP layer.

Suite is gated behind `npm run test:e2e`. Default `npm test` stays mock-only and fast.

## Prereqs

1. Local Hasura must be reachable at `http://graphql.mint.local/v1/graphql`. Quick check:

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" \
     -X POST http://graphql.mint.local/v1/graphql \
     -H "X-Hasura-Admin-Secret: CHANGEME" \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __typename }"}'
   ```
   Expected: `200`. If not: check `/etc/hosts` for `graphql.mint.local` and confirm any `kubectl port-forward` is running.

2. `npm install` is up to date inside `model-catalog-api/`.

## Run

```bash
cd model-catalog-api
npm run test:e2e                          # all e2e files
npm run test:e2e -- junction-e2e          # one file
npm run test:e2e -- nested-write-e2e
```

## Environment variables

Defaults set by `src/__tests__/e2e/setup.ts`. Set in shell only to override.

| Var | Default | Purpose |
|-----|---------|---------|
| `HASURA_GRAPHQL_URL` | `http://graphql.mint.local/v1/graphql` | Local Hasura GraphQL endpoint. |
| `HASURA_ADMIN_SECRET` | `CHANGEME` | Admin secret. Must match local Hasura config. |
| `MINT_E2E_MODE` | `1` (forced) | Flips `getWriteClient()` to use admin-secret instead of Bearer. |
| `LOG_LEVEL` | `warn` | Reduces Fastify log noise during tests. |

## Writing new e2e tests

Use the helpers in `src/__tests__/e2e/helpers.ts`:

```ts
import { inject, trackId, uniqueId } from './helpers.js';

const id = uniqueId('software');                // collision-proof, prefixed with run id
trackId('softwares', id);                       // remember to delete in afterAll
const res = await inject(app, 'POST', '/v2.0.0/softwares', { id, label: ['x'], type: ['Software'] });
```

Rules:
- Always assert via a fresh GET, not the response body. Catches read-vs-write divergence (the bug-087 class).
- Always `trackId(resource, id)` for every entity created. Cleanup runs in `afterAll`.
- Never share IDs across tests — `uniqueId(kind)` is collision-proof per call.

## Hierarchy delete order

`cleanup(app)` deletes in REVERSE creation order. Track parents before children:

```
Software → SoftwareVersion → ModelConfiguration → ModelConfigurationSetup
```

If you create a Setup, also `trackId` the Config, Version, and Software it depends on (in that order, parents first).

## Don'ts

- No `--threads` and no parallel test files. The shared dev DB makes parallel writes step on each other. The vitest config (`vitest.e2e.config.ts`) enforces `singleFork`.
- No fixture seeds. Each test creates its own parents inline.
- Never run this suite against a shared production DB. The cleanup is best-effort, not guaranteed.

## Debugging recipes

| Symptom | Cause / Fix |
|---------|-------------|
| `Local Hasura unreachable at http://graphql.mint.local/v1/graphql` | `kubectl port-forward` not running, or `/etc/hosts` missing the entry, or Hasura pod down. |
| `401`/`403` on a write-path test | `MINT_E2E_MODE=1` not set in the shell when running outside `npm run test:e2e`. |
| GraphQL error `field … not found in type …` | Schema drift. Run `cd model-catalog-api && npm run codegen` against the current Hasura, then re-check assertions. |
| `cleanup: N orphan(s) remain` warning at end of run | Manual SQL cleanup needed. The warning prints the `RUN_ID` and the SQL templates. Run them in `psql` against the local DB. |
| Test hangs > 30s | Hasura is slow or hung. Check `kubectl logs` for the Hasura pod and `kubectl logs` for the Postgres pod. |
| New e2e test fails on a fresh Hasura but passes against the deployed cluster | Local Hasura migrations / metadata are out of sync. Apply migrations from `graphql_engine/`. |

## Manual orphan cleanup (if `RUN_ID` is known)

```sql
-- Replace RUN_ID with the value printed in the cleanup warning.
DELETE FROM modelcatalog_software_version_grid
  WHERE software_version_id LIKE '%-RUN_ID-%' OR grid_id LIKE '%-RUN_ID-%';
DELETE FROM modelcatalog_software_version WHERE id LIKE '%-RUN_ID-%';
DELETE FROM modelcatalog_software WHERE id LIKE '%-RUN_ID-%';
DELETE FROM modelcatalog_grid WHERE id LIKE '%-RUN_ID-%';
DELETE FROM modelcatalog_configuration WHERE id LIKE '%-RUN_ID-%';
```

If the `RUN_ID` is unknown, all e2e rows have the prefix `e2e-` in the ID local part:

```sql
DELETE FROM modelcatalog_software WHERE id LIKE '%/software-e2e-%';
-- (and equivalent per table)
```
````

- [ ] **Step 2: Verify the file is well-formed**

Run: `head -5 model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md`

Expected: shows the YAML frontmatter starting with `---` and a `name:` and `description:` line.

- [ ] **Step 3: Commit**

```bash
cd model-catalog-api
git add .claude/skills/run-e2e-hasura/SKILL.md
git commit -m "docs(skill): add run-e2e-hasura project-local skill"
```

---

## Task 11: CLAUDE.md pointer

**Files:**
- Modify: `model-catalog-api/CLAUDE.md`

- [ ] **Step 1: Read the current CLAUDE.md to find an appropriate insertion point**

Run: `wc -l model-catalog-api/CLAUDE.md && head -40 model-catalog-api/CLAUDE.md`

Identify a section heading like "Testing" or "Development" or the end of the file. The pointer goes there.

- [ ] **Step 2: Append the pointer**

Append the following block to the END of `model-catalog-api/CLAUDE.md`:

```markdown

## Local Hasura E2E Tests

E2E integration tests against the local Hasura dev server are run with `npm run test:e2e`. For details on prereqs, env vars, writing new tests, debugging, and orphan cleanup, invoke the `run-e2e-hasura` skill.
```

- [ ] **Step 3: Commit**

```bash
cd model-catalog-api
git add CLAUDE.md
git commit -m "docs(claude): point to run-e2e-hasura skill"
```

---

## Task 12: Final verification

- [ ] **Step 1: Confirm `npm test` (mocked) still passes**

Run: `cd model-catalog-api && npm test`

Expected: all original tests pass plus `hasura-client.test.ts` (2 added in Task 3). No e2e files run.

- [ ] **Step 2: Confirm `npm run test:e2e` runs the e2e suite**

Run: `cd model-catalog-api && npm run test:e2e`

Expected: junction-e2e tests PASS (6 tests). Nested-write tests may FAIL pending bug-089 — that is acceptable and is the regression target. Capture the exact pass/fail counts.

- [ ] **Step 3: Confirm cleanup leaves no orphans**

Inspect the test output for `cleanup: N orphan(s) remain`. If present, follow the manual SQL recipe in the skill and report the ids to the user.

- [ ] **Step 4: Surface results to the user**

Report:
- All committed task numbers and SHAs.
- E2E pass/fail counts for both files.
- Whether any orphan rows remained.
- Any test that failed unexpectedly (not a known bug-089 gap).

No commit in this task — verification only.

---

## Self-Review Notes

**Spec coverage check:**
- Architecture (in-process Fastify + admin-secret + local Hasura): Tasks 2–5.
- `MINT_E2E_MODE` branch in `getWriteClient`: Task 3.
- Helpers (`uniqueId`, `trackId`, `cleanup`, `inject`): Task 4.
- Setup (env defaults, app builder, health-check): Task 5.
- Junction tests covering 6 cases (bug-087 class): Tasks 6–7.
- Nested-write tests covering 5 cases (bug-089 class): Tasks 8–9.
- Skill at `model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md`: Task 10.
- CLAUDE.md pointer: Task 11.
- Vitest config split (default mock-only + e2e config): Tasks 1–2.
- Sequential execution (`singleFork`): Task 2.
- Health-check fail-fast: Task 5.
- Cleanup ordering rule: Task 4 (`reverse()` traversal).
- Orphan recovery SQL: Task 4 (warning) + Task 10 (skill recipe).

**Placeholder scan:** none. Every test body, env table, and SQL recipe is fully specified.

**Type/name consistency:** `inject(app, method, path, payload?)`, `uniqueId(kind)`, `trackId(resource, id)`, `cleanup(app)`, `assertHasuraReachable()`, `buildE2EApp()`, `applyE2EEnv()`, `RUN_ID`, `E2E_HEADERS`, `MINT_E2E_MODE` — used consistently across all tasks.
