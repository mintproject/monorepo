# MINT Dev Tapis Pods Deployment

This runbook covers the MINT-only dev stack deployed to Tapis Pods from this repository.

## Stack

| Service | Pod ID | URL |
|---|---|---|
| PostgreSQL | `mintdevpostgres` | `mintdevpostgres.pods.portals.tapis.io:443` |
| Redis | `mintdevredis` | internal/pod template |
| Hasura GraphQL | `mintdevgraphql` | `https://mintdevgraphql.pods.portals.tapis.io` |
| Model Catalog API | `mintdevapi` | `https://mintdevapi.pods.portals.tapis.io` |
| Ensemble Manager | `mintdevensemble` | `https://mintdevensemble.pods.portals.tapis.io` |
| SVO Adapter | `mintdevsvo` | `https://mintdevsvo.pods.portals.tapis.io` |
| Semantic Search | `mintdevsemanticsearch` | `https://mintdevsemanticsearch.pods.portals.tapis.io` |
| React UI | `mintdevui` | `https://mintdevui.pods.portals.tapis.io` |

## Images

The build workflow publishes immutable commit tags for only the services changed
by a commit. The image names are:

```text
ghcr.io/mintproject/graphql-engine:<tag>
ghcr.io/mintproject/postgres-pgvector:<tag>
ghcr.io/mintproject/model-catalog-api:<tag>
ghcr.io/mintproject/ensemble-manager:<tag>
ghcr.io/mintproject/svo-adapter:<tag>
ghcr.io/mintproject/semantic-search:<tag>
ghcr.io/mintproject/ui:<tag>
```

For a source commit, `<tag>` is `sha-<7-character-commit>`. Pushes also publish
a branch tag, and the default branch publishes `latest`. Manual deployment uses
the moving `:develop` tags.

## GitHub Actions

- `MINT Dev Images` classifies changed paths, builds only affected custom images,
  and uploads an exact change manifest. Documentation-only changes produce a
  no-op manifest.
- `Deploy MINT Dev Pods` consumes that exact manifest after a successful image
  workflow on `develop`, plus manual dispatch. It updates only the exact SHA
  image references for changed application services, then sends restart
  requests for the affected application pods.
- Every deploy run first ensures `wmobley` has Tapis `APPROVEDADMIN` permission on all
  MINT dev pods, including PostgreSQL and Redis. The run fails if any pod is
  absent or rejects that grant.
- PRs build images with `push: false` and never deploy.

Changes only to `.github/**` or most `deploy/**` paths produce a no-op manifest.
The Tapis pod-spec registration script is the exception: changes to
`deploy/tapis/register_mint_stack.py` build and restart the affected UI pod so
environment-variable and runtime-definition changes reach the running stack.
Use manual dispatch for other deployment-code changes that need to be applied
to the running stack.

The manifest uses conservative dependency expansion: PostgreSQL source changes
explicitly select PostgreSQL and restart Hasura, the catalog API, Ensemble
Manager, SVO Adapter, and semantic search; GraphQL migrations restart Hasura
and semantic search; root build/dependency files and unknown paths select the
full application stack but deliberately exclude PostgreSQL. CI/deployment
plumbing changes are intentionally no-op. A dependency-only restart never
changes that service's image.

Normal application rollouts leave PostgreSQL and Redis alone. The deployment
updates only the image field on changed application pods with the manifest's
exact SHA image references, then sends restart requests for the complete
affected application set—GraphQL, API, Ensemble Manager, SVO, semantic search,
and UI. Dependency-only pods retain their current image. The deploy job does
not change networking or CORS, apply schema changes, run health checks, or poll
for readiness. Its separate admin-permission step is the only non-lifecycle
mutation.

The automated deploy validates only the manifest identity and exact SHA image
references before making any image or restart request. A missing, malformed, or
mismatched manifest fails closed. A no-op manifest skips image updates and
restarts, but still runs the strict `wmobley` admin-permission step.

