---
phase: 02-api-integration
plan: 02
subsystem: api
tags: [fastify, apollo-client, graphql, typescript, openapi, node]

# Dependency graph
requires:
  - phase: 01-schema-and-data-migration
    provides: Hasura schema and GraphQL endpoint with modelcatalog tables
provides:
  - Node.js/TypeScript project at /Users/mosorio/repos/model-catalog-api with all dependencies
  - Fastify server with health endpoint at /health
  - Apollo Client module (readClient + getWriteClient) for Hasura communication
  - OpenAPI v2.0.0 spec with operationId on all 243 endpoint operations
  - graphql-codegen config ready to generate typed operations when Hasura is available
affects: [02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added:
    - fastify@5 (HTTP server)
    - fastify-openapi-glue@4.10.2 (OpenAPI-driven route generation - wired in plan 04)
    - @apollo/client@4 (GraphQL client for Hasura, Node.js /core entrypoint)
    - @fastify/cors, @fastify/jwt, @fastify/swagger, @fastify/swagger-ui
    - @graphql-codegen/cli + typescript + typescript-operations + typescript-document-nodes
    - tsx (TypeScript runner for dev), vitest (testing), typescript@5
  patterns:
    - ESM-first project (type=module, Node16 module resolution)
    - Apollo Client used via @apollo/client/core (no React dependency)
    - readClient with no-cache policy for always-fresh Hasura data
    - getWriteClient factory creates per-request client with user JWT forwarded
    - OpenAPI spec is single source of truth; operationIds map to Fastify handler methods

key-files:
  created:
    - /Users/mosorio/repos/model-catalog-api/package.json
    - /Users/mosorio/repos/model-catalog-api/tsconfig.json
    - /Users/mosorio/repos/model-catalog-api/.gitignore
    - /Users/mosorio/repos/model-catalog-api/openapi.yaml
    - /Users/mosorio/repos/model-catalog-api/codegen.ts
    - /Users/mosorio/repos/model-catalog-api/src/index.ts
    - /Users/mosorio/repos/model-catalog-api/src/app.ts
    - /Users/mosorio/repos/model-catalog-api/src/hasura/client.ts
  modified: []

key-decisions:
  - "Apollo Client v4 used via @apollo/client/core for Node.js server (no React/browser deps)"
  - "ApolloClient in v4 is non-generic class; getWriteClient returns ApolloClient (not ApolloClient<unknown>)"
  - "type=module added to package.json to enable ESM and import.meta support with Node16 module resolution"
  - "openapi.yaml has 243 endpoint operations (5 per resource for CRUD + custom endpoints), all with operationIds"
  - "Health endpoint returns 503 with hasura=unreachable when Hasura not available (correct behavior)"
  - "fastify-openapi-glue route registration deferred to plan 04 (needs service handlers first)"

patterns-established:
  - "Pattern 1: All imports use .js extension for ESM compatibility"
  - "Pattern 2: readClient uses X-Hasura-Admin-Secret; getWriteClient forwards user JWT"
  - "Pattern 3: Fastify app is a factory function (buildApp) separate from server start"

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 2 Plan 02: Project Scaffold Summary

**Fastify v5 + Apollo Client v4 REST API scaffold with OpenAPI v2.0.0 spec (243 operationIds), Hasura GraphQL client, and graphql-codegen config in a new ESM TypeScript project**

## Performance

- **Duration:** 5 min 14s
- **Started:** 2026-02-21T11:26:38Z
- **Completed:** 2026-02-21T11:31:52Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created `/Users/mosorio/repos/model-catalog-api` as a new ESM TypeScript project with all Fastify and Apollo Client dependencies
- Copied OpenAPI spec from FastAPI repo, bumped to v2.0.0, and added operationId to all 243 endpoint operations
- Fastify server starts and the `/health` endpoint returns JSON (503 when Hasura unavailable, 200 when connected)
- Apollo Client module exports `readClient` (admin secret, no-cache) and `getWriteClient(token)` factory for JWT passthrough

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project with dependencies and configuration** - `dcd5773` (chore)
2. **Task 2: Create Fastify app, Apollo Client, and codegen config** - `bb0ff0f` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `/Users/mosorio/repos/model-catalog-api/package.json` - Project manifest with fastify, @apollo/client, type=module
- `/Users/mosorio/repos/model-catalog-api/tsconfig.json` - ES2022/Node16 with strict mode
- `/Users/mosorio/repos/model-catalog-api/.gitignore` - node_modules, dist, .env, src/generated/
- `/Users/mosorio/repos/model-catalog-api/openapi.yaml` - v2.0.0 spec with 243 operationIds
- `/Users/mosorio/repos/model-catalog-api/codegen.ts` - graphql-codegen config for typed Hasura operations
- `/Users/mosorio/repos/model-catalog-api/src/index.ts` - Server entrypoint with graceful shutdown
- `/Users/mosorio/repos/model-catalog-api/src/app.ts` - Fastify app factory with health endpoint
- `/Users/mosorio/repos/model-catalog-api/src/hasura/client.ts` - Apollo Client setup for Hasura

## Decisions Made

- **Apollo Client v4 is non-generic**: `ApolloClient` in v4 is no longer a generic class. Return type is `ApolloClient` (not `ApolloClient<unknown>`).
- **ESM module setup**: Added `"type": "module"` to package.json so `import.meta` works with Node16 module resolution in tsconfig. This also requires `.js` extensions on imports for Node.js ESM compatibility.
- **openapi-glue deferred**: fastify-openapi-glue registration is left as a comment in app.ts -- plan 04 wires handlers when service class exists.
- **243 operationIds**: The spec has 243 operations (not 105) -- the research counted paths, but each path has multiple HTTP methods. All 243 are covered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ApolloClient<unknown> generic type removed in Apollo Client v4**
- **Found during:** Task 2 (Hasura client creation)
- **Issue:** `getWriteClient` return type declared as `ApolloClient<unknown>` but Apollo Client v4 is no longer a generic class
- **Fix:** Changed return type to plain `ApolloClient`
- **Files modified:** src/hasura/client.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** bb0ff0f (Task 2 commit)

**2. [Rule 1 - Bug] @fastify/swagger StaticPathSpec requires baseDir field**
- **Found during:** Task 2 (app.ts swagger registration)
- **Issue:** TypeScript error: `Property 'baseDir' is missing in type '{path: string}' but required in type 'StaticPathSpec'`
- **Fix:** Added `baseDir: path.dirname(OPENAPI_SPEC_PATH)` to swagger specification options
- **Files modified:** src/app.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** bb0ff0f (Task 2 commit)

**3. [Rule 1 - Bug] import.meta requires ESM module type declaration**
- **Found during:** Task 2 (app.ts path resolution with import.meta.url)
- **Issue:** `error TS1470: The 'import.meta' meta-property is not allowed in files which will build into CommonJS output`
- **Fix:** Added `"type": "module"` to package.json to enable ESM
- **Files modified:** package.json
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** bb0ff0f (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs - all TypeScript type/config errors)
**Impact on plan:** All fixes necessary for TypeScript compilation. Apollo Client v4 API change from v3. No scope creep.

## Issues Encountered

None beyond the TypeScript compilation errors fixed inline above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Project scaffold complete; all subsequent plans build on this foundation
- graphql-codegen will run once Hasura is accessible (plan 03 or when Hasura is deployed)
- fastify-openapi-glue wiring happens in plan 04 when service handlers exist
- Hasura mutation permissions (insert/update/delete for `user` role) must be added before write operations work -- this is a known prerequisite identified in research

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
