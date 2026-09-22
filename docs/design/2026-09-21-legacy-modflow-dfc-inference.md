# Legacy MODFLOW DFC inference contracts

Status: Implemented

## Objective

Make the problem-formulation Models step discover every cataloged MODFLOW configuration that can reach the selected spring-flow outcome through the registered SVO adapter chain.

## User need

When a user selects `spring__volume_flow_rate`, the Models step should expose only the supported MODFLOW registrations and should infer drivers from the model/SVO adapter catalog rather than from a frontend allowlist.

## Current code/system summary

The UI filters model rows by direct output contracts and adapter reachability. The adapter registry already contains spring-flow drain extraction transforms for MODFLOW 6, MODFLOW-USG, MODFLOW-2000, and MODFLOW-96. The model catalog has usable output rows for the older configurations, but their format values are `NULL`; MODFLOW 2005 uses `cbb`, which does not match an existing version-specific CBC contract.

## Proposed design

1. Preserve the outcome-compatible filtering behavior.
2. Add a version-specific `cbc-mf2005` drain-to-spring transform to the existing adapter fixture.
3. Tag legacy model-catalog cell-budget output specifications with the exact format tokens consumed by the adapter planner:
   - MODFLOW 96: `cbc-mf96`
   - MODFLOW 2000: `cbc-mf2000`
   - MODFLOW 2005: `cbc-mf2005`
4. Keep the generic catalog label `cbb` only as display metadata; use `has_format` as the executable contract key.
5. Remove the unsupported Farm Process/Texture and MT3D software registrations
   from the model catalog, including their dependent configuration rows.
6. Keep model discovery data-driven: the UI does not hardcode a MODFLOW
   allowlist or filter by a software-label convention.
7. Retain one canonical configuration per supported MODFLOW family and remove
   duplicate configuration rows that are not referenced by executions or
   threads. The canonical rows are the component-backed MODFLOW 2005 setup,
   the first MF2000 runtime setup, the MF6 setup, and the first MF96 runtime
   setup.
8. Add offline planner coverage for all four legacy/versioned CBC paths.
9. Normalize the displayed family labels to `MODFLOW 2005`, `MODFLOW 2000`,
   `MODFLOW 6`, and the existing `MODFLOW-96` label.
10. Configure the MF6 runtime with the shared archive input plus its existing
    well and recharge inputs; remove the name-file-only input from that
    configuration.
11. Normalize the remaining canonical MODFLOW family input contracts. MF2000
    and MF96 use archive, WEL, and recharge inputs; MODFLOW 2005 retains its
    required package inputs, gains a simulation archive input, and maps WEL to
    `groundwater_well__volume_flow_rate`.
12. Normalize canonical MODFLOW input/output metadata. MODFLOW 2005 WEL/RCH
    rows receive explicit override labels, all native output files receive
    format metadata, and CBC/head/drawdown outputs receive standard-variable
    presentations where applicable.
13. Use the complete MODFLOW 2005 simulation archive as the package bundle for
    the canonical configuration. Its visible input contract is exactly
    archive, recharge, and well.

## Files likely affected

- `svo-adapter-service/examples/gma_dfc_transforms.json`
- `svo-adapter-service/tests/test_gma_dfc_plan.py`
- `svo-adapter-service/tests/test_dfc_targets.py`
- `svo-adapter-service/README.md`
- `graphql_engine/fixtures/modelcatalog.sql`
- `graphql_engine/metadata/tables.yaml`
- `ui-react/src/graphql/generated/modeling.ts`
- `ui-react/src/pages/modeling/thread/wizard/ModelsStep.tsx`
- `graphql_engine/migrations/1771300000002_legacy_modflow_dfc_output/`
- `graphql_engine/migrations/1771300000004_remove_unsupported_modflow_registrations/`
- `graphql_engine/migrations/1771300000005_remove_unused_modeling_enabled_flag/`
- `graphql_engine/migrations/1771300000006_remove_duplicate_modflow_configurations/`
- `graphql_engine/migrations/1771300000007_normalize_modflow_family_labels/`
- `graphql_engine/migrations/1771300000008_modflow6_archive_input/`
- `graphql_engine/migrations/1771300000009_normalize_modflow_input_contracts/`
- `graphql_engine/migrations/1771300000010_remove_modflow_2005_setup_registrations/`
- `graphql_engine/migrations/1771300000011_normalize_modflow_io_metadata/`
- `graphql_engine/migrations/1771300000012_modflow_2005_archive_input_contract/`
- `.wolf/buglog.json`

