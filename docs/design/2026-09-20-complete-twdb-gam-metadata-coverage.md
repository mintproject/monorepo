# Complete TWDB GAM model-file metadata coverage

## Status

Implementing

## Objective

Ensure every primary model archive in the `twdb-gams` CKAN organization has an
evidence-backed resource-level `mint_standard_variables` value, every
corresponding dataset has dataset-level spatial metadata, and every dataset has
evidence-backed temporal start/end fields required by MINT discovery. Keep
reports, grids, geodatabases, and auxiliary files separate unless they have
direct evidence for their own variables.

## User need

- **Primary user:** MINT data scientists and facilitators discovering TWDB
  groundwater models through CKAN.
- **Secondary users:** Model developers and catalog maintainers who need to
  distinguish model bundles from GIS archives and understand model coverage.
- **Job-to-be-done:** Find the correct model archive, understand what scientific
  quantities it represents, and locate its modeled area without inspecting raw
  CKAN fields manually.
- **Current pain:** The audit found 32 primary model archives, but only 10 have
  resource-level SVOs, only 11 of the 32 datasets have dataset-level spatial
  metadata, and only 10 have both dataset-level temporal dates populated.
- **Definition of success:** All 32 primary model archives have non-empty,
  reviewed SVO bindings supported by per-variable evidence; all 32 datasets
  have dataset-level spatial metadata and evidence-backed temporal start/end
  dates; resource-level spatial copies remain empty; and the migration is
  repeatable without changing resource identities.
  If an archive cannot be supported by evidence, the plan fails closed rather
  than treating a status-only row as complete.

## Current code/system summary

- `reconcile_twdb_gams.py` inventories 32 TWDB model records and 178 linked
  resources, verifies source-link availability, and produces a dry-run plan.
- `reconcile_ckan_svos.py` performs drift-checked CKAN package/resource patches
  for reviewed SVO, spatial, and temporal corrections.
- The adapter consumes `mint_standard_variables` from resources, not packages.
- CKAN now accepts `spatial` as the canonical dataset field. The migration
  removes any legacy duplicate `spatial` extra while preserving the dataset
  value.
- The San Antonio GWSIM-IV archive was characterized from its contents; its
  seven SVO bindings are already live.

## Proposed design

1. Build a fixed evidence matrix for all 32 valid, authoritative primary model
   archives. None may be classified as opaque or left with a status-only row.
   Record the
   immutable CKAN package ID, primary archive resource ID, expected source URL,
   model identity, TWDB model page, model category, model engine/version
   evidence, and a per-variable evidence record containing the SVO URI/label,
   evidence URL, evidence location or archive member path, retrieval date, and
   rationale.
2. Put only the evidence-backed SVO list on the corresponding primary model
   archive resource. Do not copy the list to reports, grids, geodatabases, or
   auxiliary resources.
3. Add dataset-level spatial metadata for every model package. Prefer an exact
   polygon derived from an official model grid or published model geometry. For
   the remaining datasets, use the authoritative TWDB model-extent envelope and
   record that it is an extent envelope rather than an exact grid footprint.
   Each geometry record will include WGS84 CRS, coordinate order, provenance,
   method, retrieval date, and an explicit `exact_grid` or
   `extent_envelope` precision classification.
4. Keep resource-level `spatial` empty. Preserve stable package and resource
   IDs and update only existing records.
5. Make target resolution fail closed using the fixed 32-row allowlist. Abort
   on missing or duplicate package/resource IDs, changed parentage, changed
   titles or URLs, ambiguous matches, missing evidence, invalid SVO mappings,
   invalid GeoJSON, or live-state drift.
6. Extend the reconciliation manifest and focused tests so the complete plan is
   dry-run by default, writes field-scoped patches only, records complete
   before-state rollback values, and independently verifies 32/32 package and
   resource readback, zero resource-level spatial values, stable IDs, and
   unchanged non-primary resources.
7. Run the adapter CKAN synchronization in dry-run mode after CKAN metadata is
   corrected; any adapter database write remains a separate approved operation.
8. Maintain a separate 32-row temporal evidence manifest. Write
   `temporal_coverage_start` and `temporal_coverage_end` at dataset level,
   using year precision (`YYYY-01-01` through `YYYY-12-31`) when the source
   reports annual or coarser boundaries. Store evidence URL, location,
   rationale, coverage kind, and precision as package extras.

## Files likely affected

- `svo-adapter-service/scripts/reconcile_ckan_svos.py`
- `svo-adapter-service/tests/test_ckan_svo_reconciliation.py`
- `svo-adapter-service/scripts/reconcile_twdb_gams.py` only if inventory or
  evidence handling needs a focused correction
