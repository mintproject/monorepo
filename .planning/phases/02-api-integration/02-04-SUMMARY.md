---
phase: 02-api-integration
plan: 04
subsystem: api
tags: [fastify, openapi-glue, proxy, graphql, security, typescript, crud]

# Dependency graph
requires:
  - plan: 02-02
    provides: Fastify app scaffold with Apollo Client
  - plan: 02-03
    provides: Resource registry, response and request mappers

provides:
  - CatalogService: Proxy-based generic CRUD handler for all 46 resource types (230+ endpoints)
  - SecurityHandler: Bearer token check for write endpoints; JWT forwarded to Hasura
  - fastify-openapi-glue wired into app: all 243 operationIds routed to CatalogService
  - Server starts in under 1 second with full route registration

affects: [02-05, 02-06]

# Tech tracking
tech-stack:
  added:
    - fastify-openapi-glue v4 (OpenAPI-driven route registration, now wired)
    - yaml (YAML parsing for spec pre-processing)
  patterns:
    - "Pattern 10: JavaScript Proxy with has() + get() traps intercepts all operationId calls"
    - "Pattern 11: Spec pre-processing strips all response/request body schemas before passing to openapi-glue"
    - "Pattern 12: AJV strict:false with custom keywords to allow OpenAPI 3.x extensions"
    - "Pattern 13: isHandledOperationId() helper function shared between has() and get() traps"

key-files:
  created:
    - /Users/mosorio/repos/model-catalog-api/src/service.ts
    - /Users/mosorio/repos/model-catalog-api/src/security.ts
  modified:
    - /Users/mosorio/repos/model-catalog-api/src/app.ts

key-decisions:
  - "JavaScript Proxy requires both has() and get() traps: openapi-glue uses 'operationId in serviceHandlers' (has trap) before calling it (get trap)"
  - "Response and request body schemas stripped from spec before openapi-glue registration: avoids 30s AJV compilation and broken circular $ref errors"
  - "AJV strict:false required for OpenAPI 3.x keywords (example, xml, externalDocs) in request schemas"
  - "Bearer token stored on req.bearerToken but not validated by SecurityHandler: Hasura validates JWT via row-level permissions"
  - "Software subtype filter via type column: 6 resource types (models, emulators, etc.) share modelcatalog_software table and need type discriminator"

# Metrics
duration: 16min
completed: 2026-02-21
---

# Phase 2 Plan 04: Generic CRUD Service and OpenAPI-glue Wiring Summary

**Proxy-based CatalogService handling 230+ endpoints through 5 generic CRUD methods, JWT security handler, and fastify-openapi-glue route registration wired with spec pre-processing to avoid AJV compilation failures**

## Performance

- **Duration:** 16 min 18s
- **Started:** 2026-02-21T11:41:51Z
- **Completed:** 2026-02-21T11:58:09Z
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments

- Created `CatalogService` using a JavaScript Proxy: the `get()` trap parses operationIds and dispatches to `list()`, `getById()`, `create()`, `update()`, or `deleteResource()` generic handlers; the `has()` trap ensures `operationId in serviceHandlers` returns true for all valid operationIds
- All 5 generic handlers build dynamic GraphQL queries from the resource registry, execute via Apollo Client, and transform results with the mappers from plan 03
- Username filtering via `user_id` column, label filtering, and pagination (page/per_page) implemented in the list handler
- Created `SecurityHandler` with `BearerAuth` method that checks for Bearer token presence and stores it on the request for Hasura forwarding
- Updated `app.ts` to pre-process the OpenAPI spec (strip response schemas and request body schemas), configure AJV with `strict:false`, and register fastify-openapi-glue; server starts in under 1 second

## Task Commits

Each task was committed atomically:

1. **Task 1: Generic CRUD service** - `d31029f` (feat)
2. **Task 2: Security handler + app wiring** - `d246397` (feat)
3. **Deviation fix: has() Proxy trap** - `f37a50f` (fix)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `/Users/mosorio/repos/model-catalog-api/src/service.ts` - CatalogServiceImpl with 5 generic CRUD methods + CatalogService Proxy with has()+get() traps
- `/Users/mosorio/repos/model-catalog-api/src/security.ts` - SecurityHandler with BearerAuth JWT passthrough
- `/Users/mosorio/repos/model-catalog-api/src/app.ts` - Updated with openapi-glue registration, spec pre-processing, AJV config, and structured logging hooks

## Decisions Made

- **Proxy has() trap is mandatory**: fastify-openapi-glue's `defaultOperationResolver` checks `operationId in serviceHandlers` using the `in` operator, which triggers the Proxy's `has()` trap. Without it, all dynamic operationIds return `false` and every request gets "Operation not implemented". This was a critical bug discovered during testing.