## API/schema changes

The model catalog migration removes the two unsupported MODFLOW-related
software registrations and their dependent configurations. No UI schema or
frontend allowlist is needed to represent this decision. A follow-up catalog
migration retains one canonical configuration for each supported MODFLOW
family and removes unreferenced duplicates.

## Data flow

For outcome inference, `modelcatalog_configuration_output` ->
`dataset_specification.has_format` -> UI model output contract -> adapter
transform input contract -> `spring__volume_flow_rate` output contract.

## Risks and tradeoffs

- The `cbc-mf2005` token is intentionally distinct from MODFLOW-USG and MODFLOW-2000 because CBC binary layouts are version-specific.
- The removal is intentionally catalog-specific: future software registrations
  remain discoverable through normal catalog queries and must be evaluated by
  their registered outputs and adapters.
- The transform assumes the MODFLOW 2005 CBC contains drain-package records representing spring discharge, matching the existing DFC demo convention.
- The unsupported registrations are deleted in the migration, after deleting
  the dependent MT3D child configuration. Restoring them requires reloading a
  fixture revision containing the original rows; the down migration does not
  duplicate their full metadata.
- Duplicate configuration deletion is guarded by execution/thread reference
  checks and is limited to the four known duplicate IDs.

## Alternatives considered

- Adding duplicate transforms for MODFLOW 6, USG, 2000, and 96: rejected because those registrations already exist.
- Aliasing MODFLOW 2005 `cbb` to `cbc-mf2000` or `cbc-mfusg`: rejected because it would route a binary file through the wrong parser contract.
- Removing outcome filtering: rejected because it would reintroduce unrelated models and make driver inference ambiguous.

## Test plan

- Validate the fixture JSON and adapter registry entries.
- Verify planner paths from `cbc-mf96`, `cbc-mf2000`, `cbc-mf2005`, and `cbc-mf6` to spring flow.
- Run focused adapter tests and the existing UI inference/type checks.
- Apply the migration to the local database and verify the Hasura model tree exposes the updated formats.

## Documentation plan

Document the version-specific CBC contract in the adapter README and retain this design record as the data-flow explanation.

## Rollout/rollback plan

Apply the catalog migrations and reseed the local adapter registry. Deployment can apply the same migrations and adapter fixture seed. Rolling back the registration/configuration deletions requires restoring the prior catalog fixture because the removed rows are not duplicated in the down migrations.

Implementation note: the repository checks and focused UI tests passed. The
local Docker migration/fixture load also completed successfully, and the
resulting catalog contains only the four supported MODFLOW families, one
configuration per family. The GAM Capitan Reef child relationship was
repointed to the canonical MODFLOW 2005 configuration. Input semantics were
left unchanged beyond removing duplicate rows; explicit well/recharge/archive
normalization remains separate work except for the corrected MF6 archive
input. The browser-facing family labels are now normalized to MODFLOW 2005,
MODFLOW 2000, MODFLOW 6, and MODFLOW-96. The follow-up input-contract
migration normalizes the legacy families while preserving the MODFLOW 2005
package rows needed by its runtime. The local 0009 migration applied cleanly,
the fixture loaded twice without errors, all four families retained one
configuration, and the expected archive/WEL/RCH contract assertion returned
zero missing rows. The follow-up 0010 migration removes the six unreferenced
MODFLOW 2005 setup registrations so its root configuration is the only visible
family option. The 0011 migration adds explicit MODFLOW 2005 WEL/RCH override
metadata and completes native output formats and presentations for the four
canonical configurations. The local migration applied cleanly, the fixture
loaded twice without errors, the MODFLOW 2005 input assertion returned zero
missing contracts, and the canonical-output metadata assertion returned zero
missing rows. The 0012 migration removes the seven individual MODFLOW 2005
package-file links from the root configuration, leaving only archive, recharge,
and well inputs. The local 0012 migration applied cleanly, the fixture loaded
again without errors, and the root input query returned exactly three required
rows.

