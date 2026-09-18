# Parallel Application Pod Startup

Status: Implemented

## Objective

Change the MINT dev deployment lifecycle so the normal application rollout
dispatches all selected application pod updates/restarts before waiting for
readiness. Then verify the affected pods as a group instead of waiting for one
pod to become available before starting the next.

PostgreSQL and Redis remain persistent/static infrastructure and are excluded
from the normal application restart batch.

## User need

The current deployment script starts or restarts pods in canonical order and
waits for each pod before proceeding. This makes a full application restart
take the sum of every pod's startup time and creates unnecessary coupling
between services that can boot independently.

The desired behavior is to restart the application pieces together, then wait
for the selected set to become available.

## Current code/system summary

`deploy/tapis/register_mint_stack.py` defines the pod order as PostgreSQL,
Redis, GraphQL, API, Ensemble Manager, SVO, semantic search, and UI. Its main
upsert loop processes that order sequentially. Existing-pod restarts and image
updates wait inside each pod operation before the loop advances.

The GitHub workflow invokes the script for changed images and separately invokes
restart-only mode for dependency-only services. Both paths inherit the
per-pod wait behavior. PostgreSQL has an explicit SQL-readiness gate and is
protected by persistent storage handling. Redis is not normally selected by the
change planner.

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

Refactor lifecycle handling into dispatch and verification phases:

1. Resolve the selected application pods from `build_services` and
   `restart_services`.
2. Update or create the selected pod definitions without waiting for each pod
   to become `AVAILABLE`.
3. Dispatch starts/restarts for all selected application pods. Dispatch may
   retain canonical request ordering for deterministic Tapis behavior, but it
   must not perform a readiness wait between requests.
4. After all lifecycle requests have been submitted, wait for every selected
   pod to report the expected image, a new container start time when a restart
   was requested, and `AVAILABLE` status.
5. Run the existing application health checks for the affected endpoints.

Image selection is per service, never one shared tag for the whole batch:

- A service in `build_services` receives the exact immutable image reference
  from the manifest, normally
  `ghcr.io/mintproject/<image>:sha-<short-sha>`.
- A dependency-only service in `restart_services` keeps its currently running
  image and is restarted without an image update.
- Manual dispatch may explicitly use `:develop`, as it does today, but that
  tag must be intentional and limited to the services selected by the manual
  manifest.
- Aggregate readiness verification checks each pod against its own expected
  image reference. A pod reporting a different tag is a rollout failure even if
  its lifecycle status is `AVAILABLE`.

The same aggregate behavior applies to dependency-only restarts. The
restart-only path must collect the prior start time and image for every pod,
submit every restart request, and only then wait for the complete set.

### Static infrastructure

Normal application deployment does not select, update, restart, or recreate
PostgreSQL or Redis. PostgreSQL remains an explicit protected migration path
only when its own image/context is selected. Redis remains an existing static
dependency for Ensemble Manager.

The existing PostgreSQL SQL-readiness gate remains unchanged for the explicit
database migration path. This change does not make database startup parallel
with application startup.

### Schema-change rollout

Schema changes retain a GraphQL readiness gate before migrations are applied.
The deployment must not run Hasura migrations until GraphQL is healthy.

After the migration step, the affected application pods can be dispatched as a
batch and verified together. Semantic search may start before its first index
query completes because its current startup code retries when catalog tables
are temporarily unavailable; the final health check still must pass.

If implementation testing shows that a particular schema migration requires
semantic search to remain stopped until migrations complete, semantic search is
the only permitted dependency-specific exception; API, Ensemble Manager, SVO,
and UI still use the aggregate dispatch/wait behavior.

### UI authentication synchronization

The UI allowlist update must be folded into the same UI lifecycle plan so the UI
is not restarted once during image deployment and again during the auth-sync
step. The implementation should either:

- apply the networking allowlist before the batch and let the batch perform the
  single restart; or
- make the auth-sync operation update the definition without restarting and let
  the batch perform the single restart.

The chosen option must preserve the current behavior that the running Tapis
proxy uses the updated allowlist.

### Failure behavior

The deployment fails if any selected pod does not converge within the existing
bounded timeout. The final error must identify every pod that failed and its
last observed status/image/start time where available.

Already-dispatched pods are not automatically rolled back by this change.
Existing explicit rollback procedures and immutable image tags remain the
recovery mechanism.

## Files likely affected

- `deploy/tapis/register_mint_stack.py`
  - separate lifecycle dispatch from readiness verification;
  - accept/resolve per-service expected image references;
  - add aggregate restart/readiness helpers;
  - preserve PostgreSQL protection and existing image-mismatch safeguards;
  - coordinate UI auth synchronization with the batch restart.
- `deploy/tapis/test_register_mint_stack.py`
  - test that all restart requests are issued before any readiness wait;
  - test aggregate success and aggregate timeout/failure reporting;
  - test no duplicate UI restart;
  - preserve PostgreSQL/static infrastructure boundaries.
- `.github/workflows/deploy-mint-dev-pods.yml`
  - pass the manifest's per-service image references into the aggregate
    lifecycle API;
  - adjust step boundaries only if needed to use the aggregate lifecycle API;
  - preserve migration-before-dependent-health behavior.
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

