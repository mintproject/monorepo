# Selective MINT Dev Service Deployment

Status: Implemented

## Objective

Make MINT develop CI/CD rebuild and redeploy only the services affected by a
commit, while expanding the selection for known dependency and shared
infrastructure changes. Preserve the protected PostgreSQL volume and keep the
existing migration, metadata, health-check, and rollback safeguards.

## User need

The monorepo contains separate service directories, but the current develop
workflow builds all seven images and runs a broad deployment sequence for every
change. Developers need faster, lower-risk deployments where a UI change
restarts the UI only, a semantic-search change restarts semantic search only,
and infrastructure or schema changes intentionally expand to dependent
services.

The change does not redesign semantic search, CKAN, database indexing, or
production deployment. It only changes how the existing MINT develop image
and pod deployment is selected.

## Current code/system summary

`.github/workflows/build-mint-dev-images.yml` uses a static seven-service
matrix for every push and pull request. Pushes publish mutable branch tags and
short-SHA tags to GHCR. `.github/workflows/deploy-mint-dev-pods.yml` runs after
a successful develop image workflow and currently updates/restarts PostgreSQL
and GraphQL, applies migrations and metadata, starts semantic search, and
restarts the remaining application pods.

`deploy/tapis/register_mint_stack.py` already accepts pod selectors and has
protected handling for PostgreSQL storage, but its generated PostgreSQL route
must match the live, working Tapis definition before automatic deployment is
reenabled. The manual recovery showed that the default Tapis PostgreSQL route
is currently the working shape.

## Proposed design

### Change detection

Add a change-detection job to the image workflow. It compares the relevant
base and head revisions and emits:

- the changed service image keys (`build_services`);
- the services that must be restarted because of a dependency
  (`restart_services`);
- a `schema_changed` flag for GraphQL migrations, metadata, or config;
- a `deploy_all` flag for deployment code, workflow files, shared build files,
  root-level dependency/configuration changes, or an explicitly unclassifiable
  path.

Use `build_services` as a dynamic matrix. Pull requests build affected
images with `push: false`; branch pushes publish only affected images. A
commit with no deployable service changes should complete without building or
publishing images.

### Service ownership map

- `ui-react/**` → `ui`
- `semantic-search-service/**` → `semantic_search`
- `model-catalog-api/**` → `api`
- `mint-ensemble-manager/**` → `ensemble`
- `svo-adapter-service/**` → `svo`
- `graphql_engine/**` → `graphql`
- `docker/postgres-pgvector/**` → `postgres`

Changes to `.github/**` are control-only and produce a no-op deployment
manifest. Most `deploy/**` changes are also control-only, but
`deploy/tapis/register_mint_stack.py` is an exception: it defines live pod
configuration, so it selects the UI service and applies the updated pod
definition through the existing image-deploy path. Shared Docker/build
configuration, root dependency manifests, or other unowned paths expand to
`deploy_all`.

### Dependency expansion

- `postgres` changes set `build_services=postgres` and
  `restart_services=postgres,graphql,api,ensemble,svo,semantic_search`; the
  PostgreSQL pod uses the explicit volume-preserving migration path and is
  never handled by the stateless recreation fallback.
- GraphQL migration, metadata, or config changes set
  `build_services=graphql` and `restart_services=graphql,semantic_search`,
  with migrations before dependent startup and metadata application after
  services are healthy.
- GraphQL image-only changes deploy GraphQL only unless the changed files also
  match the schema/configuration paths.
- Application service changes deploy only that application service.
- `deploy_all` preserves the existing dependency order and health gates for the
  application stack, but deliberately excludes persistent PostgreSQL. A
  PostgreSQL image/context change is the only automatic selector for the
  protected database pod.

`build_services` controls which images receive the new immutable SHA tag.
`restart_services` controls which pods are restarted. A dependency-only
restart uses the pod's current image and does not require an image that was
not built for the current SHA.

