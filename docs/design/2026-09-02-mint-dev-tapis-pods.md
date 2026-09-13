# MINT Dev Tapis Pods Deployment

**Status:** Implemented

## Objective

Deploy the MINT stack from this monorepo to a dev-only Tapis Pods stack using GitHub Actions, moving `develop` image tags for automatic updates, and immutable SHA tags for rollback.

## User need

MINT developers need an always-on dev stack that updates automatically from `develop` without touching production.

## Current code/system summary

MINT currently contains five custom deployable service images: `graphql_engine`, `model-catalog-api`, `mint-ensemble-manager`, `svo-adapter-service`, and the React UI in `ui-react`. The dev image workflow publishes all five with moving `develop` tags. The restart workflow only touches the existing API, UI, Ensemble, and SVO application pods; PostgreSQL, Redis, and GraphQL are outside its scope.

## Proposed design

Add a MINT dev image workflow and a restart-only Tapis Pods workflow. The custom images are published under `ghcr.io/mintproject/` as `graphql-engine`, `model-catalog-api`, `ensemble-manager`, `svo-adapter`, and `ui`, including moving `develop` tags. The restart workflow looks up and restarts only `mintdevapi`, `mintdevui`, `mintdevensemble`, and `mintdevsvo`.

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

`develop` push → build five MINT images → publish `develop` tags → restart workflow runs `register_mint_stack.py --restart-existing-pods api,ui,ensemble,svo` → Tapis looks up those four existing pods → requests restarts → verifies availability and a new container start time.

## Risks and tradeoffs

- Tapis database and Redis template behavior must be verified during first live dev deploy.
- The Hasura schema/migrations are not automated in this first pass.
- Authenticated Hasura writes require either `MINTDEV_HASURA_JWT_SECRET` or `MINTDEV_HASURA_AUTH_HOOK`; otherwise dev read paths may work while write paths fail.
- Dev deploys are automatic from `develop`, so bad merges can break the dev stack; rollback is manual workflow dispatch with a previous `sha-*` tag.
- Pod environment variables may expose secrets to pod owners; only dev secrets are in scope.
- A missing pod or failed lifecycle update fails the restart workflow rather than creating or mutating an unexpected resource.
- The moving `develop` tag simplifies rollout but does not provide immutable rollback; immutable SHA tags remain available from the image workflow for deliberate operator use.

## Alternatives considered

- Kubernetes/Helm was rejected because the requested target is Tapis Pods.
- Production deployment was deferred.
- A single combined image was rejected because services should scale and roll independently.

## Test plan

- Compile `deploy/tapis/register_mint_stack.py` with `python -m py_compile`.
- Unit-test restart-only lookup, refusal to create missing pods, restart completion, and protected-service rejection.
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
- Use the moving `develop` tag for automatic image updates. Look up and restart only `mintdevapi`, `mintdevui`, `mintdevensemble`, and `mintdevsvo`; never create, update, or delete pods in that workflow.

## User feedback / decisions

The user approved Tapis Pods, MINT-only scope, `ghcr.io/mintproject/...`, no history-preservation requirement, auto-run deploys, and dev-first rollout, then requested implementation.

The original dev CI/CD scaffolding is implemented. This revision adds a
restart-only workflow, bounded restart completion checks, and refusal to create
or mutate missing pod definitions. No live Tapis deployment was run locally.
The live rollout uses the existing Tapis pod definitions and restarts only the
four application pods.