The image-update request sends only `pod_id` and `image`; it does not resubmit
environment variables, resources, networking, CORS, or auth settings. Restart
requests are dispatched without readiness polling.

PostgreSQL image changes use the protected volume-preserving replacement path;
the pod is replaced only with `--migrate-postgres-image`, and the existing
`mintdevpostgresdata` volume is retained. All other image mismatches may use
the stateless recreation fallback.

The deploy job uses the `Tapis Dev Deploy` GitHub Environment.

The Tapis permitted-image list must include
`ghcr.io/mintproject/semantic-search` before the first deployment that creates
`mintdevsemanticsearch`; otherwise Tapis will reject the pod definition.

The UI receives `https://mintdevsemanticsearch.pods.portals.tapis.io` as its
`SEMANTIC_SEARCH_API` runtime setting and calls that service's `/search` route.
The semantic-search pod receives the exact `mintdevui` origin through
`SVO_CORS_ORIGINS`, so browser requests are permitted without a wildcard CORS
policy.

### Semantic-search API targets

`GET /search?q=<text>&target=<target>&limit=<n>` supports `target=svo` (the
backward-compatible default) and `target=model_configuration`. Both targets
return ranked rows with `score`, `ranking_source`, and relationship `evidence`. Repeated
`region_id`, `category_id`, `variable_id`, and `output_variable_id` parameters
are deterministic hard filters; `role=input|output` scopes variable links.
SVO rows include attached model/configuration links. Model-configuration rows
include attached standard variables, categories, regions, and software-version
metadata.

Problem-statement-driven discovery is exposed as the named
`problem_statement_recommendations` capability:

```text
POST /problem-statements/recommendations
GET  /problem-statements/{id}/recommendations
```

The POST body can contain `title`/`name`, `description`, `goals`,
`region_id`, selected variable or configuration IDs, and `category_ids`. Both
routes return SVO and model-configuration results. They return
`status=abstained` with empty result lists when there is insufficient text
context; hard filters are never relaxed silently. Dataset search remains on
the CKAN path.

PostgreSQL uses Tapis's default PostgreSQL networking route on port 5432. Tapis
exposes that route externally through
`mintdevpostgres.pods.portals.tapis.io:443`; Hasura and semantic search both
receive that hostname in their database URL.

Schema migrations, metadata updates, and application health checks are outside
the deploy action. Run them separately when a schema change requires them.

## Required environment secrets

Configure these in the `Tapis Dev Deploy` environment:

```text
TAPIS_USERNAME or TAPIS_ID
TAPIS_PASSWORD
```

The deploy workflow does not require database, Hasura-admin, or auth-hook
secrets because it only updates application image fields and sends restart
requests. It does require permission to grant `wmobley` `APPROVEDADMIN` on all pods.

## Local restart

From `monorepo/`, with Tapis credentials in the environment:

```bash
python deploy/tapis/register_mint_stack.py \
  --restart-existing-pods api,ui,ensemble,svo
```

This mode only restarts existing pods and refuses to create or update them.
It dispatches all selected restart requests and returns without polling.

## Manual restart

Use GitHub Actions → `Deploy MINT Dev Pods` → `workflow_dispatch` to perform a
full application deployment from the selected ref using the moving `:develop`
image tags. This updates and restarts application pods only; it does not touch
PostgreSQL or Redis.

## Caveats

- Production deployment is out of scope.
- PostgreSQL schema initialization and Hasura metadata synchronization are not
  part of the `Deploy MINT Dev Pods` workflow.
- The Ensemble Manager image entrypoint materializes `ENSEMBLE_MANAGER_CONFIG_JSON` into a runtime config file and sets `ENSEMBLE_MANAGER_CONFIG_FILE` before starting the app.
- GraphQL deployment fails closed unless either `MINTDEV_HASURA_JWT_SECRET` or `MINTDEV_HASURA_AUTH_HOOK` is configured. Existing Hasura auth environment variables are preserved during image-mismatch recovery, and the GitHub Actions deploy passes these secrets through to the pod definition.
- Tapis Pod template details for Redis/PostgreSQL should be validated during the first dev deployment.