The deployment workflow obtains an exact `changed-services.json` artifact from
the successful image workflow, rather than re-inferring changes from a
possibly different checkout. The artifact contains the source SHA,
`build_services`, `restart_services`, `schema_changed`, `deploy_all`, and the
published image tag for each built service. Deployment verifies that the
artifact source SHA matches `github.event.workflow_run.head_sha` before using
it. Missing, malformed, or mismatched artifacts fail closed.

### Image and pod behavior

Use the exact short-SHA image references in the build manifest as provenance
and fail-closed validation. Automatic dev deployment itself uses the moving
`:develop` runtime tag for each changed service, matching the dev stack's
runtime policy. Keep branch tags for convenience and retain the existing
protected image-mismatch behavior. Explicit image maps and direct deployment
script invocations may still use an immutable SHA tag for recovery or rollback.

Extend the deployment script only as needed to accept the manifest's
`build_services` and `restart_services` separately, update image definitions
only for built services, and restart dependency-only services without changing
their image. Owner grants and UI auth synchronization remain explicit
preflight operations and must not silently expand a no-op deployment into a
full pod-definition update. The
PostgreSQL route generated by the script must be the validated default Tapis
PostgreSQL route before the workflow change is rolled out.

## Files likely affected

- `.github/workflows/build-mint-dev-images.yml`
- `.github/workflows/deploy-mint-dev-pods.yml`
- `deploy/tapis/register_mint_stack.py`
- `deploy/tapis/test_register_mint_stack.py`
- `docs/deploy/mint-dev-pods.md`
- possibly a small workflow helper or manifest-generation script under
  `deploy/` if YAML-only change detection becomes difficult to test
- this design spec, including its final implementation/deviation status

## API/schema changes

None. This changes CI/CD selection and Tapis pod lifecycle orchestration only.
The workflow continues to use the existing Tapis pod API, GHCR images, Hasura
migrations, metadata, and health endpoints.

## Data flow

1. A push or pull request enters the image workflow.
2. Change detection maps paths to service keys and dependency flags.
3. Only affected image matrix entries build; push events publish their
   immutable SHA tags and a changed-service manifest artifact.
4. A successful develop image run triggers deployment.
5. Deployment downloads and verifies the manifest for the exact source SHA.
6. The selected pod set is expanded for schema/database/shared dependencies.
7. Tapis pod definitions and only selected images are updated/restarted in
   dependency order.
8. Migrations, semantic-search startup, metadata reload, health checks, and
   the final schema smoke test run only when their dependency set requires
   them.
9. Unselected application pods remain running and unchanged.

## Risks and tradeoffs

- Path classification can miss a shared dependency. An explicit conservative
  fallback to `deploy_all` is safer than silently omitting an application
  service, while persistent PostgreSQL is excluded from that fallback and can
  only be selected by its explicit image/context path.
- A workflow-run trigger cannot directly consume job outputs, so the manifest
  artifact must be retained and downloaded with exact-run and SHA checks.
- Immutable tags improve rollback and provenance, but the normal dev runtime
  uses a mutable `develop` tag and therefore does not provide immutable
  rollback semantics by itself.
- PostgreSQL image/config changes remain higher risk because the volume is
  persistent; automatic recreation stays disabled.
- Schema changes may require more dependent restarts than initially modeled;
  schema/config paths should be conservative and covered by integration tests.
- Partial deploy failures can leave a mixed-SHA stack; summaries and the
  manifest must make that state visible and rollback must be explicit.

## Alternatives considered

- **Keep building all images and only skip pod restarts:** rejected because it
  still consumes build time and publishes unnecessary images.
- **Use only GitHub path filters:** insufficient because dynamic service
  matrices and workflow-run deployment need a shared, auditable change set.
- **Recompute changed paths in the deploy workflow:** rejected as the primary
  source because it can disagree with the image workflow's base/head range.
- **Always deploy the full stack for schema or shared changes:** retained as a
  conservative fallback for application services, but PostgreSQL remains
  excluded unless its own image/context changes.
- **Use only mutable `develop` tags with no SHA validation:** rejected because
  the deployment must still prove that the completed image workflow produced
  the manifest being deployed. The runtime map uses `develop`, but the
  manifest's SHA references remain validated first.
