# Parallel Application Pod Startup

Status: Implemented

## Objective

Change the MINT dev deployment lifecycle so the normal application rollout
updates only the selected application pods' exact SHA image references and
dispatches restart requests for the affected application set without polling.

PostgreSQL and Redis remain persistent/static infrastructure and are excluded
from the normal application restart batch.

## User need

The current deployment script starts or restarts pods in canonical order and
waits for each pod before proceeding. This makes a full application restart
take the sum of every pod's startup time and creates unnecessary coupling
between services that can boot independently.

The desired behavior is a narrow image-tag update followed by pod restarts. The
deploy action must not mutate networking/CORS, apply schema changes, grant
owners, run health checks, or wait for readiness.

## Current code/system summary

`deploy/tapis/register_mint_stack.py` defines the pod order as PostgreSQL,
Redis, GraphQL, API, Ensemble Manager, SVO, semantic search, and UI. The
deployment workflow uses dedicated image-only and restart-only paths; full pod
registration and protected database migration remain available as separate
manual operations.

The GitHub workflow invokes image-only mode for changed application services and
restart-only mode for dependency services. PostgreSQL and Redis are filtered out
of both operations. Apart from the explicit admin-permission step below, the
workflow does not invoke UI auth sync, schema migration, metadata, health, or
readiness steps.

Every deploy run separately ensures that `wmobley` has Tapis `APPROVEDADMIN` permission
on every pod, including PostgreSQL and Redis. This permission step is strict:
an absent pod or rejected grant fails the deploy.

The application dependency relationships are:

- GraphQL uses PostgreSQL and the external auth webhook.
- API uses GraphQL at request/health-check time.
- Ensemble Manager uses Redis and GraphQL at request/queue-processing time.
- SVO uses GraphQL and the catalog API at request/sync time.
- Semantic search uses PostgreSQL directly and retries its initial embedding
  index if catalog tables are not ready.
- UI calls GraphQL, Ensemble Manager, and semantic search from the browser.

## Proposed design

### Normal application rollout

1. Resolve the selected application pods from `build_services` and
   `restart_services`, excluding PostgreSQL and Redis.
2. For each changed application service, send a Tapis update containing only
   its pod ID and exact manifest image reference.
3. Dispatch restart requests for all affected application pods in canonical
   order without waiting between requests or polling afterward.

Image selection is per service, never one shared tag for the whole batch:

- A service in `build_services` receives the exact immutable image reference
  from the manifest, normally
  `ghcr.io/mintproject/<image>:sha-<short-sha>`.
- A dependency-only service in `restart_services` keeps its currently running
  image and is restarted without an image update.
- Manual dispatch may explicitly use `:develop`, as it does today, but that
  tag must be intentional and limited to the services selected by the manual
  manifest.
The image-only path requires an exact image reference for every changed service;
it does not submit environment variables, resources, networking, CORS, or auth
settings. Dependency-only services are restarted with their existing image.

### Static infrastructure

Normal application deployment does not select, update, restart, or recreate
PostgreSQL or Redis. Protected database migration remains a separate explicit
operation outside this workflow.

### Schema-change rollout

Schema migrations, metadata updates, and schema smoke tests are not part of the
deploy action. They must be run separately when required.

### UI authentication synchronization

The deploy action does not synchronize UI networking or auth allowlists. Existing
manual auth-sync functionality remains outside this rollout.

### Failure behavior

Tapis update or restart request failures stop the workflow. Already-dispatched
pods are not automatically rolled back; immutable image tags remain the
recovery mechanism.

## Files likely affected

- `deploy/tapis/register_mint_stack.py`
  - add an image-only update path that sends only `pod_id` and `image`;
  - add a restart-only dispatch path with no readiness polling;
  - preserve the existing full-registration and protected PostgreSQL paths.
- `deploy/tapis/test_register_mint_stack.py`
  - test image-only update payloads;
  - test restart dispatch without pod lookups or polling;
  - preserve PostgreSQL/Redis static infrastructure boundaries.
- `.github/workflows/deploy-mint-dev-pods.yml`
  - ensure `wmobley` is an approved admin on every pod;
  - remove UI auth, migration, metadata, health, and readiness steps;
  - invoke only image-tag update and application restart operations.
- `docs/deploy/mint-dev-pods.md`
  - document batch dispatch, aggregate readiness, static PostgreSQL/Redis, and
    schema-change behavior.
- `docs/design/2026-09-16-selective-mint-dev-deploy.md`
  - record the implementation decision and link this rollout refinement if the
    change is approved and implemented.

## API/schema changes

No application API or database schema changes are proposed.

The internal Python deployment helper interface may change. Tapis pod APIs,
image names, environment variables, and external service URLs remain unchanged.

## Data flow

1. The image workflow produces `build_services`, `restart_services`, and exact
   image references.
2. The deploy workflow ensures `wmobley` has `APPROVEDADMIN` permission on every pod.
3. It filters PostgreSQL and Redis from image and restart sets.
4. The image-only path updates only changed application image fields.
5. The restart-only path dispatches all affected application restart requests
   without readiness polling.

## Risks and tradeoffs

- Services may briefly observe an unavailable dependency because restarts are
  dispatched without readiness polling.
- A later pod may be dispatched even if an earlier request failed; Tapis errors
  stop the local sequence but do not roll back requests already submitted.
- The action intentionally provides no runtime health signal; operators must
  inspect the pods separately when needed.

## Alternatives considered

- **Keep serial start-and-wait behavior:** rejected because it unnecessarily
  adds independent startup times and is the behavior being changed.
- **Update complete pod definitions:** rejected because the deploy action should
  not mutate networking, CORS, auth, resources, or environment variables.
