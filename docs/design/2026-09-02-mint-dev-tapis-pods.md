# MINT Dev Tapis Pods Deployment

**Status:** Implemented

## Objective

Deploy the MINT stack from this monorepo to a dev-only Tapis Pods stack using GitHub Actions and shared immutable image tags.

## User need

MINT developers need an always-on dev stack that updates automatically from `develop` without touching production.

## Current code/system summary

MINT currently contains five custom deployable service images: `graphql_engine`, `model-catalog-api`, `mint-ensemble-manager`, `svo-adapter-service`, and the React UI in `ui-react`. The dev deployment publishes the React UI as `ghcr.io/mintproject/ui:<tag>` and the SVO adapter as `ghcr.io/mintproject/svo-adapter:<tag>`. PostgreSQL and Redis are runtime dependencies. Existing service workflows already publish GHCR images and the Helm chart documents the service environment patterns.

## Proposed design

Add a MINT dev image workflow, a Tapis Pods deploy workflow, and a `tapipy` registration script. The custom images are published under `ghcr.io/mintproject/` as `graphql-engine`, `model-catalog-api`, `ensemble-manager`, `svo-adapter`, and `ui`, then tagged as `sha-<short-sha>`. The dev pod IDs are `mintdevpostgres`, `mintdevredis`, `mintdevgraphql`, `mintdevapi`, `mintdevensemble`, `mintdevsvo`, and `mintdevui`.

## Files likely affected

- `.github/workflows/build-mint-dev-images.yml`
- `.github/workflows/deploy-mint-dev-pods.yml`
- `deploy/tapis/register_mint_stack.py`
- `docs/deploy/mint-dev-pods.md`
- `mint-ensemble-manager/Dockerfile`
- `mint-ensemble-manager/docker/entrypoint.sh`
- `svo-adapter-service/Dockerfile`
- `svo-adapter-service/.dockerignore`

## API/schema changes

No public API or database schema changes are introduced. Tapis Pods specs are created/updated through the Tapis Pods API.

## Data flow

`develop` push → build five MINT images → tag all as `sha-<short-sha>` → deploy workflow runs `register_mint_stack.py` → Tapis creates/updates dev pods → UI/API/GraphQL/Ensemble/SVO Adapter are available at `mintdev*` pod URLs.

## Risks and tradeoffs

- Tapis database and Redis template behavior must be verified during first live dev deploy.
- The Hasura schema/migrations are not automated in this first pass.
- Authenticated Hasura writes require either `MINTDEV_HASURA_JWT_SECRET` or `MINTDEV_HASURA_AUTH_HOOK`; otherwise dev read paths may work while write paths fail.
- Dev deploys are automatic from `develop`, so bad merges can break the dev stack; rollback is manual workflow dispatch with a previous `sha-*` tag.
- Pod environment variables may expose secrets to pod owners; only dev secrets are in scope.

## Alternatives considered

- Kubernetes/Helm was rejected because the requested target is Tapis Pods.
- Production deployment was deferred.
- A single combined image was rejected because services should scale and roll independently.

## Test plan

- Compile `deploy/tapis/register_mint_stack.py` with `python -m py_compile`.
- Run `register_mint_stack.py --dry-run` and verify redacted pod specs.
- Parse GitHub Actions workflow YAML.
- First live validation should be a dev workflow run only; no local live Tapis writes.

## Documentation plan

Add `docs/deploy/mint-dev-pods.md` with workflow behavior, secrets, URLs, dry-run, and rollback.

## Rollout/rollback plan

Roll out by merging to `develop` and allowing the dev deployment workflow to run. Roll back by manually dispatching `Deploy MINT Dev Pods` with the last known-good `sha-*` tag.

## Open questions

- Exact Tapis Redis connection URL/TLS requirements.
- Whether Hasura migrations should be automated in a later workflow.
- Final resource limits after observing dev pod behavior.

## Decisions

- Use Tapis Pods.
- MINT only for phase 1.
- Use `ghcr.io/mintproject/...`, with the React UI image named `ui` for the dev stack.
- Include the SVO Adapter as `ghcr.io/mintproject/svo-adapter:<tag>` and pod `mintdevsvo`.
- Use dev pod IDs prefixed with `mintdev`.
- Auto-deploy dev from `develop`; production is out of scope.
- Add an Ensemble Manager entrypoint to materialize `ENSEMBLE_MANAGER_CONFIG_JSON` as a runtime config file.

## User feedback / decisions

The user approved Tapis Pods, MINT-only scope, `ghcr.io/mintproject/...`, no history-preservation requirement, auto-run deploys, and dev-first rollout, then requested implementation.

Implementation completed for dev CI/CD scaffolding, dry-run pod registration, and docs. No live Tapis deployment was run locally.