## Open questions

None for this change. Additional MODFLOW releases should receive their own format token and extraction transform when their binary layout is supported.

## Decisions

### 2026-09-21 - Use explicit version-specific CBC contracts

- **Decision:** Use `cbc-mf2005` for MODFLOW 2005 and existing `cbc-mf96`/`cbc-mf2000` tokens for their corresponding catalog outputs.
- **Reason:** The adapter planner matches formats exactly, and CBC layouts are version-specific.
- **Alternatives rejected:** Reusing generic `cbb` or another MODFLOW version's token would make inference appear to work while risking the wrong parser.
- **User feedback:** User confirmed the existing registrations make this a simpler metadata/linking fix.
- **Impact on implementation:** Add one adapter fixture entry, update catalog fixture values, and add a reversible migration.

### 2026-09-21 - Remove unsupported catalog registrations

- **Decision:** Physically remove the Farm Process/Texture and MT3D registrations from the catalog instead of hiding them with a UI or database flag.
- **Reason:** These registrations are not among the four supported MODFLOW variants and should not appear as model options.
- **Alternatives rejected:** A frontend label allowlist and an `is_modeling_enabled` visibility flag were rejected because they leave unsupported registrations in the catalog.
- **User feedback:** User explicitly asked to remove the extra MODFLOW versions after seeing them still appear.
- **Impact on implementation:** Add a catalog deletion migration and matching fixture cleanup; keep model discovery data-driven.

### 2026-09-21 - Keep one configuration per MODFLOW family

- **Decision:** Keep one canonical configuration for MODFLOW 2005, MF2000,
  MF6, and MF96; delete the other four unreferenced configuration rows.
- **Reason:** The UI should present one usable option per supported family while
  preserving the richest executable metadata where duplicates exist.
- **Alternatives rejected:** Leaving duplicate runtime rows was rejected because
  it exposes indistinguishable options and makes outcome inference appear to
  find more models than are actually distinct.
- **User feedback:** User confirmed the immediate goal is one configuration per
  family.
- **Impact on implementation:** Add a guarded data migration and matching
  fixture cleanup. Repoint the GAM Capitan Reef child configuration from the
  deleted expanded MODFLOW 2005 parent to the canonical MODFLOW 2005 row; do
  not change the configuration-input semantics yet.

### 2026-09-21 - Normalize displayed MODFLOW family labels

- **Decision:** Use version-specific family labels in the model browser: `MODFLOW 2005`, `MODFLOW 2000`, and `MODFLOW 6`.
- **Reason:** The browser groups by the catalog software label, and the prior
  labels `MODFLOW` and `MODFLOW-2001` were misleading.
- **Impact on implementation:** Add a label-only migration and fixture updates;
  configuration IDs, versions, and input/output contracts are unchanged.

### 2026-09-21 - Use an archive input for MF6

- **Decision:** Replace the MF6 `mf6-nam` configuration input with a required
  `MODFLOW 6 simulation archive` input mapped to
  `groundwater_model__simulation_archive`; retain the WEL and RCH inputs.
- **Reason:** The runnable MF6 configuration requires the complete simulation
  archive, while the standalone name file does not describe the full input
  bundle expected by the runtime.
- **Impact on implementation:** Add the archive dataset specification and
  presentation mapping to the migration and fixture, then replace the single
  configuration-input link.

### 2026-09-21 - Normalize legacy MODFLOW input contracts

- **Decision:** Give MF2000 and MF96 explicit archive, WEL, and recharge
  inputs; add the archive input to MODFLOW 2005 and correct its existing WEL
  mapping.
- **Reason:** The problem-formulation UI and adapter planner need stable
  semantic input contracts instead of generic name/package rows. MODFLOW 2005
  still retains its package inputs because they are part of the executable
  configuration contract.
- **Alternatives rejected:** Removing all MODFLOW 2005 package rows would make
  the catalog look uniform but would discard required runtime metadata.

### 2026-09-21 - Remove unreferenced MODFLOW 2005 setups

- **Decision:** Remove the six child setup registrations under the canonical
  MODFLOW 2005 configuration.