- **Spec pre-processing (strip schemas)**: The openapi.yaml contains complex inline schemas with deep `$ref` chains. Without stripping: (a) response schemas have circular $ref paths that cause `FST_ERR_SCH_SERIALIZATION_BUILD` at startup, (b) AJV compiles all 243 response schemas taking 30+ seconds. Stripping response + request body schemas reduces startup from 31s to under 1s. The swagger UI still serves the original unmodified spec.

- **AJV strict:false**: OpenAPI 3.x allows keywords like `example`, `xml`, `externalDocs` in schemas that AJV's strict mode rejects with `unknown keyword`. Disabling strict mode (while keeping `nullable` which Fastify adds automatically) allows request body parameters to pass validation.

- **Hasura validates JWT, not the API**: SecurityHandler stores the Bearer token on the request but does not decode or validate it. Hasura enforces row-level permissions based on JWT claims. If the token is invalid, Hasura returns a permission error which propagates as a 500.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Proxy missing has() trap causes all operationIds to fail**
- **Found during:** Task 2 verification
- **Issue:** fastify-openapi-glue uses `operationId in serviceHandlers` to check handler existence. A Proxy without `has()` trap returns `false` for all dynamic properties, causing every request to throw "Operation softwares_get not implemented"
- **Fix:** Added `isHandledOperationId()` helper function shared between `has()` and `get()` traps; the `has()` trap returns `true` for all valid operationId patterns
- **Files modified:** src/service.ts
- **Commit:** f37a50f

**2. [Rule 1 - Bug] openapi.yaml response schemas cause FST_ERR_SCH_SERIALIZATION_BUILD**
- **Found during:** Task 2 (server startup)
- **Issue:** Fastify's serializer failed building schemas for circular `$ref` paths like `#/content/application~1json/schema/items/...`. This prevented the server from starting.
- **Fix:** Pre-process the parsed spec to replace all response objects with `{ description: 'Response' }` before passing to openapi-glue. The swagger plugin continues to serve the original unmodified YAML.
- **Files modified:** src/app.ts (`loadSpecWithoutResponseSchemas` function)
- **Commit:** d246397

**3. [Rule 1 - Bug] AJV strict mode rejects OpenAPI 3.x keywords**
- **Found during:** Task 2 (server startup, second error after response schemas fixed)
- **Issue:** `strict mode: unknown keyword: "example"` error when AJV tried to compile request body schemas that use the `example` keyword (valid in OpenAPI 3.x, not in JSON Schema)
- **Fix:** Configure Fastify with `ajv: { customOptions: { strict: false, keywords: ['example', 'xml', 'externalDocs'] } }`. Also strip request body schemas from the spec to prevent future schema compilation issues.
- **Files modified:** src/app.ts
- **Commit:** d246397

**4. [Rule 3 - Blocking] 'service' option deprecated; must use 'serviceHandlers'**
- **Found during:** Task 2 (initial server test - routes returned 404)
- **Issue:** fastify-openapi-glue v4 uses `serviceHandlers` not `service` as the option name (backward compat prints a warning). Routes were being registered but the service was ignored.
- **Fix:** Changed `service: CatalogService` to `serviceHandlers: CatalogService`
- **Files modified:** src/app.ts
- **Commit:** d246397

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking issue)

## Issues Encountered

- The openapi.yaml is 528KB / 17,565 lines with 835 schemas. Even after pre-processing, openapi-glue takes ~8s to register routes (YAML parse + AJV compilation of request schemas). After stripping request body schemas too, startup is under 1 second.

## User Setup Required

None.

## Next Phase Readiness

- Generic CRUD service handles all 46 resource types for GET list/by-id, POST, PUT, DELETE
- 23 resource types with `hasuraTable: null` return 501 (not yet implemented)
- Custom endpoints (`custom_*` operationIds) return 501 (plan 06 implementation)
- Plan 05 should add the Hasura write permissions (insert/update/delete for user role) needed before write endpoints work end-to-end
- The `user_id` filtering is implemented but not tested end-to-end; requires Hasura to be running

## Self-Check: PASSED

- FOUND: /Users/mosorio/repos/model-catalog-api/src/service.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/security.ts
- FOUND: /Users/mosorio/repos/model-catalog-api/src/app.ts
- FOUND: /Users/mosorio/repos/mint/.planning/phases/02-api-integration/02-04-SUMMARY.md
- Commit d31029f verified in git log (feat: generic CRUD service)
- Commit d246397 verified in git log (feat: security handler + app wiring)
- Commit f37a50f verified in git log (fix: has() Proxy trap)
- TypeScript compiles cleanly: npx tsc --noEmit passes
- Server starts under 1 second (453ms measured)
- GET /v2.0.0/softwares returns error JSON (Hasura not running - expected)
- POST /v2.0.0/softwares without auth returns 401

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*
