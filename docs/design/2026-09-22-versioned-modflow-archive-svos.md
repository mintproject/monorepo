# Version-specific MODFLOW simulation-archive standard variables

Status: Implemented

## Objective

Replace the single generic MODFLOW archive standard variable with one exact
MINT standard-variable label per supported MODFLOW family/version:

- `groundwater_model_modflow6_simulation_archive`
- `groundwater_model_modflow2000_simulation_archive`
- `groundwater_model_modflow2005_simulation_archive`
- `groundwater_model_modflow96_simulation_archive`

Make the MINT model catalog, UI CKAN discovery, CKAN reconciliation metadata,
and SVO Adapter mapping use the same version-specific contract.

## User need

**Primary user:** A groundwater modeler selecting a MODFLOW configuration in the
Problem Formulation wizard.

**Secondary users:** CKAN catalog maintainers and SVO Adapter operators.

**Job-to-be-done:** Find a simulation archive compatible with the selected
MODFLOW model version without manually filtering archives.

**Current pain:** Every model requests the generic
`groundwater_model__simulation_archive`, while CKAN archives are either tagged
with contained scientific variables or have no archive annotation. This makes
the Datasets step unable to distinguish version-compatible archives.

**Definition of success:** Each model configuration requests its own exact
version-specific label, CKAN matching returns only resources carrying that
label, and the SVO Adapter can synchronize those resources without losing the
existing contained-variable annotations.

## Current code/system summary

- The four model configurations currently point through their archive
  presentations to the generic archive standard variable.
- The UI performs exact resource-level matching against CKAN's
  `mint_standard_variables` field.
- The SVO Adapter maps CKAN short labels to MINT SVO URIs, but has no mapping
  for the archive label and no `SIMULATION-ARCHIVE` format alias.
- Existing CKAN reconciliation keeps reviewed scientific-variable annotations
  on complete model archives. Those annotations must remain in addition to the
  version-specific archive annotation.

## Proposed design

1. Add four version-specific MINT standard-variable rows with stable IDs under
   the existing MINT namespace.
2. Update the existing MODFLOW archive presentations to reference the
   corresponding version-specific standard variable while preserving their
   presentation, dataset-specification, and configuration-input IDs.
3. Preserve `zip` as the MINT dataset-specification format. Normalize CKAN
   `ZIP`, `ZIPX`, `7Z`, and `simulation-archive` resource formats to the
   Adapter's model-archive `zip` token.
4. Add the four short labels and SVO URI mappings to the SVO Adapter.
5. Extend the CKAN reconciliation policy so a reviewed archive whose package
   carries a `modflow_variant` extra gets its version-specific archive label in
   addition to its evidence-backed contained-variable labels. Archives
   supporting more than one model version may carry more than one
   version-specific archive label.
6. Update fixtures and focused tests. Generate a dry-run CKAN plan, but do not
   apply external CKAN changes in this implementation pass.

## Files likely affected

- `graphql_engine/migrations/` — new versioned catalog migration
- `graphql_engine/fixtures/modelcatalog.sql`
- `svo-adapter-service/app/ckan_sync.py`
- `svo-adapter-service/scripts/reconcile_ckan_svos.py`
- `svo-adapter-service/tests/test_ckan_sync_boundaries.py`
- `svo-adapter-service/tests/test_ckan_svo_reconciliation.py`
- `ui-react/src/lib/datasets/__tests__/ckan.test.ts` if matching coverage needs
  extension
- this design spec

## API/schema changes

No table or endpoint schema changes are required. The catalog gains four
controlled-vocabulary rows and updates existing presentation-to-standard-
variable foreign-key values. CKAN resource annotations gain version-specific
short labels. The Adapter's existing mapping tables gain corresponding
entries.

## Data flow

```text
MINT model configuration
  -> version-specific archive presentation
  -> version-specific standard-variable label
  -> UI exact CKAN resource match
  -> archive resource with matching CKAN annotation
  -> SVO Adapter URI/format mapping
```

Contained scientific-variable annotations continue to flow independently for
discovery of heads, recharge, pumping, spring flow, and other archive contents.

## Risks and tradeoffs

