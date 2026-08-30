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