- **Use immutable SHA tags for automatic dev runtime:** rejected because the
  dev Tapis stack is intentionally maintained on the moving `develop` tag.

## Test plan

- Unit-test path classification for every owned service, no-op changes, shared
  changes, workflow/deployment changes, and multi-service commits.
- Test dynamic matrix JSON for empty, single-service, and all-service cases.
- Test manifest creation, exact SHA association, and artifact consumption.
- Test deployment selector expansion and dependency ordering without making
  Tapis calls.
- Test that unselected pod definitions are not updated or restarted.
- Test PostgreSQL protection, route generation, and image-tag handling.
- Run workflow syntax validation and repository deployment tests.
- Test fail-closed behavior for missing, malformed, or wrong-SHA manifests.
- Perform a manual develop rollout for a semantic-search-only change, a UI-only
  change, a GraphQL schema change, and a shared deployment change.
- Verify health, image tags, pod start times, migration status, metadata
  consistency, and rollback behavior for each rollout class.

## Documentation plan

Update `docs/deploy/mint-dev-pods.md` with the ownership map, dependency
expansion rules, manifest/tag behavior, no-op behavior, and rollback procedure.
Correct the PostgreSQL route documentation to match the validated live Tapis
definition. Do not document automatic deployment as safe until the manual
rollout and debrief are complete.

## Rollout/rollback plan

1. Finish and validate the manual develop deployment, including the pending
   semantic-search SQL fix.
2. Correct the deployment script's PostgreSQL route source of truth.
3. Enable selective image builds on a branch and verify pull-request/no-op
   behavior without deployment.
4. Enable selective deployment for develop with conservative `deploy_all`
   fallbacks and a manual-dispatch override.
5. Observe at least one rollout per change class before narrowing fallbacks.
6. Roll back by reverting the workflow/script change and manually restoring
   the prior known-good image tags; never delete the PostgreSQL volume.

## Open questions

- Which root-level files should explicitly map to all services instead of using
  the conservative unowned-path fallback?
- Should GraphQL image-only changes restart semantic search, or only migration,
  metadata, and config changes?
- Should PostgreSQL code changes be deployable automatically after a dry-run,
  or remain manual-only?
- Should the manifest artifact be retained for the same period as workflow
  logs, or longer for rollback?
- Should manual dispatch support an explicit service selector for recovery?

## Decisions

### 2026-09-16 - Defer workflow edits until manual deployment is validated

- **Decision:** Do not modify the MINT GitHub deployment workflow until the
  manual stack is fully running and a deployment debrief is complete.
- **Reason:** The manual rollout exposed both a Tapis PostgreSQL route mismatch
  and a live SQL defect that automated checks did not catch.
- **Alternatives rejected:** Immediately editing CI/CD while the live stack was
  not validated would make the failure mode harder to isolate.
- **User feedback:** The user explicitly requested manual deployment and a
  debrief before updating MINT GitHub deployment.
- **Impact on implementation:** The manual route and SQL fixes were validated;
  selective workflow implementation proceeded after that gate was satisfied.

### 2026-09-16 - Use conservative dependency expansion

- **Decision:** Unowned/shared paths expand to all services, while ordinary
  application paths map to one service, known schema paths expand to their
  dependents, and CI/deployment plumbing paths are no-op.
- **Reason:** Missing a dependency is riskier than an occasional extra restart.
- **Alternatives rejected:** An aggressive minimal map that treats every path
  as isolated.
- **User feedback:** The user requested service-specific redeployments while
  allowing for services attached to different monorepo areas.
- **Impact on implementation:** Change detection needs explicit service and
  dependency outputs plus an all-services fallback.

### 2026-09-16 - Do not self-deploy CI/CD changes

- **Decision:** `.github/**` and `deploy/**` changes do not select an
  image or pod. A manual dispatch is required to apply deployment-code changes
  to the running stack.
- **Reason:** The first rollout of this workflow classified its own workflow
  and deploy-script changes as `deploy_all`, unexpectedly selecting PostgreSQL.
- **Impact on implementation:** The change classifier now treats those paths
  as control-only and tests both control-only and mixed service/control changes.

### 2026-09-16 - Use protected PostgreSQL image migration for selected tags

