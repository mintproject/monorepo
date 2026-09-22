# TWDB model archive catalog reconciliation

## Status

Implemented — approved, published, and read back on 2026-09-19.

## Objective

Register every model archive on the TWDB GAM downloads page in CKAN's `twdb-gams` organization and repair incomplete or incorrect metadata while retaining working data and stable resource identities.

## User need

Scientists need the correct model release, downloadable inputs, file formats, scientific variables, units, spatial and temporal coverage, and provenance. Facilitators need readable descriptions of model purpose, regional coverage, limitations, and whether outputs are actually available.

## Current code/system summary

The live organization contains 22 datasets. Carrizo–Wilcox Central has zero resources. Some records contain links only; others have extracted inputs and outputs. Many `subside_dataset` entries store geometry only on resources, whereas the MINT UI uses dataset geometry. The existing four-model registration script in `modflow-executables` uploads extracted files and includes unsupported generic assertions about bias, units, coverage and licensing; it cannot safely serve as the full inventory.

MINT matches `mint_standard_variables` on resources. The SVO adapter's current CKAN synchronizer also reads resource variables, but treats arbitrary ZIP URLs as shapefile archives and assumes USG for HDS/CBC. Metadata must not advertise a compressed model bundle as a ready hydraulic-head raster. Model release numbers and MODFLOW engine versions are separate facts.

## Proposed design

1. Snapshot the live packages and schemas; parse all TWDB table rows including the five-cell Northern Trinity row. Include alternative and research models, explicitly classified.
2. Match by exact authoritative archive URLs, reviewed existing package names and source model pages; flag ambiguity. Preserve existing package/resource IDs, uploads and older releases.
3. Check each authoritative resource URL and capture status, size, content type and modification metadata. Distinguish archives, geodatabases, grids, reports and auxiliary resources.
4. Read model pages and archive metadata for evidence. Do not infer model coverage from a publication date or use a GMA envelope as an exact model footprint. Store unknown fields and verification needs explicitly in the review plan.
5. Draft dataset and resource metadata with plain-language guidance, source attribution, download format/extension, release, availability, license evidence and scientific semantics where justified. Use existing MINT names without falsely asserting membership in the canonical SVO ontology.
6. Generate a concrete additive/corrective plan and validation report. Apply only reviewed, evidenced corrections with snapshots, drift checks and read-back verification. No package/resource deletions, model executions, bulk archive mirroring or fabricated output data.

## Files likely affected

- `svo-adapter-service/scripts/reconcile_twdb_gams.py`: read-only inventory, comparison and payload preparation.
- `svo-adapter-service/tests/test_reconcile_twdb_gams.py`: identity, preservation and scientific-metadata tests.
- `svo-adapter-service/docs/twdb-gam-ckan-reconciliation.md`: operator workflow and metadata conventions.

## API/schema changes

Use CKAN Action API and existing scheming fields. No CKAN extension deployment or database migration is currently proposed. Live schema inspection, not local schema assumptions, governs payload validation. MINT discovery/adapter deficiencies discovered during validation are recorded separately before changing their behavior.

## Data flow

TWDB download table and linked evidence + CKAN package/schema snapshot → identity reconciliation → metadata and link validation → reviewable action plan → authorized CKAN patches/creates → read-back and discovery checks.

## Risks and tradeoffs

- Archive availability is not model run validation; missing outputs must remain explicitly missing.
- Current and superseded releases may coexist; preserve older resources and label their provenance.
- Coarse envelopes, mixed units, multiple aquifers and heterogeneous package types need explicit evidence.
- Large ZIP/7z/ZIPX bundles may require later content inspection. Remote ranges can inspect ZIP metadata without downloading whole multi-gigabyte archives; unsupported formats must be reported honestly.
- Existing CKAN assertions may be wrong. Preserve unknown uploaded data, but do not propagate unverified assertions into new metadata.

## Alternatives considered

- Reuse the four-model bulk uploader unchanged: rejected because its assumptions and target organization do not match this reconciliation.
- Recreate all datasets: rejected because it breaks stable references and risks losing uploaded resources.
- Assign every groundwater variable to every archive: rejected because MINT would confuse capability with verified data availability.

## Test plan

Check inventory coverage including Northern Trinity, distinct Hueco/Mesilla rows sharing one page, URL-based identity, matching existing resources, preservation of uploads, changed source versions and rejected guessed metadata. Validate URLs without full archive downloads. Compare desired resource IDs/URLs and semantic metadata with read-back after any publication.

## Documentation plan

Document archive-versus-derived-resource semantics, explicit scientific metadata gaps, identity/provenance, safe reapplication, source timestamps and any remaining discovery limitations.

## Rollout/rollback plan

Save the original package/resource metadata before applying changes. Patch existing records and add missing resources. Preserve uploads and old versions. Record each returned ID and changed field. Reversal restores only changed metadata from snapshots; removing new records requires separate deletion authorization.

## Open questions

- Exact model footprints, simulation periods, length/time units, vertical datums, and archive-contained variables require model-specific archive/report inspection before they can be added.
- Execution readiness still requires per-model engine validation and a successful MINT/Tapis run; download availability is not execution evidence.

## Decisions

### 2026-09-19 — Include the complete downloads page

- Decision: include GAM, alternative and research model archives with explicit classifications.
- Reason: user requested complete page coverage and confirmed this scope in the clarification.
- User feedback: “Include every listed model archive (recommended)”.
- Impact: identity is per model archive, not solely per shared landing page or aquifer name.

### 2026-09-19 — Source-backed metadata and additive reconciliation

- Decision: preserve stable IDs/uploads; publish only supported scientific assertions; use download availability separately from execution readiness.
- Review: architect and security/data-quality perspectives reviewed directly (no callable specialist-agent tool available). Both support snapshots, deterministic matching and patch-only preservation. The data-quality review rejects global unit defaults and blanket SVO tagging.
- Impact: unsupported scientific fields are explicit gaps and not invented values.

### 2026-09-19 — Live reconciliation completed

- Decision: apply the approved 32-package plan after a fresh audit found all 178 TWDB source links reachable.
- Result: 210 CKAN actions completed: 14 package creates, 18 package patches, 159 resource creates, and 19 resource patches.
- Verification: the organization increased from 22 to 36 packages; all 32 source models and all 178 authoritative source URLs were present on read-back. No pre-existing package or resource IDs were lost, and the four unmatched output/planning datasets were unchanged.
- Semantic result: no opaque model or predictive archive was assigned `mint_standard_variables`. Existing extracted resources and their resource IDs were preserved.
- Metadata result: unsupported generated `esipfed_*` claims were removed from affected matched records. License, spatial coverage, temporal coverage, units, datum, outputs, and execution status are now conservative and evidence-qualified.
- Deviation: full archive extraction and exact model-grid geometry derivation were not performed. These are recorded as explicit metadata gaps instead of guessed values.

## User feedback / decisions

2026-09-19: user requested registering all archives and correcting existing metadata for MINT scientist/facilitator discovery, including semantic annotations and extensions. This authorizes investigation and preparation; exact changes are recorded in the generated plan before live application.

2026-09-19: user approved the reviewed design and instructed: “Approved do it.” This authorizes the validated CKAN creates and updates described by this specification, with snapshots and read-back verification.
