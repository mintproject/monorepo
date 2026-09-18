# Restore and organize the SVO Adapter API surface

## Status

Implemented

## Objective

Restore the SVO Adapter routes and OpenAPI organization present in the older
`feature/svo-adapter-service` implementation, while preserving the current
persistent Hasura, MINT sync, CKAN sync, and ETL behavior.

## User need

The live SVO `/docs` page and bundled UI are out of sync with the running
FastAPI application. The UI calls `/runtime-defaults`, `/dfc-targets`, and
`/objectives`, but the service returns 404 because those routes were removed
from the current branch. The API documentation also describes run-history and
DFC fan-out routes that are absent. The service needs one coherent, organized
API surface.

## Current code/system summary

- The current `svo-adapter-service/app/main.py` contains the core registry,
  planning, workflow, forecast, and admin routes, but lacks the fixture-backed
  objective/runtime/DFC lookup routes and several run-history routes.
- The bundled `static/js/main.js` and `components/history.js` call the missing
  routes, producing live 404s.
- `docs/api.md` documents the broader API surface, including objectives,
  DFC targets, run history, provenance, and DFC fan-out.
- `origin/feature/svo-adapter-service` at `df4cfd7` contains the missing route
  implementations and an `OPENAPI_TAGS` definition. Its `main.py` predates
  current persistent-data and ETL changes, so the whole file must not be
  merged wholesale.

## Proposed design

1. Add the fixture-backed, read-only routes from the older implementation:
   - `GET /runtime-defaults`
   - `GET /dfc-targets`
   - `GET /objectives`
   - `GET /objectives/{objective_id}`
   - `POST /objectives/{objective_id}/evaluate-plan`
2. Restore DFC fan-out planning at `POST /plans/dfc-fanout`, using the current
   planner and adapter persistence helpers.
3. Restore run-history support:
   - `GET /runs`
   - `POST /runs/{run_id}/poll`
   - `GET /runs/{run_id}/provenance`
   - add the required read queries beside the current run mutations in
     `app/main.py`.
4. Add the eight OpenAPI tag groups from the older design and assign existing
   and restored routes to the appropriate group. Keep `/docs` and `/openapi`
   behavior standard FastAPI; this changes organization and discoverability,
   not authentication semantics.
5. Add focused tests for route presence, OpenAPI tags, fixture filtering, and
   safe runtime-default responses. Preserve the existing demo-mode tests and
   avoid live database or Tapis writes.

## Files likely affected

- `svo-adapter-service/app/main.py`
- `svo-adapter-service/tests/test_demo_api.py` or a focused API-surface test
- `svo-adapter-service/docs/api.md`
- this design spec

## API/schema changes

No PostgreSQL schema changes are required. The service will expose the routes
already documented by the SVO API reference and expected by the bundled UI.
The restored fixture routes are read-only except that objective evaluation and
DFC fan-out persist adapter workflow plans/provenance through the existing
Hasura helpers, matching the older behavior.

OpenAPI tags:

- Core: Registry
- Core: Planning
- Core: Workflows
- Core: Runs
- Core: Catalog/objectives
- Integrations
- DFC/GAM
- NTGAM forecast

## Data flow

```text
bundled UI / API client
          ↓
FastAPI route surface + OpenAPI tags
          ↓
fixture lookups and current planner
          ↓
existing Hasura adapter tables for persisted plans/runs/provenance
```

## Risks and tradeoffs

- Porting the entire old branch could regress current persistent-data and ETL
  behavior; implementation will be selective.
- Fixture-backed objective and DFC data are read-only reference data and can
  become stale; this restores the existing documented contract rather than
  introducing a new catalog source.
- Polling a run through the API can update run status and provenance, so it
  must continue using the existing authorization/token behavior.
- Adding tags to many routes creates a broad diff but materially improves
  `/docs` navigation and does not change route URLs.

## Alternatives considered

- **Suppress the frontend 404s:** rejected because it hides documented API
  capabilities and leaves the UI/backend contract broken.
- **Merge the entire old feature branch:** rejected because it predates current
  persistent Hasura and ETL changes.
- **Create a second compatibility service:** rejected because the missing
  routes belong in the existing SVO FastAPI service.

## Test plan

- Run focused API tests in demo mode for the restored routes.
- Assert `/openapi.json` contains the restored paths and expected tag names.
- Test DFC filtering, objective lookup/not-found behavior, and that runtime
  defaults do not expose tokens.
- Exercise run-list/provenance query construction through existing demo mocks
  or focused client tests.
- Compile all SVO Python modules and run `git diff --check`.
- After deployment, verify the live OpenAPI route list and the UI’s prior 404
  paths return 200 or their documented data-dependent response.

## Documentation plan

Update the SVO API reference if route grouping or endpoint behavior differs
from the existing documented surface. Record the source commit and selective
porting decision here.

## Rollout/rollback plan

Build and deploy the SVO adapter image containing the restored routes. Verify
`/openapi.json`, `/docs`, the three formerly failing GET routes, and run-history
routes. Roll back by redeploying the previous image; no database rollback is
needed because the route additions use existing tables and fixtures.

## Open questions

- Whether the API should eventually move fixture-backed DFC/objective records
  into a catalog service rather than shipping them with the image.
- Whether admin-only seed routes should remain visible in OpenAPI or be hidden
  from the public docs in a later cleanup.

## Decisions

### 2026-09-18 - Selective restoration from the feature branch

- **Decision:** Port the missing routes, queries, and OpenAPI organization from
  `origin/feature/svo-adapter-service` at `df4cfd7` without merging the full
  branch.
- **Reason:** The old branch contains the intended API surface, but current
  HEAD contains newer persistence and ETL behavior that must be preserved.
- **Alternatives rejected:** Whole-branch merge and frontend-only suppression.
- **User feedback:** User explicitly requested bringing the old SVO APIs back.
- **Impact on implementation:** Changes remain focused on the SVO FastAPI
  surface and tests; no live deployment occurs in this implementation pass.

## User feedback / decisions

- 2026-09-18: User requested restoration of the organized SVO APIs from older
  branches.
- 2026-09-18: Implementation approved by the explicit request to bring them
  back.
- 2026-09-18: Restored the fixture/objective/DFC routes, run-history routes,
  Hasura read queries, and eight OpenAPI route groups. Python compilation,
  static route/tag inspection, and `git diff --check` passed. The HTTP
  TestClient suite remains to be run in an environment with the service's
  FastAPI dependencies installed.
