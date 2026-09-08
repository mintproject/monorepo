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

## Caveats

- Production deployment is out of scope.
- PostgreSQL schema initialization/Hasura migrations are not automated by `register_mint_stack.py` yet.
- The Ensemble Manager image entrypoint materializes `ENSEMBLE_MANAGER_CONFIG_JSON` into a runtime config file and sets `ENSEMBLE_MANAGER_CONFIG_FILE` before starting the app.
- Authenticated Hasura writes need either `MINTDEV_HASURA_JWT_SECRET` or `MINTDEV_HASURA_AUTH_HOOK`; without one, the stack may boot but write paths that forward user JWTs can fail.
- Tapis Pod template details for Redis/PostgreSQL should be validated during the first dev deployment.