- **Run migrations and endpoint health checks:** rejected because this action is
  intentionally limited to image-tag updates and pod restarts.

## Test plan

- Test that image-only updates send only `pod_id` and exact `image`.
- Test that all restart requests are dispatched without pod lookups or polling.
- Test that static PostgreSQL and Redis pods are rejected by these paths.
- Test that normal application deployment does not touch PostgreSQL or Redis.
- Test that the manifest image map still rejects wrong repositories/tags.
- Run the existing deployment unit-test suite and workflow/static validation.

## Documentation plan

Update `docs/deploy/mint-dev-pods.md` with:

- static PostgreSQL/Redis policy;
- image-only update and restart-only dispatch semantics;
- the fact that the action does not modify networking or run readiness checks.

## Rollout/rollback plan

1. Implement the image-only and restart-only paths without changing pod IDs or
   image names.
2. Run offline tests using fake Tapis responses.
3. Inspect the planned application image map; do not touch PostgreSQL or Redis
   in the normal path.
4. Test a low-risk UI-only or semantic-search-only develop deployment and
   confirm only image and restart requests are sent.
5. If the rollout is unhealthy, revert the deployment-script/workflow
   change and restore prior immutable image tags using the existing rollback
   procedure. Do not delete persistent infrastructure volumes.

## Open questions

- Should a separate operator workflow provide readiness and health checks when
  needed, or remain entirely manual?

## Decisions

### 2026-09-18 - Batch application lifecycle dispatch

- **Decision:** Plan to dispatch restarts/starts for all selected application
  pods first, then wait for the selected set to become available.
- **Reason:** Reduce startup latency and avoid waiting for independent services
  one at a time.
- **Alternatives rejected:** Unconstrained threaded startup and removal of
  readiness checks.
- **User feedback:** The user requested restarting all pieces and waiting for
  availability afterward.
- **Impact on implementation:** Deployment lifecycle code and tests must split
  request dispatch from aggregate readiness verification.

### 2026-09-18 - Keep PostgreSQL and Redis static in normal rollout

- **Decision:** Exclude PostgreSQL and Redis from the normal application
  restart/start batch.
- **Reason:** The user identified both as fairly static infrastructure that
  should not be restarted for application rollouts.
- **Alternatives rejected:** Treating them as the first two stages of every
  application startup.
- **User feedback:** “PostgreSQL → Redis. These we don't restart. They should
  be fairly static.”
- **Impact on implementation:** Normal workflow selection and lifecycle tests
  must assert that neither pod receives a restart request.

### 2026-09-18 - Preserve per-service image tags during batch startup

- **Decision:** Batch startup must use an explicit expected image per service.
  Built services use the manifest's immutable SHA tag; dependency-only services
  retain their current image. The aggregate readiness check verifies the exact
  per-service image.
- **Reason:** Restarting all application pieces must not force unchanged pods
  onto a moving or unrelated tag.
- **Alternatives rejected:** Passing one shared image tag to the whole restart
  batch, which could overwrite dependency-only services or mask a tag mismatch.
- **User feedback:** The user emphasized that the tag must be correct.
- **Impact on implementation:** The deployment helper needs per-service image
  resolution and verification, and the workflow must pass the manifest image
  map rather than relying on a single global tag.

### 2026-09-18 - Narrow deploy action to image update and restart

- **Decision:** The application lifecycle portion of the deploy workflow sends
  only exact application image updates and restart requests. It does not modify
  UI networking/CORS, apply migrations or metadata, run endpoint health checks,
  or poll for pod readiness. A separate strict admin-permission step runs first.
- **Reason:** The user requested a cleanup that makes deployment responsible
  only for updating the SHA tag and restarting pods.
- **Alternatives rejected:** Keeping the broader orchestration in the deploy
  action, which mixed pod lifecycle with application configuration and runtime
  verification.
- **User feedback:** “It should ONLY restart the pods and update the SHA tag.
  Don't do cors don't do any other checks JUST restart the pods.”
- **Impact on implementation:** The workflow uses a strict owner-grant path plus
  image-only and restart-only script paths; database and Redis remain excluded
  from image and lifecycle operations.

### 2026-09-18 - Ensure wmobley is admin on every pod

- **Decision:** Every deploy run grants `wmobley` Tapis `APPROVEDADMIN` permission on
  every MINT dev pod and fails if any pod is absent or rejects the grant.
- **Reason:** The user explicitly requested that `wmobley` be an approved admin
  on all pods.
- **Impact on implementation:** The workflow runs the strict owner-grant path
  before image updates and application restarts; it includes PostgreSQL and
  Redis.

## User feedback / decisions

- User clarified that the desired change is startup/restart ordering, not pod
  deletion.
- User clarified that PostgreSQL and Redis should remain static and outside the
  normal restart batch.
- User requested batch restart dispatch, then narrowed the deploy action to
  image-tag updates and restart requests without readiness polling.
- User required the exact SHA image tag to be applied.
- User approved implementation on 2026-09-18.

## Implementation result

Implemented in `deploy/tapis/register_mint_stack.py`,
`.github/workflows/deploy-mint-dev-pods.yml`,
`deploy/tapis/test_register_mint_stack.py`, and
`docs/deploy/mint-dev-pods.md`.

The implementation ensures `wmobley` is an admin on every pod, passes the
manifest's per-service image map through the
workflow, updates only changed application image fields, dispatches restart
requests without polling, and filters PostgreSQL/Redis out of normal lifecycle
work. Owner grants, UI auth synchronization, schema migration/metadata, and
endpoint health checks were removed from the deploy workflow. The broader
registration and protected PostgreSQL paths remain available outside this
workflow.