1. The image workflow produces `build_services` and `restart_services`.
2. The deploy workflow grants owners on the affected existing pods.
3. The deploy script resolves the application batch, excluding normal
   PostgreSQL and Redis lifecycle operations.
4. Pod definitions are updated/created and lifecycle requests are dispatched
   without per-pod readiness blocking.
5. The script waits for all selected pods to converge as a group.
6. Schema changes use the existing GraphQL health/migration/metadata sequence.
7. The workflow runs affected endpoint health checks and reports the complete
   rollout result.

## Risks and tradeoffs

- Services may briefly observe an unavailable dependency because they start in
  parallel. Existing request-time clients and the semantic-search retry loop
  must tolerate this transient state.
- A later pod may be dispatched even if an earlier pod's update request failed;
  the implementation must stop dispatching on unrecoverable Tapis API errors
  and report which requests were already submitted.
- Aggregate waiting reduces wall-clock startup time but makes partial rollout
  failures more visible at the end rather than immediately after one pod.
- Tapis may impose request-rate or lifecycle concurrency limits. The first
  implementation should batch lifecycle requests without unbounded local
  threading; concurrency can be increased only if measured behavior supports
  it.
- UI auth synchronization has a separate networking mutation and can cause a
  duplicate restart unless it is explicitly integrated with the batch.

## Alternatives considered

- **Keep serial start-and-wait behavior:** rejected because it unnecessarily
  adds independent startup times and is the behavior being changed.
- **Start every pod with unconstrained parallel threads:** rejected initially
  because Tapis lifecycle rate limits and partial-failure handling are not yet
  established.
- **Start GraphQL, then serially start all dependents:** safer but still leaves
  avoidable sequential startup latency; retained only as a schema-migration
  fallback if testing reveals a real dependency.
- **Remove all readiness checks:** rejected because dispatch success does not
  prove that a pod is running the requested image or serving traffic.

## Test plan

- Unit-test a multi-pod restart with a fake Tapis client and record the call
  sequence. Assert that all restart requests occur before the first readiness
  polling call.
- Test aggregate readiness success when pods become available in different
  orders.
- Test aggregate timeout/failure reporting for one or more unavailable pods.
- Test image convergence and new-start-time requirements for restarted pods.
- Test mixed batches where some pods receive a new immutable SHA image and
  dependency-only pods retain their current image.
- Test that a wrong image tag fails verification even when the pod is
  `AVAILABLE`.
- Test dependency-only restart batching.
- Test that normal application deployment does not touch PostgreSQL or Redis.
- Test explicit PostgreSQL migration behavior remains protected and unchanged.
- Test UI allowlist synchronization results in one restart, not two.
- Test schema-change workflow ordering: GraphQL health before migration, then
  aggregate application rollout verification.
- Run the existing deployment unit-test suite and workflow/static validation.

## Documentation plan

Update `docs/deploy/mint-dev-pods.md` with:

- static PostgreSQL/Redis policy;
- batch restart and aggregate readiness semantics;
- schema-change exception;
- timeout and partial-failure behavior;
- the fact that Tapis request dispatch ordering is not readiness ordering.

## Rollout/rollback plan

1. Implement the lifecycle split behind the existing deployment script
   commands, without changing pod IDs, images, or secrets.
2. Run offline tests using fake Tapis responses.
3. Exercise a dry-run and inspect the planned application batch; do not touch
   PostgreSQL or Redis in the normal path.
4. Test a low-risk UI-only or semantic-search-only develop deployment and
   confirm all restart requests precede readiness polling.
5. Test a full application restart and a schema-change deployment separately.
6. If the batch rollout is unhealthy, revert the deployment-script/workflow
   change and restore prior immutable image tags using the existing rollback
   procedure. Do not delete persistent infrastructure volumes.

## Open questions

- Should missing application pods be created and started in the same batch as
  existing-pod restarts, or should creation remain a separate recovery path?
- Should the first implementation dispatch lifecycle requests sequentially
  without waits, or use bounded concurrency for the Tapis API calls?
- Should semantic search be allowed to start before schema migrations finish,
  relying on its retry loop, or remain the one schema-specific startup gate?
- Should the workflow perform application health checks for API and Ensemble
  Manager in addition to the existing GraphQL and semantic-search checks?

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

## User feedback / decisions

- User clarified that the desired change is startup/restart ordering, not pod
  deletion.
- User clarified that PostgreSQL and Redis should remain static and outside the
  normal restart batch.
- User requested batch restart dispatch followed by aggregate availability
  waiting.
- User required exact per-service image-tag preservation and verification during
  the batch restart.
- User approved implementation on 2026-09-18.

## Implementation result

Implemented in `deploy/tapis/register_mint_stack.py`,
`.github/workflows/deploy-mint-dev-pods.yml`,
`deploy/tapis/test_register_mint_stack.py`, and
`docs/deploy/mint-dev-pods.md`.

The implementation keeps image-definition convergence as a precondition before
dispatching lifecycle requests, then dispatches all selected application starts
or restarts before a single aggregate readiness wait. It passes the manifest's
per-service image map through the workflow, preserves current images for
dependency-only restarts, defers the UI auth restart into the application
batch, and filters PostgreSQL/Redis out of normal application lifecycle work.
The explicit PostgreSQL migration path remains serialized and protected.
