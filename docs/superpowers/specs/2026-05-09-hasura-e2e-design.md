# E2E Integration Tests Against Local Hasura Dev Server

**Date:** 2026-05-09
**Scope:** `model-catalog-api`
**Status:** Design approved, awaiting user review

## Problem

The `model-catalog-api` test suite has two coverage layers, both with gaps:

1. `src/__tests__/integration.test.ts` — mocks Apollo Client. Validates the request-translation pipeline (operationId → CRUD → GraphQL string) but never executes against a real Hasura schema. Cannot catch schema drift, real SQL constraint violations, junction `on_conflict` semantics, or nested-write FK ordering.
2. `src/__tests__/junction-integration.test.ts` — hits the deployed cluster API at `api.models.mint.local/v2.0.0`. Requires a Tapis bearer token, pollutes a shared production-adjacent database, and is too slow / fragile for a tight inner loop or CI.

Recent bugs prove the gap:
- **bug-087** — junction `on_conflict` clause clobbered existing labels. Mocked tests passed; only deployed traffic surfaced it.
- **bug-089** (in flight) — recursive nested POST/PUT semantics. Same class of failure: lives in the Fastify-to-Hasura translation layer, invisible to mocks.

We need a fast, local, repeatable e2e layer that exercises the full pipeline (Fastify → Apollo → real Hasura → PostgreSQL) against the local Hasura dev server.

## Goals

- Run real CRUD against `http://graphql.mint.local/v1/graphql` from the developer machine in seconds.
- Catch the failure modes mocks miss: junction `on_conflict`, nested writes, FK ordering, schema drift.
- Default `npm test` stays mock-only and fast. E2E suite opts in via `npm run test:e2e`.
- Self-clean test data on a shared dev database — no truncation, no fixture seeds.
- Discoverable by future Claude Code sessions via a project-local skill.

## Non-Goals (first iteration)

- JWT auth path coverage (admin-secret only).
- Hasura permission-rule coverage.
- Performance, large-payload, or concurrency testing.
- Comprehensive CRUD-per-resource coverage. Focus on junction + nested-write classes only.
- Automatic orphan cleanup tooling (manual SQL recipe documented instead).

## Architecture

```
vitest test file
  │
  ├─ beforeAll: set HASURA_GRAPHQL_URL=http://graphql.mint.local/v1/graphql
  │             set HASURA_ADMIN_SECRET=CHANGEME
  │             set MINT_E2E_MODE=1
  │             health-check Hasura, fail fast on unreachable
  │             buildApp() → Fastify instance
  │
  ├─ test: app.inject({ method, url, headers, payload })
  │             ↓
  │        Fastify routes → service.ts → CatalogServiceImpl
  │             ↓
  │        readClient / getWriteClient (real Apollo, real network)
  │             ↓
  │        http://graphql.mint.local/v1/graphql (real Hasura + Postgres)
  │
  └─ afterAll: DELETE all tracked test IDs in reverse creation order
```

Key choices:
- `fastify.inject()` — no real socket bind, no port management. Same routing path, deterministic, debuggable.
- `MINT_E2E_MODE=1` flag flips `getWriteClient()` from Bearer-JWT auth to admin-secret auth in a single conditional.
- Real Apollo Client, real network to local Hasura. No client mocks.
- Admin-secret on both read and write paths.

## Files

### New

| Path | Purpose |
|------|---------|
| `src/__tests__/e2e/setup.ts` | Set env vars, build Fastify app once per file, expose `app` + Hasura health-check. |
| `src/__tests__/e2e/helpers.ts` | `injectRequest()`, `uniqueId()`, `trackId()`, `cleanup()`. |
| `src/__tests__/e2e/junction-e2e.test.ts` | Junction CRUD (bug-087 class). |
| `src/__tests__/e2e/nested-write-e2e.test.ts` | Recursive nested POST/PUT (bug-089 class). |
| `vitest.e2e.config.ts` | Vitest config matching only `src/__tests__/e2e/**`, sequential, longer timeout. |

