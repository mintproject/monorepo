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
  workflow on `develop`, plus manual dispatch. It updates/restarts changed
  services and restarts dependent services when a schema or database change
  requires it.
- PRs build images with `push: false` and never deploy.

Changes only to `.github/**` or `deploy/**` produce a no-op manifest;
use manual dispatch when a deployment-code change needs to be applied to the
running stack.

The manifest uses conservative dependency expansion: PostgreSQL source changes
explicitly select PostgreSQL and restart Hasura, the catalog API, Ensemble
Manager, SVO Adapter, and semantic search; GraphQL migrations restart Hasura
and semantic search; root build/dependency files and unknown paths select the
full application stack but deliberately exclude PostgreSQL. CI/deployment
plumbing changes are intentionally no-op. A dependency-only restart never
changes that service's image.

The automated deploy validates that the manifest's source SHA matches the
completed image workflow before making any Tapis request. A missing, malformed,
or mismatched manifest fails closed. A no-op manifest skips deployment.

For an existing pod, an image deployment updates the image/runtime definition
and restarts the pod without resubmitting its `networking` block. This preserves
the live Tapis CORS, auth, and proxy settings. Newly-created GraphQL pods
submit only the HTTP route and do not submit Tapis CORS settings; Hasura's
application-level CORS environment setting remains unchanged. The UI auth
allowlist is the explicit exception: its dedicated sync step intentionally
updates the UI networking definition.

PostgreSQL image changes use the protected volume-preserving replacement path;
the pod is replaced only with `--migrate-postgres-image`, and the existing
`mintdevpostgresdata` volume is retained. All other image mismatches may use
the stateless recreation fallback.

After each restart, the script waits for `AVAILABLE` and a new container start
time. `AVAILABLE` confirms the Tapis lifecycle state; it is not a substitute
for an application-level health check. Transient transport errors during
these bounded reads are retried; authentication and other HTTP errors fail
immediately.

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

For schema changes, the deploy job runs the migration CLI, applies metadata,
reloads metadata, and performs a read-only schema smoke test using the resolved
GraphQL image tag. The smoke test covers the ETL process and problem statement
event relationships. This step uses the protected
`HASURA_GRAPHQL_ADMIN_SECRET` and does not apply seeds.

## Required environment secrets

Configure these in the `Tapis Dev Deploy` environment:

```text
TAPIS_USERNAME or TAPIS_ID
TAPIS_PASSWORD
MINTDEV_POSTGRES_PASSWORD
HASURA_GRAPHQL_ADMIN_SECRET
MINTDEV_HASURA_AUTH_HOOK or MINTDEV_HASURA_JWT_SECRET
```

## Local restart

From `monorepo/`, with Tapis credentials in the environment:

```bash
python deploy/tapis/register_mint_stack.py \
  --restart-existing-pods api,ui,ensemble,svo
```

This mode only restarts existing pods and refuses to create or update them.

## Manual restart

Use GitHub Actions → `Deploy MINT Dev Pods` → `workflow_dispatch` to perform a
full application deployment from the selected ref using the moving `:develop`
image tags. This does not update, restart, or recreate PostgreSQL. PostgreSQL
is touched only when its image/context is explicitly selected for a protected
volume-preserving migration.

## Caveats

- Production deployment is out of scope.
- PostgreSQL schema initialization and Hasura metadata synchronization are
  automated by the `Deploy MINT Dev Pods` workflow after pod registration.
  `register_mint_stack.py` remains responsible only for Tapis pod and volume
  lifecycle.
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