- Existing CKAN resources tagged only with the generic archive label will need
  a metadata migration or compatibility handling.
- An archive compatible with multiple versions must carry multiple labels;
  otherwise it will be hidden from one of the compatible model configurations.
- Version-specific SVOs improve safety but increase controlled-vocabulary and
  reconciliation maintenance.
- `simulation-archive` is a CKAN format convention, not the MINT `zip`
  specification. The Adapter must normalize it without treating the archive as
  a shapefile ZIP.
- The generic standard variable should remain in the catalog during rollout so
  historical rows and rollback remain inspectable; model presentations will no
  longer use it after the migration.

## Alternatives considered

- Keep one generic archive SVO and infer compatibility from model titles or
  resource formats: rejected because it can bind an incompatible archive.
- Change only the UI matcher to inspect `resource_type` or `format`: rejected
  because the SVO Adapter and other consumers would still lack a semantic
  contract.
- Replace contained-variable annotations with the archive label: rejected
  because archives remain discoverable by the scientific variables they contain.

## Test plan

- Assert each archive presentation references the correct version-specific
  standard-variable ID.
- Assert each configuration still has the same archive dataset specification
  and input count.
- Assert UI CKAN matching succeeds for each version-specific label and does
  not match another version's label.
- Assert the Adapter maps all four labels to their SVO URIs and maps
  `SIMULATION-ARCHIVE`, `ZIP`, `ZIPX`, and `7Z` to the model-archive format.
- Assert reconciliation appends version labels without removing reviewed
  contained-variable labels and remains idempotent.
- Run focused GraphQL/catalog, UI, and SVO Adapter tests plus Python
  compilation and `git diff --check`.

## Documentation plan

Update the CKAN reconciliation runbook and Adapter documentation with the
version-specific archive-label contract and the multi-version annotation rule.

## Rollout/rollback plan

Apply the local catalog migration and deploy the Adapter/UI code first. Produce
a drift-checked CKAN dry-run with before-state and rollback values. Apply CKAN
resource patches only after explicit approval, then run Adapter synchronization
dry-run and read-back verification. Rollback consists of reverting the catalog
migration/code and restoring the recorded CKAN resource annotation values.

## Open questions

- Which of the audited CKAN archives are compatible with more than one MODFLOW
  family/version? The reconciliation manifest should record this explicitly.
- Should the generic archive SVO be deprecated after all consumers migrate, or
  remain permanently as a broad parent vocabulary entry?

## Decisions

### 2026-09-22 — Use version-specific archive labels

- **Decision:** Use one archive standard variable per MODFLOW family/version.
- **Reason:** The Problem Formulation wizard must not offer archives that the
  selected model cannot consume.
- **User approval:** The user responded “great update it” to the proposed
  version-specific design.

### 2026-09-22 — Preserve contained-variable annotations

- **Decision:** Add the version-specific archive label without removing
  evidence-backed scientific-variable labels from model archives.
- **Reason:** The same archive can satisfy both model-input discovery and
  scientific-variable discovery.

### 2026-09-22 — Derive CKAN archive labels from package model variants

- **Decision:** The reconciliation plan derives version-specific archive labels
  from the existing CKAN `modflow_variant` package extra, including
  comma-separated values for multi-version archives.
- **Reason:** The live catalog already carries this model-variant metadata for
  the known MODFLOW archives, so the change avoids duplicating version data in
  the fixed evidence manifest.
- **Alternatives rejected:** Inferring versions from titles or URLs; rejected
  because those heuristics are not reliable write authorization.
- **User feedback:** None beyond approval of the version-specific design.
- **Impact on implementation:** `reconcile_ckan_svos.py` adds labels only when
  the package variant is explicit; the dry-run remains drift-checked and does
  not mutate CKAN.

## User feedback / decisions

- 2026-09-22: The user approved updating MINT and the surrounding CKAN/SVO
  Adapter contract to use version-specific archive labels.
- 2026-09-22: Implemented the local MINT migration, catalog fixture, Adapter
  mappings, reconciliation behavior, tests, and runbook updates. CKAN metadata
  remains pending explicit external-write approval.
