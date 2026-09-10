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
ghcr.io/mintproject/graphql-engine:sha-<short-sha>
ghcr.io/mintproject/model-catalog-api:sha-<short-sha>
ghcr.io/mintproject/ensemble-manager:sha-<short-sha>
ghcr.io/mintproject/svo-adapter:sha-<short-sha>
ghcr.io/mintproject/ui:sha-<short-sha>
```

Deploy by immutable `sha-*` tags. Do not use `latest` for rollback-sensitive deploys.

## GitHub Actions

- `MINT Dev Images` builds the five custom images on `develop`, PRs, and manual dispatch.
- `Deploy MINT Dev Pods` runs after a successful `MINT Dev Images` run on `develop`, plus manual dispatch for rollback/redeploy.
- PRs build images with `push: false` and never deploy.

The automated deploy updates the selected pod specs but restarts only Redis and
the application pods. It intentionally excludes PostgreSQL from the restart
allow-list so a routine image deployment cannot bounce the database. A
deliberate PostgreSQL restart remains available to an operator using the
registration script directly.

Tapis applies pod updates asynchronously. The registration script now reads
each pod back and requires the exact requested image before requesting a
restart. For restarted application pods it also waits for `AVAILABLE` and a
new container start time. `AVAILABLE` confirms the Tapis lifecycle state; it is
not a substitute for an application-level health check.

Automated deployments fail if an image does not converge. A manual workflow
dispatch may opt into the last-resort UI-only fallback with
`recreate_ui_on_image_mismatch: true`; the script confirms deletion before
creating the replacement pod and verifies its image afterward. The fallback is
disabled by default and cannot recreate Redis, GraphQL, API, Ensemble, SVO, or
PostgreSQL. PostgreSQL is never automatically deleted or recreated.

The deploy job uses the `Tapis Dev Deploy` GitHub Environment.

## Required environment secrets

Configure these in the `Tapis Dev Deploy` environment:

```text
TAPIS_USERNAME or TAPIS_ID
TAPIS_PASSWORD
HASURA_GRAPHQL_ADMIN_SECRET
MINTDEV_POSTGRES_PASSWORD
```

Optional:

```text
MINTDEV_AUTH_CLIENT_ID
MINTDEV_HASURA_JWT_SECRET or MINTDEV_HASURA_AUTH_HOOK
SVO_ADAPTER_GEO_ACTOR_ID
```

## Local dry run

From `monorepo/`:

```bash
python deploy/tapis/register_mint_stack.py --image-tag sha-abc1234 --dry-run
python deploy/tapis/register_mint_stack.py --image-tag sha-abc1234 --pods api,svo,ui --dry-run
```

Dry-run output redacts secret-like environment variables and does not call Tapis.

## Manual deploy / rollback

Use GitHub Actions → `Deploy MINT Dev Pods` → `workflow_dispatch` with a known-good tag:

```text
image_tag: sha-abc1234
pods: all
```

To restart only one or two pods, set `pods` to a comma-separated subset, for example:

```text
pods: api,ui
```

If a manual deployment reports that the UI image did not converge, rerun it
with the same immutable `sha-*` tag and set
`recreate_ui_on_image_mismatch` to `true`. Inspect the Tapis pod action and
status history if the replacement does not become available; do not switch to
a moving `dev` or `latest` tag to work around a lifecycle failure.

## Caveats

- Production deployment is out of scope.
- PostgreSQL schema initialization/Hasura migrations are not automated by `register_mint_stack.py` yet.
- The Ensemble Manager image entrypoint materializes `ENSEMBLE_MANAGER_CONFIG_JSON` into a runtime config file and sets `ENSEMBLE_MANAGER_CONFIG_FILE` before starting the app.
- Authenticated Hasura writes need either `MINTDEV_HASURA_JWT_SECRET` or `MINTDEV_HASURA_AUTH_HOOK`; without one, the stack may boot but write paths that forward user JWTs can fail.
- Tapis Pod template details for Redis/PostgreSQL should be validated during the first dev deployment.

## Persistent PostgreSQL storage

The registration script uses `postgis/postgis:16-3.5` and the dedicated Tapis
volume `mintdevpostgresdata`. The volume mounts at `/var/lib/postgresql/data`;
`PGDATA` is `/var/lib/postgresql/data/pgdata`. PostGIS is required by the first
MINT migration (`public.geometry`). For a new database pod, the volume is created
if absent, with a 10,240 MB size warning threshold, and reused on subsequent
deployments. If an existing pod's volume is missing, deployment stops instead
of silently creating empty replacement storage.

Volume mounts use the current Tapis format: the container mount path is the
dictionary key, with `type: tapisvolume` and `source_id: mintdevpostgresdata`.
The deployment identity must have access to both the database pod and volume.
The volume is not automatically shared with all pod owners.

The script refuses to change an existing database's image, volume, subpath, or
PGDATA implicitly. It also refuses `--recreate` for an existing PostgreSQL pod.
An older ephemeral deployment requires a deliberate preservation/recovery
operation before routine deployment can resume. Authentication/server errors
are not treated as missing pods or volumes.

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