- **Decision:** A PostgreSQL image selected by the manifest is deployed with
  `--migrate-postgres-image`, which replaces only the pod definition and keeps
  `mintdevpostgresdata`; the generic stateless mismatch recovery is never used
  for PostgreSQL.
- **Reason:** The Tapis update operation does not change the PostgreSQL image,
  while the database volume must not be detached or recreated implicitly.
- **Impact on implementation:** `build_specs` now honors the requested image
  tag, storage validation accepts tags from the expected pgvector repository,
  and the workflow passes the protected migration flag only when PostgreSQL is
  selected.

### 2026-09-17 - Keep PostgreSQL out of normal full deploys

- **Decision:** Manual dispatches and conservative `deploy_all` fallbacks must
  exclude PostgreSQL. PostgreSQL is selected only for an explicit change under
  `docker/postgres-pgvector/` and then uses the protected migration path.
- **Reason:** PostgreSQL owns persistent state; routine application deploys
  must not restart or recreate it. The manual full deploy incorrectly passed
  PostgreSQL to the migration path because it expected `:develop` while the
  live pod used an immutable SHA image.
- **Alternatives rejected:** Treating every full application deploy as an
  opportunity to reconcile the database image, which caused the failed
  PostgreSQL replacement observed on 2026-09-17.
- **User feedback:** The user explicitly directed: “so don't do that.”
- **Impact on implementation:** Manual workflow manifests and unknown/shared
  path plans exclude PostgreSQL; focused planner tests cover the protected
  selection boundary.

### 2026-09-17 - Do not submit Tapis CORS settings during GraphQL creation

- **Decision:** Newly-created GraphQL pod specs include only the Tapis HTTP
  route. They do not submit `cors_allow_*` settings; existing pod updates omit
  networking and therefore preserve the live configuration.
- **Reason:** Tapis requires `APPROVEDADMIN` to submit CORS settings, and the
  normal deployment identity should not need that permission just to deploy an
  image. Hasura's application-level CORS environment setting remains separate.
- **Alternatives rejected:** Requiring every normal deployment to carry the
  privileged Tapis CORS payload, which blocked recovery when GraphQL was absent.
- **User feedback:** The user explicitly directed: “Then don't configure cors.”
- **Impact on implementation:** GraphQL spec generation and regression tests
  now enforce the route-only Tapis networking payload.

### 2026-09-18 - Apply Ensemble Manager API prefix in the deployed UI

- **Decision:** The UI pod receives the Ensemble Manager base URL with the
  `/v1` prefix, and changes to the Tapis pod-spec registration script select
  the UI deployment path.
- **Reason:** Ensemble Manager mounts the Tapis execution-engine route under
  `/v1/executionEngines/tapis`; the deployed UI was calling the pod root and
  received HTTP 404 responses.
- **Impact on implementation:** Pod-spec and change-plan regression tests now
  verify both the URL and the rollout selection.

### 2026-09-22 - Use develop tags for automatic dev runtime

- **Decision:** Automatic MINT dev deployments validate the immutable SHA
  references in the build manifest, then update selected Tapis pods with their
  corresponding `:develop` image references. Manual deployment already follows
  this policy.
- **Reason:** The dev stack is intentionally maintained on the moving
  `develop` tag. The previous workflow requested a SHA image while the live
  pod correctly reported `:develop`, causing the convergence guard to fail.
- **Alternatives rejected:** Sending SHA references to Tapis for automatic
  deployment, or using `develop` without validating the source manifest.
- **User feedback:** The user explicitly directed that all dev pods should use
  the `develop` tag.
- **Impact on implementation:** The deployment workflow now emits a separate
  develop-tag image map for Tapis updates and Hasura migrations while keeping
  the manifest's SHA map for provenance checks. The runbook and deployment
  design now document the two roles.

## User feedback / decisions

- User approved implementing service-aware deployment on 2026-09-16.
- The detailed manifest/tag/dependency design was implemented from that approval.
- Manual live validation of the new workflow remains a rollout follow-up after
  the branch is reviewed; no live deployment was triggered by this change.