- **Reason:** The catalog policy is one visible configuration per supported
  family, and these rows had no execution or thread references.
- **Rollback:** Restore the prior catalog fixture/revision if the historical
  setup metadata is needed; the down migration does not recreate it.

### 2026-09-22 - Normalize canonical MODFLOW I/O metadata

- **Decision:** Keep the MODFLOW 2005 package IDs but present WEL and RCH as
  explicit semantic overrides; add complete native output formats and
  standard-variable presentations for CBC, head, and drawdown outputs.
- **Reason:** The UI needs meaningful input/output metadata while the runtime
  still depends on the existing package relationships.
- **Adapter boundary:** CBC outputs retain version-specific `cbc-mf*` formats;
  the adapter registry remains responsible for transforming those files into
  `spring__volume_flow_rate`.

### 2026-09-22 - Use the MODFLOW 2005 archive as the package bundle

- **Decision:** Remove the seven individual package-file links from the
  canonical MODFLOW 2005 configuration and retain only archive, recharge, and
  well inputs.
- **Reason:** The archive is the complete runtime package, so exposing the
  individual files made the UI show ten required inputs instead of the intended
  three-file contract.
- **Rollback:** The down migration restores the seven package-file links.

### 2026-09-22 - Repair missing legacy configuration parents during normalization

- **Decision:** Make the 0009 input-contract migration idempotently restore the
  canonical MODFLOW 2000 and MODFLOW 96 configuration rows, output metadata,
  and native output links when they are absent from a persistent catalog.
- **Reason:** The deployed database was created from an older catalog snapshot
  that did not contain the fixture rows targeted by the normalization. The
  migration otherwise failed on its configuration foreign key before it could
  apply the intended input contracts.
- **Alternatives rejected:** A manual SQL repair would fix only the current
  dev database and would leave future persistent environments vulnerable to the
  same migration failure. A new later migration cannot help because Hasura
  stops at 0009 before it can reach it.
- **Impact on implementation:** The 0009 migration now inserts or normalizes
  only the missing canonical rows, preserving existing relationships and
  allowing the remaining migrations to apply normally.

### 2026-09-22 - Complete the MODFLOW 6 input contract

- **Decision:** Keep exactly three visible MF6 inputs: the required
  version-specific simulation archive, plus optional WEL and RCH override
  inputs. Remove the stale generic simulation archive relationship and the
  three duplicate RCHA relationships.
- **Reason:** The persistent dev catalog retained relationships from an older
  MF6 configuration after the versioned archive was added. Those rows caused
  the UI to display both the old bundle contract and the new archive contract.
- **Migration:** Add `1771300000020_complete_modflow6_input_contract` with a
  configuration-scoped forward cleanup and reversible relationship restore.
- **Ordering:** This migration follows the separate `1771300000019` Tapis-host
  migration and does not depend on or modify it.
- **Validation:** Read back the dev Hasura configuration and require exactly
  three input rows with archive required and WEL/RCH optional.

### 2026-09-22 - Align MF6 plan submission with the Tapis app contract

- **Decision:** Keep semantic MF6 input labels in the model catalog and map
  them to the Tapis manifest names (`mf6-simulation-archive`, `mf6-wel`, and
  `mf6-rch`) only when constructing the job request.
- **Reason:** The catalog describes meaning while Tapis validates the file
  input names in the app manifest. Exact-name matching made a valid archive
  contract fail with the old `mf6-nam` app version and also rejected optional
  manifest inputs that the model does not use.
- **Implementation:** `TapisJobService` now performs the narrow MF6 semantic
  mapping, skips unmodeled optional app inputs, and retains strict failures for
  missing required inputs. Migration
  `1771300000022_normalize_modflow6_tapis_component` moves the canonical MF6
  configuration from `0.0.fb606ee` to the archive-capable `0.0.febed09`
  manifest.
- **Prerequisite:** The `modflow6-simulation/0.0.febed09` Tapis app must be
  registered in the target Tapis tenant before the catalog migration is
  applied there.

## User feedback / decisions

- User asked to implement the fix after identifying that the existing adapter registrations already cover MODFLOW 6, USG, 2000, and 96.