- `docs/runbook-ckan-svo-dataset-registration.md`
- `svo-adapter-service/docs/twdb-gam-ckan-reconciliation.md`
- A versioned 32-row evidence manifest, stored alongside the reconciliation
  script or generated as a run artifact
- This design spec

## API/schema changes

No new API or database schema is proposed. SVOs will be written to the
resource-level `mint_standard_variables` field. Spatial will be written to the
canonical dataset-level CKAN `spatial` field; resource-level spatial fields and
legacy duplicate spatial extras will be cleared. Temporal start/end will be
written to the existing dataset-level `temporal_coverage_start` and
`temporal_coverage_end` fields.

## Data flow

TWDB download table, model pages, and official reports → model/archive and
temporal evidence matrices → deterministic SVO/spatial/temporal reconciliation
plan → explicit CKAN approval → package/resource patches → CKAN readback →
adapter sync dry-run.

## Risks and tradeoffs

- Extent envelopes improve discoverability but are less precise than model-grid
  polygons; their provenance and precision must remain visible in package
  metadata.
- A model archive can contain multiple scientific quantities, but adding a
  variable without direct evidence would create false MINT discovery results.
- Some TWDB archives are large or use legacy formats; metadata inspection must
  not require executing the model or downloading every full artifact. Validity
  of the supplied archive is accepted as a user-provided requirement; the
  remaining evidence task is identifying its supported SVO quantities.
- A broad CKAN write can overwrite concurrent edits, so the plan must retain
  expected-before values and refuse drift.
- A fixed manifest can become stale when TWDB revises URLs or CKAN records;
  the reconciler must revalidate all IDs, parentage, titles, URLs, and source
  citations immediately before writing.
- Temporal dates can describe a calibrated history, a full configured model
  range, or a steady-state calibration evidence window. The manifest records
  that coverage kind so a date range is not mistaken for forecast availability.

## Alternatives considered

- Copy one generic groundwater SVO list to all archives: rejected because it
  would assert variables not demonstrated by each model.
- Put spatial on every resource: rejected because spatial describes the model
  dataset and duplicates create inconsistent discovery behavior.
- Use only exact grid footprints: rejected by the user for this catalog pass;
  authoritative model-extent envelopes are acceptable when exact geometry is
  unavailable.
- Execute models to validate metadata: rejected as unnecessary for this task;
  the archive and TWDB documentation are the authoritative sources for the
  catalog annotations.
- Use title, filename, or URL heuristics as write authorization: rejected;
  heuristics may suggest candidates during audit but cannot authorize a patch.

## Test plan

- Validate exact set equality for the 32 allowlisted package IDs, archive
  resource IDs, parentage, URLs, and model identities.
- Validate that every archive has non-empty per-variable evidence and a planned
  resource-level SVO value; missing evidence fails the plan.
- Validate that all 32 package IDs have dataset spatial metadata in the plan,
  with valid GeoJSON, WGS84 coordinates, provenance, and precision class.
- Validate that all 32 package IDs have non-empty dataset-level temporal start
  and end dates, valid ordering, year precision, and official report evidence.
- Validate that no report, grid, geodatabase, or auxiliary resource receives a
  copied archive SVO list.
- Validate that all resource-level spatial values are empty after the plan.
- Run Python compilation and focused reconciliation tests, including duplicate,
  ambiguous-match, stale-URL, invalid-geometry, and drift cases.
- Run a fresh dry-run with zero drift before CKAN writes.
- Persist a complete before-state snapshot and exact diff/rollback manifest.
- Verify independent package/resource readback for all 32 targets and repeat
  dry-run idempotence after the write.

## Documentation plan

Document the evidence policy, extent-envelope precision, model engine/version
handling, and the dry-run/apply commands in the existing CKAN reconciliation
runbook and service documentation.

## Rollout/rollback plan

Produce before/after snapshots, target fingerprints, per-variable evidence,
geometry provenance, a rollback manifest, and an action log under a
timestamped `/tmp` directory. Apply only sequential, field-scoped
package/resource patches after the user approves the exact dry-run. Roll back
only when the post-write fingerprint still matches; stop for review if it has
changed. Do not delete datasets or resources, modify the other 146 resources,
invoke MINT, or alter visibility/ownership.

## Open questions

- The temporal evidence review resolves the 22 datasets that previously lacked
  temporal dates. The dry-run must still fail closed if any report URL,
  evidence location, date, or package identity is missing or invalid.
