# Repair MODFLOW output positions for Tapis submission

Status: Implemented

## Objective

Make the canonical MODFLOW-2000 configuration submit a Tapis model job successfully by repairing missing output positions in the persistent Model Catalog data.

## User need

The UI accepts the run request and Ensemble Manager creates a workflow parent, but model submission stops before a Tapis job is created with `Output file missing position`. The affected catalog output specifications exist with `position = NULL` in the live MINT develop database.

## Current code/system summary

The Ensemble Manager's Tapis execution path converts each model input and output into component metadata. `ExecutionCreation._getModelIODetails` rejects an I/O record without a position. Migration `1771300000009_normalize_modflow_input_contracts` contains the intended positions 2, 4, and 3, but the live persistent catalog still has null positions—consistent with an environment that never received that backfill or was initialized from older data. The live configuration `MODFLOW-2000 default configuration` references those existing rows.

## Proposed design

Add a new idempotent Hasura/PostgreSQL migration that updates the three canonical MODFLOW-2000 output specifications by ID, setting their expected positions while preserving labels, formats, presentations, and configuration links. The repair is data-only; no UI, Ensemble Manager, SVO, or API behavior changes are required.

The migration will use explicit `UPDATE` statements guarded by the known IDs and null-position predicates, and will include a down migration restoring the prior null positions for rollback consistency.

## Files likely affected

- `graphql_engine/migrations/<new>_repair_modflow2000_output_positions/up.sql`
- `graphql_engine/migrations/<new>_repair_modflow2000_output_positions/down.sql`
- `graphql_engine/tests/test_modflow2000_output_position_migration.py`
- This design record

## API/schema changes

None. The existing `position` column is populated with the metadata already required by the Tapis execution path.

## Data flow

1. The UI submits a unified plan and deferred SVO adapter plan.
2. Ensemble Manager loads the thread's model configuration from Hasura.
3. Tapis execution metadata is built from model I/O positions.
4. The repaired catalog positions allow the model task to be constructed.
5. Ensemble Manager submits the Tapis model job and continues the workflow.

## Risks and tradeoffs

- The positions are execution metadata and must match the MODFLOW-2000 component's expected `-o` argument slots.
- The migration targets stable canonical IDs; it does not change arbitrary user-created configurations.
- A stale or incomplete deployment that skips migrations would leave the issue unresolved, so deployment verification must confirm the live positions and a fresh submission path.

## Alternatives considered

- Add a runtime fallback position in Ensemble Manager: rejected because it would hide catalog corruption and could assign incorrect slots to arbitrary models.
- Mutate the live database manually: rejected because the repair must be reproducible through the repository's migration and deployment workflow.
- Re-run the original migration: insufficient because its conflict behavior intentionally skips existing rows.

## Test plan

- Add a migration regression test asserting the repair migration updates all three canonical output IDs and includes a rollback.
- Run the GraphQL migration-focused test suite and relevant Ensemble Manager tests.
- After deployment, query the live catalog read-only to verify positions 2, 4, and 3.
- Verify a new UI submission creates a model job rather than ending in `MODEL_SUBMISSION_UNKNOWN`.

## Documentation plan

No user-facing documentation change is required. Keep this design record as the operational explanation of the data repair.

## Rollout/rollback plan

Merge through the normal develop PR workflow. The deploy workflow applies Hasura migrations before restarting affected services. Verify the live catalog after deployment. If the repair causes an unexpected catalog regression, apply the down migration through the approved migration workflow and investigate before retrying runs.

## Open questions

- Should the same repair be extended to other legacy MODFLOW output specifications that may have null positions? The current incident only identifies the three outputs used by the affected configuration; a read-only catalog audit should be run before broadening scope.

## Decisions

### 2026-10-02 — Prefer idempotent data repair over runtime fallback

The live data confirms the repository's intended positions were not present in the persistent catalog, even though the original normalization migration contains the intended backfill. Repairing the rows explicitly keeps execution behavior strict and makes the catalog state reproducible.

### 2026-10-02 — Implementation complete

Added migration `1771300000033_repair_modflow2000_output_positions` with guarded up/down updates for the three canonical MODFLOW-2000 outputs and a static regression test covering the exact mapping. Focused migration tests pass. The full GraphQL test suite retains one unrelated pre-existing metadata assertion failure.

## User feedback / decisions

The user reported that the deployed UI still did not run a job. Live run records and the pasted browser log identify the missing output position as the immediate blocker.
