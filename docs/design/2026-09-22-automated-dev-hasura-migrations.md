# Automate Hasura migrations for MINT dev deployments

Status: Implemented

## Objective

Ensure pending Hasura migrations are applied automatically to the MINT dev
database after the matching GraphQL image is available, with explicit status,
metadata, and smoke-test verification.

## User need

**Primary user:** MINT maintainers deploying the local and Tapis-hosted dev
environment.

**Secondary users:** Developers relying on the dev Problem Formulation UI and
operators diagnosing deployment drift.

**Job-to-be-done:** Deploy catalog changes once and have the dev database reach
the same migration state without a separate manual database procedure.

**Current pain:** The deployment workflow detects GraphQL migration changes and
restarts Hasura, but does not run `hasura migrate apply`. The application can
therefore run against an older persistent database, as happened with the
version-specific MODFLOW archive SVO migration.

**Definition of success:** A dev deployment with pending migrations runs the
migrations in order, applies/reloads Hasura metadata, verifies migration
status and a GraphQL smoke query, and fails the deployment stage if any check
fails. A deployment with no pending migrations remains idempotent.

## Current code/system summary

- `graphql_engine/Dockerfile` copies the Hasura migrations and CLI into the
  GraphQL image at `/hasura`.
- `compose.yaml` has a local one-shot `hasura-init` service that applies
  migrations and metadata.
- `.github/workflows/deploy-mint-dev-pods.yml` updates and restarts dev pods but
  explicitly leaves PostgreSQL and schema migration outside the deploy action.
- `deploy/mint_change_plan.py` marks GraphQL migration changes and selects the
  GraphQL/semantic-search services, but has no migration execution stage.
- Hasura records applied migration versions, so applying the complete migration
  directory is the existing idempotent mechanism.

## Proposed design

Add a separate, gated migration stage to the dev deployment workflow:

1. Deploy or restart the GraphQL pod with the exact image associated with the
   source commit.
2. Wait for Hasura to be reachable and healthy.
3. Execute `hasura migrate apply --skip-update-check` in the GraphQL pod using
   the migrations bundled in that exact image. The current Tapis Pods
   environment does not provide a separate migration Job, so this uses the
   existing fixed `mintdevgraphql` pod and a fixed command script; no pod,
   namespace, migration path, or SQL is accepted from workflow input.
4. Execute `hasura metadata apply --skip-update-check` and
   `hasura metadata reload --skip-update-check`.
5. Run `hasura migrate status --skip-update-check`, metadata inconsistency
   checks, and an authenticated GraphQL smoke query for the catalog fields
   required by the UI.
6. Fail the workflow if any command or verification fails and report the
   migration/status output in the GitHub Actions summary.

The stage runs for schema-changing deploys and may also be invoked by manual
full deploys. It does not run down migrations, reset PostgreSQL, apply seeds,
or mutate CKAN/MINT external catalogs.

## Files likely affected

- `.github/workflows/deploy-mint-dev-pods.yml` — migration stage and checks
- `deploy/tapis/register_mint_stack.py` — only if an existing safe pod-exec or
  command-dispatch helper is required
- `docs/deploy/mint-dev-pods.md` — automated rollout and failure behavior
- `docs/design/2026-09-22-automated-dev-hasura-migrations.md` — implementation
  decisions and final status
- Focused workflow/helper tests, if the existing deployment test structure
  supports them

## API/schema changes

No database schema or application API changes. The workflow gains an
operational migration stage and uses the existing Hasura CLI commands.

## Data flow

```text
source commit
  -> exact GraphQL image
  -> dev Hasura pod restart
  -> migration apply against persistent PostgreSQL
  -> metadata apply/reload
  -> status + GraphQL smoke checks
  -> deployment success or fail-closed result
```

## Risks and tradeoffs

- The migration stage mutates persistent dev database state, so it must use the
  same exact image/source as the application rollout and retain command output.
- Running migrations before the GraphQL image is updated could apply files that
  do not match the deployed application; ordering the stage after the image
  update avoids that mismatch.
- A failed migration can leave a database transaction or partial deployment in
  an operator-visible failed state; the workflow must stop and require
  investigation rather than automatically running a down migration.
- Dev credentials and pod-exec permissions must remain in GitHub Environment
  secrets; they must not be logged.

## Alternatives considered

- Keep migrations fully manual: rejected because the incident demonstrated that
  application rollout can silently leave the persistent database behind.
- Run migrations on every Hasura container startup: rejected because container
  restart behavior is not an explicit deployment boundary and can obscure
  failures or race with database readiness.
- Apply migrations from a separately built generic CLI image: rejected because
  the migration directory could drift from the exact GraphQL image being
  deployed.
- Automatically run seeds: rejected because seeds are not idempotent and are
  intended for fresh databases only.

## Test plan

- Validate the workflow syntax and change-plan behavior for migration and
  non-migration changes.
- Exercise the migration stage against local Compose with a pending migration,
  then rerun it to verify idempotency.
- Verify `hasura migrate status`, metadata consistency, and the catalog GraphQL
  smoke query after application.
- Verify a failed command stops the stage and does not restart dependent
  services as successful.
- Run focused repository tests, Python compilation, and `git diff --check`.

## Documentation plan

Update `docs/deploy/mint-dev-pods.md` to describe the automated migration
stage, required environment permissions, verification output, and the manual
recovery path when a migration fails.

## Rollout/rollback plan

Roll out first on the MINT dev environment. The migration ledger provides
forward idempotency; rollback is a code/image rollback plus an explicit review
of database state. Do not run down migrations automatically. If a migration
must be reversed, use its reviewed down migration manually with a database
backup and approval.

## Open questions

- What existing Tapis pod-exec mechanism should the workflow use for the dev
  Hasura pod: the current registration helper or a dedicated migration helper?
- Does the dev environment expose a stable Hasura admin secret and pod name to
  the GitHub Environment without adding new secret material?

## Decisions

### 2026-09-22 — Separate migration stage

- **Decision:** Automate migrations as a gated deployment stage rather than as
  an application startup side effect.
- **Reason:** The dev deployment already knows when schema files changed, while
  the persistent database requires an explicit, auditable mutation.
- **User approval:** The user responded “Ok, do it” after the recommendation to
  automate the migration stage.

## User feedback / decisions

- 2026-09-22: The user approved implementing automated dev migration handling.

## Implementation result

- Added `--migrate-hasura` to `deploy/tapis/register_mint_stack.py`.
- The command waits for the exact GraphQL image, applies migrations and
  metadata, checks status/inconsistencies, and verifies the four canonical
  MODFLOW archive labels through Hasura.
- The dev workflow now restarts GraphQL first for schema changes, runs the
  migration stage, and restarts dependent services only after verification.
- Focused deployment tests, workflow YAML parsing, Python compilation, and
  `git diff --check` passed.
- Deviation from the original design: Tapis Pods use fixed pod execution
  instead of a separate migration Job; the command uses the pod's existing
  admin-secret environment variable and does not log it.
- The first persistent-dev application exposed an older catalog snapshot that
  lacked the canonical MODFLOW 2000/96 configuration and output metadata. The
  0009 migration now restores those rows idempotently before applying the
  normalized input contracts. A one-time equivalent repair was applied to the
  existing dev database, and all migrations, metadata checks, and catalog
  smoke checks subsequently passed.
- The GraphQL smoke query's shell quoting was corrected after the first
  successful migration run; the deployment verifier now completes with exit
  code zero.