### Modified

| Path | Change |
|------|--------|
| `src/hasura/client.ts` | In `getWriteClient(bearerToken)`, add `if (process.env.MINT_E2E_MODE === '1')` branch using `X-Hasura-Admin-Secret` instead of `Authorization: Bearer`. Single conditional, no other paths affected. |
| `package.json` | Add `"test:e2e": "vitest run --config vitest.e2e.config.ts"`. Existing `"test"` unchanged (still mock-only). |
| `model-catalog-api/CLAUDE.md` | Add one-line pointer: e2e against local Hasura uses the `run-e2e-hasura` skill. |
| `model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md` | New skill (see Skill section). |

## Environment Contract

| Var | Default in `setup.ts` | Purpose |
|-----|----------------------|---------|
| `HASURA_GRAPHQL_URL` | `http://graphql.mint.local/v1/graphql` | Local Hasura dev server. |
| `HASURA_ADMIN_SECRET` | `CHANGEME` | Admin-secret auth. Matches local Hasura config. |
| `MINT_E2E_MODE` | `1` (forced by `setup.ts`) | Flips `getWriteClient` to admin-secret path. |

`setup.ts` does NOT overwrite a var the user already set, so a developer can point the suite at a different Hasura instance via shell export.

## Code Change to `hasura/client.ts`

```ts
export function getWriteClient(bearerToken: string): ApolloClient {
  const headers = process.env.MINT_E2E_MODE === '1'
    ? { 'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET }
    : { Authorization: bearerToken };

  return new ApolloClient({
    link: new HttpLink({
      uri: HASURA_GRAPHQL_URL,
      headers,
      fetch: globalThis.fetch,
    }),
    cache: new InMemoryCache(),
    defaultOptions: { query: { fetchPolicy: 'no-cache' } },
  });
}
```

Single conditional. Production path unchanged when `MINT_E2E_MODE` unset.

## Data Lifecycle

### ID convention

```ts
import { randomUUID } from 'node:crypto';

const RUN_ID = `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
export const uniqueId = (kind: string) =>
  `https://w3id.org/okn/i/mint/${kind}-${RUN_ID}`;
```

One `RUN_ID` per test file. Greppable, collision-proof on a shared dev DB.

### Tracking + cleanup

```ts
const created: { resource: string; id: string }[] = [];

export function trackId(resource: string, id: string) {
  created.push({ resource, id });
}

export async function cleanup(app: FastifyInstance) {
  for (const { resource, id } of [...created].reverse()) {
    try {
      await app.inject({
        method: 'DELETE',
        url: `/v2.0.0/${resource}/${encodeURIComponent(id)}`,
      });
    } catch (err) {
      console.warn(`cleanup: failed to delete ${resource}/${id}`, err);
    }
  }
  created.length = 0;
}
```

Rules:
- Track in creation order, delete in reverse.
- Hierarchy delete order: Setup → Config → Version → Software (children first).
- Cleanup swallows individual delete errors (log only) so one stuck row doesn't block the rest.

### Orphan recovery (manual, out of scope)

If a suite crashes mid-run, orphans match `id LIKE '%-e2e-<timestamp>-%'`. Documented manual SQL recipe in the skill. Automation deferred.

## Test Cases

### `junction-e2e.test.ts` — bug-087 class

1. POST software with `hasGrid` junction → GET → assert grid IDs persist, labels unchanged.
2. POST software with `hasGrid` referencing existing grid by ID → assert existing grid label NOT clobbered (direct bug-087 regression).
3. PUT software replace `hasGrid` set → assert old junction rows gone, new rows present.
4. PUT software with empty `hasGrid: []` → assert all junctions deleted.
5. POST with duplicate junction targets in payload → assert dedup, no constraint violation.
6. POST referencing non-existent grid ID → assert 4xx, no orphan junction created.

### `nested-write-e2e.test.ts` — bug-089 class

7. POST software with inline nested `hasVersion` (new version object, not ID-ref) → assert version row created and linked.
8. POST software with nested version → nested config → nested setup (3-deep) → assert full tree persists.
9. PUT software updating a nested version's label → assert version row updated, parent software label unchanged.
10. POST mixed: some nested children new, some by ID-ref → assert correct insert vs link behavior per child.
11. PUT replacing nested children → assert old children handled per spec (orphaned or deleted), new children present.

### Assertion pattern

```ts
const { statusCode, payload } = await app.inject({
  method: 'POST', url: '/v2.0.0/softwares', headers, payload: body,
});
expect(statusCode).toBe(201);
const created = JSON.parse(payload);
trackId('softwares', created.id);

