# MINT Dev Tapis Pods Deployment

This runbook covers the MINT-only dev stack deployed to Tapis Pods from this repository.

## Stack

| Service | Pod ID | URL |
|---|---|---|
| PostgreSQL | `mintdevpostgres` | internal/pod template |
| Redis | `mintdevredis` | internal/pod template |
| Hasura GraphQL | `mintdevgraphql` | `https://mintdevgraphql.pods.portals.tapis.io` |
| Model Catalog API | `mintdevapi` | `https://mintdevapi.pods.portals.tapis.io` |
| Ensemble Manager | `mintdevensemble` | `https://mintdevensemble.pods.portals.tapis.io` |
| SVO Adapter | `mintdevsvo` | `https://mintdevsvo.pods.portals.tapis.io` |
| React UI | `mintdevui` | `https://mintdevui.pods.portals.tapis.io` |

## Images

The build workflow publishes one shared stack tag across all custom images:

```text
ghcr.io/mintproject/graphql-engine:develop
ghcr.io/mintproject/postgres-pgvector:develop
ghcr.io/mintproject/model-catalog-api:develop
ghcr.io/mintproject/ensemble-manager:develop
ghcr.io/mintproject/svo-adapter:develop
ghcr.io/mintproject/ui:develop
```

The `develop` branch also publishes a moving `:develop` tag for each image. The
automatic and manually dispatched dev deployments use that tag. Use a separate
workflow change before attempting an immutable rollback.

## GitHub Actions

- `MINT Dev Images` builds the six custom images on `develop`, PRs, and manual dispatch.
- `Deploy MINT Dev Pods` runs after a successful `MINT Dev Images` run on `develop`, plus manual dispatch.
- PRs build images with `push: false` and never deploy.

The automated deploy first updates and restarts the PostgreSQL and Hasura pods
with the `develop` images, then looks up and restarts these existing application
pods: `mintdevapi`, `mintdevui`, `mintdevensemble`, and `mintdevsvo`. A missing
or incomplete pod lookup stops the workflow before that pod action is requested.

After each restart, the script waits for `AVAILABLE` and a new container start
time. `AVAILABLE` confirms the Tapis lifecycle state; it is not a substitute
for an application-level health check. Transient transport errors during
these bounded reads are retried; authentication and other HTTP errors fail
immediately.

The deploy job uses the `Tapis Dev Deploy` GitHub Environment.

After pod registration, the deploy job waits for Hasura, then runs the
migration and metadata CLI from the resolved GraphQL image tag. It finishes
with a bounded schema smoke test for the ETL process and problem statement
event relationships. This step uses the protected
`HASURA_GRAPHQL_ADMIN_SECRET` and does not apply seeds.

## Required environment secrets

Configure these in the `Tapis Dev Deploy` environment:

```text
TAPIS_USERNAME or TAPIS_ID
TAPIS_PASSWORD
MINTDEV_POSTGRES_PASSWORD
HASURA_GRAPHQL_ADMIN_SECRET
```

## Local restart

From `monorepo/`, with Tapis credentials in the environment:

```bash
python deploy/tapis/register_mint_stack.py \
  --restart-existing-pods api,ui,ensemble,svo
```

This mode only restarts existing pods and refuses to create or update them.

## Manual restart

Use GitHub Actions → `Deploy MINT Dev Pods` → `workflow_dispatch`. It performs
the same four-pod restart and has no image, pod-selection, or registration
inputs.

## Caveats

- Production deployment is out of scope.
- PostgreSQL schema initialization and Hasura metadata synchronization are
  automated by the `Deploy MINT Dev Pods` workflow after pod registration.
  `register_mint_stack.py` remains responsible only for Tapis pod and volume
  lifecycle.
- The Ensemble Manager image entrypoint materializes `ENSEMBLE_MANAGER_CONFIG_JSON` into a runtime config file and sets `ENSEMBLE_MANAGER_CONFIG_FILE` before starting the app.
- Authenticated Hasura writes need either `MINTDEV_HASURA_JWT_SECRET` or `MINTDEV_HASURA_AUTH_HOOK`; without one, the stack may boot but write paths that forward user JWTs can fail.
- Tapis Pod template details for Redis/PostgreSQL should be validated during the first dev deployment.

## Persistent PostgreSQL storage

The registration script uses the published PostgreSQL 16/PostGIS image with
pgvector, `ghcr.io/mintproject/postgres-pgvector:develop`, and the dedicated
Tapis volume `mintdevpostgresdata`. The volume mounts at `/var/lib/postgresql/data`;
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
`postgis/postgis:16-3.5` pod definition with the pgvector image. It deletes
only the pod, retains the same volume and PGDATA, recreates the pod
with that volume attached, and waits for SQL readiness before Hasura starts.
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