## Persistent PostgreSQL storage

The registration script uses the Tapis `postgres:16postgis3.5` template with the
published PostgreSQL 16/PostGIS image that includes pgvector,
`ghcr.io/mintproject/postgres-pgvector:develop`, and the dedicated Tapis volume
`mintdevpostgresdata`. The volume mounts at `/var/lib/postgresql/data`;
`PGDATA` is `/var/lib/postgresql/data/pgdata`. PostGIS is required by the first
MINT migration (`public.geometry`). For a new database pod, the volume is created
if absent, with a 10,240 MB size warning threshold, and reused on subsequent
deployments. If an existing pod's volume is missing, deployment stops instead
of silently creating empty replacement storage.

Volume mounts use the current Tapis format: the container mount path is the
dictionary key, with `type: tapisvolume` and `source_id: mintdevpostgresdata`.
The deployment identity must have access to both the database pod and volume.
The volume is not automatically shared with all pod owners.

The first protected deployment replaces the known existing
`postgis/postgis:16-3.5` pod definition with the `postgres:16postgis3.5`
template and pgvector image. It deletes
only the pod, retains the same volume and PGDATA, recreates the pod
with that volume attached, and waits for SQL readiness before Hasura starts.
If a previous stop request left the legacy pod stopped without lifecycle start
metadata, the migration path does not require that old timestamp; it verifies
the replacement image and SQL readiness instead.
Unknown database images, volume layouts, subpaths, or PGDATA values still stop
the deployment, and ordinary `--recreate` remains refused for an existing
PostgreSQL pod. Authentication/server errors are not treated as missing pods
or volumes.

When deploying PostgreSQL, the script waits for the volume to become available
and for SQL to succeed before deploying the next service. Selectors are ordered
by dependency even when supplied as `--pods graphql,postgres`. Persistent
storage readiness waits allow up to ten minutes for Tapis lifecycle updates;
restarts require a confirmed change in container start time. `--restart-pods`
limits restarts without changing the update set; `--no-start` cannot be
combined with either restart option. Persistent
storage survives pod restarts; it does not replace database backups. Never
delete the volume as part of image rollback.

## Empty-database recovery

First inventory all databases and user schemas, preserve protected logical
backups and pod configuration, and pause dependent services. If data exists,
restore it into the persistent database before resuming; attaching a fresh
volume does not copy the old container filesystem.

For an empty database, stop PostgreSQL, attach the volume and set PGDATA as
above, and use the PostGIS image. Preserve the current credentials, network
configuration, and other pod settings. Start PostgreSQL and verify SQL readiness,
`SHOW data_directory`, the actual filesystem mount, and an enabled PostGIS
extension in the database used by Hasura. Do not run two database instances
against the same data directory.

Start Hasura after PostgreSQL is ready. Inside the Hasura pod:

```bash
cd /hasura
export HASURA_GRAPHQL_ENDPOINT=http://localhost:8080
hasura migrate apply --skip-update-check
hasura seeds apply --skip-update-check  # fresh database only; inspect before retrying
hasura metadata apply --skip-update-check
hasura migrate status --skip-update-check
hasura metadata inconsistency list --skip-update-check
```

Use the existing pod's admin-secret environment variable. Stop on any failed
command. Seeds provide reference data; migrations and metadata do not restore
historical model records or runs. Do not load demo fixtures as a substitute for
a missing backup.

Before resuming services, verify the UI's anonymous model-catalog query succeeds
and metadata is consistent. Perform a controlled PostgreSQL restart, restart
Hasura if needed, and compare the database system identifier, migration records,
schema, and reference-data counts before and after. Retain the volume and
backups if recovery fails.
