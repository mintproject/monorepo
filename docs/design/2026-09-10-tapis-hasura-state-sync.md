# Tapis Hasura State Synchronization

Status: Implemented

## Objective

Make every MINT Tapis dev deployment apply the Hasura migrations and metadata shipped in the deployed GraphQL image, so a persistent PostgreSQL volume cannot leave the UI and GraphQL schema out of sync.

## User need

**Primary user:** MINT dev-stack maintainer.

**Job-to-be-done:** Deploy a new MINT dev image and have its database schema and Hasura metadata become usable automatically.

**Current pain:** Tapis pod updates restart Hasura but do not run the migrations or metadata application that local Compose runs through `hasura-init`. Persistent PostgreSQL therefore retains an older schema, producing errors such as missing `modelcatalog_etl_process` and `problem_statement.events` fields.

**Definition of success:** A successful Tapis dev deployment reports migration and metadata synchronization success, and the deployed GraphQL endpoint accepts queries for both affected fields.

## Current code/system summary

`graphql_engine/Dockerfile` builds from Hasura and installs the Hasura CLI, then copies the migration and metadata project into `/hasura`. The local `compose.yaml` runs a one-shot `hasura-init` container, but `deploy-mint-dev-pods.yml` only registers/updates/restarts Tapis pods. The Tapis GraphQL pod has the migration client and project files but no separate initialization pod or exec phase.

## Proposed design

Add a post-registration step to `Deploy MINT Dev Pods` that:

1. Waits for `https://mintdevgraphql.pods.portals.tapis.io/healthz`.
2. Runs the GraphQL image selected by the deployment as a short-lived migration client.
3. Executes `hasura migrate status`, `hasura migrate apply`, `hasura metadata apply`, and `hasura metadata reload` against the public Tapis GraphQL endpoint using the admin secret.
4. Verifies the deployed GraphQL schema by querying `modelcatalog_etl_process` and `problem_statement.events`.

The step will use the image's `/hasura` contents, so migrations and metadata are guaranteed to come from the same immutable image tag as the running GraphQL service. It will not run seeds, alter PostgreSQL pod storage, or perform application-level data writes.

## Files likely affected

- `.github/workflows/deploy-mint-dev-pods.yml` — add the post-deploy synchronization and schema verification.
- `docs/deploy/mint-dev-pods.md` — document the automated synchronization and failure recovery.

## API/schema changes

No application API or database schema files change. The workflow begins applying existing versioned migrations and metadata to the persistent Tapis database.

## Data flow

GitHub Actions selects immutable image tag → Tapis updates/starts `mintdevgraphql` → workflow waits for health → same image runs Hasura CLI against the Tapis GraphQL endpoint → migrations and metadata are applied → schema smoke query validates the deployed endpoint.

## Risks and tradeoffs

- Migration application is a database mutation, but it is the intended versioned migration path and is idempotent for already-applied migrations.
- The workflow depends on the public Tapis pod URL being reachable from GitHub-hosted runners.
- A migration or metadata failure will fail the deployment workflow after pod updates, making the failure visible rather than presenting a partially synchronized stack as healthy.
- The workflow needs permission to pull the selected GHCR image if the package is not anonymously readable.

## Alternatives considered

- A long-running Hasura entrypoint wrapper could start Hasura and apply state during container startup, but it couples server availability to migration orchestration and makes process/error handling harder.
- A separate Tapis init pod would model local Compose more closely, but it adds another managed pod and lifecycle to the dev stack.
- Manual operator execution is insufficient because future persistent-volume deployments would regress.

## Test plan

- Validate the workflow YAML syntax and inspect the generated diff.
- Run the existing Tapis deployment-script unit tests.
- Run a dry-run deployment to ensure no pod specification or secret behavior regresses.
- The live schema smoke query will execute only during an explicitly run deployment workflow.

## Documentation plan

Update the Tapis deployment runbook to state that migration and metadata synchronization is automatic and to identify the workflow step as the recovery path for an existing stale database.

## Rollout/rollback plan

Roll out through the existing `Deploy MINT Dev Pods` workflow. The step applies only forward migrations shipped in the selected image. To roll back application images, dispatch the workflow with a prior immutable tag; database migrations are not automatically downgraded.

## Open questions

None for the requested fix. A future production deployment path should adopt the same explicit migration gate if it does not already have one.

## Decisions

- Use the deployed GraphQL image as the migration client so the migration files and running service share one resolved tag.
- Automatic develop deployments resolve the GraphQL image as the `develop` tag, per user requirement; manual dispatch retains an explicit tag input.
- Run synchronization from GitHub Actions because Tapis provides no interactive pod-exec phase in this deployment workflow.
- Keep seed application out of the automated path because seeds are intentionally non-idempotent and the Tapis database is persistent.

## User feedback / decisions

- User clarified that the deployment is entirely managed by Tapis Pods, GitHub workflows, and container images; there is no practical interactive Tapis exec operation. The design was adjusted to use a GitHub Actions post-deploy step.

Implementation deviation: the workflow runs the CLI in short-lived Docker
containers from GitHub Actions rather than creating a separate Tapis init pod.
This preserves the existing Tapis pod inventory while still using the resolved
GraphQL image tag as the migration client.
