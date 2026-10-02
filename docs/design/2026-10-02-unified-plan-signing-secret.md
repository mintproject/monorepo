# Durable unified-plan signing configuration

Status: Implemented

## Objective

Configure a stable signing secret for the MINT development Ensemble Manager and
make the deployment workflow preserve and apply that configuration on future
deployments.

## User need

MINT development pods currently return `503 unified plan signing is not
configured` when the UI discovers an ordinary SVO adapter plan. The live pod
must accept plan discovery, and subsequent image/configuration deployments must
not silently remove the signing configuration.

## Current code/system summary

- `mint-ensemble-manager` reads `UNIFIED_PLAN_SECRET` first and then
  `unified_plan_secret` from its JSON configuration. It returns a 503 when
  both are empty.
- `deploy/tapis/register_mint_stack.py` already has a
  `unified_plan_secret` configuration field, but defaults it to an empty value.
- The GitHub MINT development deployment does not pass a signing secret and its
  selective image-only path does not reapply Ensemble configuration.
- The live `mintdevensemble` pod has the public SVO route configured but no
  signing secret.

## Proposed design

1. Add an explicit `--sync-ensemble-config` deployment mode, with a deferred
   restart option matching the existing SVO runtime sync pattern.
2. Have the sync mode preserve the current Ensemble image and all existing
   environment variables, replacing only `ENSEMBLE_MANAGER_CONFIG_JSON` with
   the generated configuration. Require a non-empty signing secret and verify
   the returned configuration converges without logging the secret.
3. Add a workflow step that runs this sync for Ensemble deployments and passes
   `UNIFIED_PLAN_SECRET` from the `Tapis Dev Deploy` environment secret.
4. Classify `register_mint_stack.py` changes as Ensemble deployment changes so
   selective deploys restart and resynchronize the affected service.
5. Generate one random secret, store it as the GitHub environment secret, and
   use the same value for the immediate live pod repair. Do not reuse the
   Hasura admin secret.

## Files likely affected

- `deploy/tapis/register_mint_stack.py`
- `deploy/tapis/test_register_mint_stack.py`
- `deploy/mint_change_plan.py`
- `deploy/test_mint_change_plan.py`
- `.github/workflows/deploy-mint-dev-pods.yml`
- `docs/design/2026-10-02-unified-plan-signing-secret.md`

## API/schema changes

No application API or database schema changes. The deployment CLI gains
`--sync-ensemble-config` and `--defer-ensemble-restart` options.

## Data flow

GitHub environment secret `UNIFIED_PLAN_SECRET` → deploy job environment →
`build_specs()` → Ensemble Manager JSON configuration → Tapis Pod environment →
Ensemble Manager plan signing and verification.

The browser and UI continue to call Ensemble Manager's unified plan boundary;
the signing secret remains server-side and is never sent to the browser.

## Risks and tradeoffs

- Rotating the secret invalidates opaque plan IDs signed with the previous
  value. The rollout therefore creates one stable value and does not rotate it
  on each deployment.
- The GitHub environment secret is write-only through normal GitHub interfaces;
  the live repair and secret registration must use the same generated value in
  one controlled operation.
- A missing CI secret should fail the Ensemble configuration sync rather than
  overwrite a working live secret with an empty value.
- The change is limited to MINT development deployment configuration; it does
  not alter production or Hasura credentials.

## Alternatives considered

- Reuse `HASURA_GRAPHQL_ADMIN_SECRET`: rejected because the Ensemble signing
  key has a separate trust boundary and the service documentation explicitly
  forbids reuse.
- Set only `UNIFIED_PLAN_SECRET` on the live pod: rejected because future
  deployment updates would remain non-reproducible.
- Put the secret in committed configuration: rejected because it would expose
  a signing credential in source control.
- Rebuild the Ensemble image with a default secret: rejected because secrets
  belong in deployment configuration, not an image.

## Test plan

- Unit-test default config generation with and without the secret.
- Unit-test Ensemble config sync preserves unrelated environment values and
  the current image, verifies convergence, supports deferred restart, and
  refuses an empty secret.
- Test deployment change classification selects Ensemble for changes to the
  registration script.
- Run focused Python unittest suites and `git diff --check`.
- After rollout, verify pod status, secret presence without value disclosure,
  Ensemble public health/UI access, SVO health, and a plan-discovery request.

## Documentation plan

The existing Ensemble README already documents the required secret and the
prohibition on reusing the Hasura admin secret. Update deployment-facing
documentation only if the repository has a suitable CI secret inventory page;
otherwise keep the secret name and handling documented in the workflow and
design record without exposing its value.

## Rollout/rollback plan

1. Store the generated stable secret in the `Tapis Dev Deploy` GitHub
   environment.
2. Apply the same value to `mintdevensemble` and restart it.
3. Merge the code/workflow PR to `develop` and watch the image/deployment runs.
4. Verify the live configuration and plan-discovery behavior.
5. Roll back code by reverting the PR if needed. Keep the secret unchanged so
   existing signed plan IDs remain valid; restore the prior pod configuration
   only if the deployment behavior itself is faulty.

## Open questions

None for the development deployment. Production secret ownership and rollout
are out of scope.

## Decisions

### 2026-10-02 - Use a dedicated stable deployment secret

- **Decision:** Use a random `UNIFIED_PLAN_SECRET` stored in the GitHub
  `Tapis Dev Deploy` environment and applied to the live Ensemble pod.
- **Reason:** The service requires a non-empty signing key and must retain it
  across restarts and deployments without coupling it to Hasura credentials.
- **Alternatives rejected:** Reusing Hasura admin credentials, committing a
  secret, or applying a one-time live-only fix.
- **User feedback:** The user explicitly approved implementing the fix and
  proceeding through the PR/deployment flow.
- **Impact on implementation:** The deployment script and workflow gain a
  configuration-sync path plus focused tests.

## User feedback / decisions

- User approved the implementation and requested that it be carried through the
  PR, merge, and deployment verification workflow.