const { payload: getPayload } = await app.inject({
  method: 'GET', url: `/v2.0.0/softwares/${encodeURIComponent(created.id)}`,
});
const fetched = JSON.parse(getPayload);
expect(fetched.hasGrid).toEqual(
  expect.arrayContaining([{ id: gridId, label: originalLabel }]),
);
```

Always assert via a fresh GET, not the response body. Catches read-vs-write divergence (the bug-087 class).

## Vitest Config

`vitest.e2e.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/e2e/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // sequential, shared DB safety
  },
});
```

No `--threads`. Shared dev DB → parallel tests step on each other.

## Error Handling

| Failure | Behavior |
|---------|----------|
| Hasura unreachable in `beforeAll` | Health-check fails → throw with message: "Local Hasura unreachable at $HASURA_GRAPHQL_URL. Check kubectl port-forward / /etc/hosts." |
| Schema drift (table or column missing) | Apollo throws GraphQL error → test fails with full error path in output. |
| Cleanup partial fail | Per-ID try/catch logs warning, continues. Final orphan list printed at end of run. |
| FK violation in cleanup | Reverse-order delete should prevent. If hit, log + continue. |
| Test crash mid-run | Orphans tagged `e2e-<ts>-` and greppable in DB. Skill documents manual SQL cleanup. |

## Skill

`model-catalog-api/.claude/skills/run-e2e-hasura/SKILL.md`:

```yaml
---
name: run-e2e-hasura
description: Use when running, writing, or debugging e2e integration tests for model-catalog-api against the local Hasura dev server. Triggers on "run e2e", "test against hasura", "e2e fails", or adding tests under src/__tests__/e2e/.
---
```

Body sections:
1. **Prereqs** — Hasura reachable at `http://graphql.mint.local/v1/graphql`, admin secret known, `npm install` done.
2. **Run** — `npm run test:e2e` (single file: `npm run test:e2e -- junction-e2e`).
3. **Env vars** — table from Environment Contract section above.
4. **Writing new tests** — use `helpers.ts` (`uniqueId`, `trackId`, `injectRequest`); follow ID convention; always GET-back to assert.
5. **Hierarchy delete order** — Setup → Config → Version → Software (children first).
6. **Debugging recipes**:
   - Test hangs → check Hasura logs.
   - 401/403 on write → `MINT_E2E_MODE=1` not set, write path used Bearer.
   - Schema drift error → run `npm run codegen` against current Hasura.
   - Orphan rows after crash → `DELETE FROM modelcatalog_software WHERE id LIKE 'https://w3id.org/okn/i/mint/%-e2e-%';` (and equivalent for related tables).
7. **Don'ts** — no parallel threads, no fixture seed, no running against shared production DB.

## CLAUDE.md Pointer

Append to `model-catalog-api/CLAUDE.md`:

> **E2E tests against local Hasura:** invoke the `run-e2e-hasura` skill.

## Open Questions

None. All clarified during brainstorming:
- Architecture: in-process Fastify via `fastify.inject()`.
- Auth: admin-secret bypass via `MINT_E2E_MODE=1`.
- Data lifecycle: self-cleanup with timestamp-suffixed IDs.
- Scope: junction + nested-write classes only, first iteration.
- Documentation: project-local skill (not CLAUDE.md, not AGENTS.md).
