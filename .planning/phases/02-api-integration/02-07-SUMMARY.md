---
phase: 02-api-integration
plan: 07
subsystem: infra
tags: [docker, helm, kubernetes, github-actions, ci-cd, node]

# Dependency graph
requires:
  - phase: 02-api-integration
    provides: "model-catalog-api Node.js application with TypeScript source, openapi.yaml, src/, package.json"

provides:
  - Multi-stage Dockerfile producing a minimal node:20-alpine production image
  - GitHub Actions CI workflow with test gate before Docker Hub push
  - Helm Service + Deployment template for model-catalog-api-v2
  - Helm Ingress template routing /v2.0.0 paths to new service
  - values.yaml model_catalog_api_v2 component block (disabled by default)

affects:
  - 03-fuseki-migration-and-cleanup
  - deployment operations

# Tech tracking
tech-stack:
  added: [docker multi-stage build, github-actions, helm kubernetes templates]
  patterns:
    - Multi-stage Docker build: builder compiles TS, production stage only has dist/ + production deps
    - Helm component toggle: enabled: false default, operator sets true to deploy
    - Path-based ingress routing enables two API versions to coexist on same domain

key-files:
  created:
    - /Users/mosorio/repos/model-catalog-api/Dockerfile
    - /Users/mosorio/repos/model-catalog-api/.github/workflows/ci.yml
    - helm-charts/charts/mint/templates/model-catalog-api-v2.yaml
    - helm-charts/charts/mint/templates/ingress-model-catalog-api-v2.yaml
  modified:
    - helm-charts/charts/mint/values.yaml

key-decisions:
  - "openapi.yaml copied into production Docker image (required at runtime by fastify-openapi-glue)"
  - "Docker image name mintproject/model-catalog-api per locked Phase 02 decision"
  - "model_catalog_api_v2 disabled by default in values.yaml to avoid breaking existing deployments"
  - "HASURA_ADMIN_SECRET sourced from existing mint-secrets resource (optional: true) for consistency"
  - "Ingress routes /v2.0.0 path prefix so v1.8.0 (/v1.8.0) and v2.0.0 coexist on api.models.mint domain"

patterns-established:
  - "Helm component toggle pattern: all new components default to enabled: false"
  - "Health probe pattern: /health endpoint used for both liveness (10s delay, 30s period) and readiness (5s delay, 10s period)"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 2 Plan 07: Dockerfile, CI/CD, and Helm Deployment Summary

**Multi-stage Dockerfile, GitHub Actions CI pipeline, and Helm chart templates enabling containerized deployment of model-catalog-api-v2 alongside existing v1.8.0 via path-based ingress routing**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T12:17:48Z
- **Completed:** 2026-02-21T12:19:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Dockerfile builds a minimal production image: builder stage runs `tsc`, production stage has only dist/ and production dependencies
- GitHub Actions CI workflow: test job (tsc + vitest) gates build-and-push job; pushes `mintproject/model-catalog-api:{sha}` and `:latest` on main
- Helm templates follow exact patterns from existing `model-catalog.yaml` and `ingress-model-catalog.yaml`
- `/health` endpoint configured as liveness and readiness probe (consistent with plan spec)
- `HASURA_GRAPHQL_URL` and `HASURA_ADMIN_SECRET` configurable; v2 component disabled by default in values.yaml

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Dockerfile and GitHub Actions CI workflow** - `e8e3495` (chore) in model-catalog-api repo
2. **Task 2: Create Helm templates and values for the new API** - `de51966` (feat) in helm-charts submodule + `1076ca0` submodule pointer update in mint repo

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `/Users/mosorio/repos/model-catalog-api/Dockerfile` - Multi-stage node:20-alpine build
- `/Users/mosorio/repos/model-catalog-api/.github/workflows/ci.yml` - CI with test gate and Docker Hub push
- `helm-charts/charts/mint/templates/model-catalog-api-v2.yaml` - Service + Deployment with /health probes
- `helm-charts/charts/mint/templates/ingress-model-catalog-api-v2.yaml` - Ingress for /v2.0.0 path routing
- `helm-charts/charts/mint/values.yaml` - Added model_catalog_api_v2 component block

## Decisions Made
- `openapi.yaml` copied into the production Docker image because fastify-openapi-glue loads it at runtime from the filesystem
- Docker image named `mintproject/model-catalog-api` consistent with locked Phase 02-api-integration decision
- `model_catalog_api_v2.enabled: false` as default to prevent breaking existing Helm deployments that don't yet have Hasura configured
- `HASURA_ADMIN_SECRET` sourced from the existing `mint-prefix-secrets` Secret with `optional: true` so deployments without the secret don't fail
- Ingress uses `/v2.0.0` path prefix so v1.8.0 and v2.0.0 can coexist on `api.models.mint.tacc.utexas.edu`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

For CI to push to Docker Hub, the following repository secrets must be set on the `model-catalog-api` GitHub repo:
- `DOCKERHUB_USERNAME` - Docker Hub username (mintproject org)
- `DOCKERHUB_TOKEN` - Docker Hub access token with push permissions

## Next Phase Readiness

- Phase 2 API Integration is fully complete (all 7 plans done)
- Phase 3 (Fuseki Migration and Cleanup) can begin: Helm chart is ready to deploy v2, both API versions coexist on the same domain
- To deploy: set `components.model_catalog_api_v2.enabled=true` and `components.model_catalog_api_v2.environment.hasura_graphql_url=<url>` in Helm values

---
*Phase: 02-api-integration*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: /Users/mosorio/repos/model-catalog-api/Dockerfile
- FOUND: /Users/mosorio/repos/model-catalog-api/.github/workflows/ci.yml
- FOUND: helm-charts/charts/mint/templates/model-catalog-api-v2.yaml
- FOUND: helm-charts/charts/mint/templates/ingress-model-catalog-api-v2.yaml
- FOUND: .planning/phases/02-api-integration/02-07-SUMMARY.md
- FOUND commit e8e3495 (Task 1 - model-catalog-api repo)
- FOUND commit de51966 (Task 2 - helm-charts submodule)
- FOUND commit 1076ca0 (Task 2 - mint repo submodule pointer update)