- The live `subside_dataset` CKAN schema still exposes `spatial` on resources;
  the local `ckan-docker` schema already moves it to the dataset. That schema
  deployment must complete before the remaining spatial package patches can be
  safely resumed.
- The source hierarchy for evidence is: official archive member/file evidence,
  official TWDB model page or report, then curator-reviewed TWDB extent metadata;
  unsupported inference is not accepted.

## Decisions

### 2026-09-20 — Accept authoritative model-extent envelopes

- **Decision:** Use exact official model geometry where available and
  authoritative TWDB model-extent envelopes for remaining datasets.
- **Reason:** The user confirmed that extent envelopes are acceptable for this
  catalog coverage task.
- **Alternatives rejected:** Blocking all spatial metadata until every exact
  model-grid polygon is extracted; using undocumented or inferred boundaries.
- **User feedback:** “Exten envelopes are fine.”
- **Impact on implementation:** The plan will annotate spatial precision and
  provenance rather than leaving 21 datasets without dataset-level spatial
  metadata.

### 2026-09-20 — Require a fixed 32-row evidence allowlist

- **Decision:** The broad migration must use an immutable one-to-one manifest
  mapping each canonical TWDB model to one CKAN dataset, one primary model
  archive resource, its source URL, its SVO evidence, and its spatial evidence.
- **Reason:** Review found that organization-wide counts and title/URL matching
  are not sufficient protection against duplicate, renamed, or ambiguous model
  records.
- **Alternatives rejected:** Applying metadata to every reachable archive;
  using heuristics as write authorization; accepting status-only rows when a
  variable remains unverified.
- **User feedback:** The user asked for all model files to have appropriate
  SVOs and spatial metadata and approved authoritative extent envelopes.
- **Impact on implementation:** Missing evidence, invalid geometry, identity
  drift, and non-32/32 coverage will fail the dry-run and block CKAN writes.

### 2026-09-20 — Treat every primary archive as valid and annotatable

- **Decision:** All 32 primary model archives are valid authoritative files and
  must receive non-empty evidence-backed SVO annotations; none will be left in
  an opaque/archive-unreviewed state.
- **Reason:** The user clarified that archive validity is known and is not an
  open question for this migration.
- **Alternatives rejected:** Leaving archives untagged because execution or
  full artifact inspection was not performed; using a status-only placeholder.
- **User feedback:** “we know that all files are valid so none of the opaque
  thing.”
- **Impact on implementation:** The manifest validator will fail closed unless
  all 32 archives have concrete SVO values and supporting evidence records.

### 2026-09-20 — Require evidence-backed dataset temporal coverage

- **Decision:** Populate dataset-level temporal start/end for all 32 archives
  from official TWDB or USGS model documentation, while recording whether the
  range is historical calibration, transient simulation, a full configured
  predictive range, or a steady-state calibration evidence window.
- **Reason:** MINT discovery requires temporal bounds, and the existing CKAN
  records left 22 of 32 datasets blank or unverified.
- **Alternatives rejected:** Copying report publication dates; using CKAN
  registration dates; inferring dates from filenames; or leaving steady-state
  and predictive archives blank.
- **Impact on implementation:** The reconciler now validates a fixed temporal
  manifest and plans both dataset fields and provenance extras. The CKAN apply
  remains gated behind an explicit external-write approval.

### 2026-09-20 — Stop safely on the live schema mismatch

- **Decision:** Do not convert `subside_dataset` records to the generic
  `dataset` type or fall back to resource-level spatial metadata. Pause the
  remaining batch until the prepared CKAN schema is deployed.
- **Evidence:** The live `scheming_dataset_schema_show` response lists
  `spatial` under `resource_fields` for `subside_dataset`; the first attempted
  package patch returned a schema conflict when `spatial` was also sent as an
  extra. The corrected plan successfully wrote canonical spatial for a generic
  `dataset` record, but readback for the first `subside_dataset` record showed
  the field was not persisted.
- **Impact on implementation:** Two records were partially/fully updated
  before the readback guard stopped the batch. No rollback was issued because
  those SVO and temporal changes are within the approved target state; the
  remaining run is resumable after schema deployment.

## User feedback / decisions

- The user requested complete SVO and spatial coverage for all model files.
- The user clarified that model archives are authoritative and model execution
  validation is not required for this metadata task.
- The user clarified that all 32 primary archives are valid and must receive
  concrete SVO annotations; none should remain opaque/unreviewed.
- The user approved authoritative extent envelopes where exact geometry is not
  available.
