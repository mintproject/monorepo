# Correct CKAN SVO annotations and adapter synchronization

## Status

Implemented — live CKAN metadata was corrected and verified on 2026-09-20. Adapter and CKAN schema code is tested locally; deployment and the adapter database sync remain rollout steps.

## Objective

Correct misleading or ineffective `mint_standard_variables` metadata in the CKAN `twdb-gams` organization and make the SVO Adapter synchronize corrected annotations without duplicate or stale semantic rows.

## User need

MINT users should discover both directly interpretable scientific files and complete model archives by their scientific variables. Reports and control files must not appear as scientific data merely because they belong to a model package. Spatial coverage describes the dataset and must not be duplicated on individual resources. Corrected CKAN metadata must remain stable across repeated adapter synchronization.

## Current code/system summary

- CKAN contains 36 `twdb-gams` packages after the TWDB archive reconciliation.
- Two NTGAM packages have working resource-level annotations and are preservation baselines.
- Nine `subside_dataset` package-level lists have been moved to ten model-archive resources; the package copies are empty.
- Capitan Reef has eight corrected scientific resources. PDF, control-file, and file-type labels were removed from `mint_standard_variables`.
- The synchronizer skips all-unmapped resources, transactionally replaces CKAN-owned variable children, and removes stale CKAN-owned objects when annotations disappear.
- `CKAN_FORMAT_TO_ADAPTER` covers the audited scientific formats, and model ZIP/ZIPX/7Z bundles remain distinct from shapefile ZIPs.
- The live MINT dev catalog confirms canonical labels for initial head, recharge, well flow rate, horizontal/vertical hydraulic conductivity, grid top/bottom elevation, hydraulic head, and drawdown.

## Proposed design

1. Extend the adapter mapping only for source-backed variables used by corrected resources. Preserve established legacy aliases and do not rewrite unrelated contracts.
2. Add PARQUET and DDN format normalization.
3. Treat all-unmapped annotations as skipped resources with warnings instead of creating semantically empty data objects.
4. Reconcile each tagged CKAN resource atomically in Hasura: delete its existing variable children and upsert the parent plus the current variable set in one GraphQL mutation. Delete the CKAN-owned data object when a fetched resource has no usable annotation, so removed CKAN tags cannot remain discoverable.
5. Add a dry-run-first reconciliation script with fixed package/resource identities, live drift checks, before/after snapshots, action logging, and read-back validation.
6. Move package-level variable lists from the nine affected GAM datasets to their model-archive resources. Keep the package field empty because the adapter consumes resource annotations, but preserve the reviewed variable assertions on the downloadable model bundles.
7. Correct Capitan resources:
   - BAS → `groundwater__initial_head`.
   - DIS → topmost model-grid top elevation and model-grid layer-bottom elevation.
   - LPF → horizontal and vertical groundwater hydraulic conductivity.
   - RCH → `groundwater__recharge_volume_flux`.
   - WEL → `groundwater_well__volume_flow_rate`.
   - HDS → `groundwater__hydraulic_head`, format HDS.
   - DDN → `groundwater__drawdown`, format DDN.
   - Remove `mint_standard_variables` from PDFs, DRN, HFB, OC, and other non-variable resources. Preserve their resource IDs and non-semantic metadata.
8. Promote each reviewed GAM polygon from its resource copies to the parent dataset and clear the resource-level `spatial` copies. Refuse the migration if a dataset's resource polygons disagree.
9. Leave archive resources without an existing reviewed variable list untagged until their contents are characterized; this correction moves known assertions rather than inventing new ones.
10. Preserve the working NTGAM output package byte-for-byte except for read-only verification.

## Files likely affected

- `svo-adapter-service/app/ckan_sync.py`
- `svo-adapter-service/tests/test_ckan_sync_boundaries.py`
- `svo-adapter-service/tests/test_ckan_svo_reconciliation.py`
- `svo-adapter-service/scripts/reconcile_ckan_svos.py`
- `svo-adapter-service/scripts/reconcile_twdb_gams.py`
- `docs/runbook-ckan-svo-dataset-registration.md`
- `svo-adapter-service/README.md`
- `../ckan-docker/src/ckanext-dso_scheming/ckanext/dso_scheming/subside_dataset.yaml`
- `../../DSO-Architecture/docs/services/svo-adapter.md`
- This design spec

The CKAN schema source is in the separate, mode-dirty `ckan-docker` worktree. The existing mode-only changes were preserved. The content change moves `spatial` to dataset fields and `mint_standard_variables` to resource fields; deploying that schema remains separate from the completed live metadata repair.

## API/schema changes

- The existing `POST /admin/sync-from-ckan` response gains a `deleted` count; no endpoint is added or removed.
- `CkanSyncResult` gains the same deletion count.
- CKAN sync changes from additive nested inserts to authoritative per-resource reconciliation for IDs owned by the CKAN importer (`ckan-<resource-id>`).
- No database migration is required; existing child rows are replaced transactionally through Hasura.
- CKAN metadata changes use existing `package_patch` and `resource_patch` actions.
- The `subside_dataset` CKAN form schema moves `spatial` to dataset fields and `mint_standard_variables` to resource fields.

## Data flow

Live CKAN snapshot + live MINT label validation + inspected Capitan file evidence → deterministic dry-run manifest → approved CKAN package/resource patches → CKAN read-back. The remaining rollout is adapter/schema deployment → adapter dry-run → approved adapter apply → Hasura read-back and repeat-sync idempotency check.

## Risks and tradeoffs

- Moving reviewed annotations to model archives increases archive-level discoverability without asserting that reports, grids, or geodatabases provide the same variables.
- A CKAN resource can contain multiple scientific arrays; comma-separated annotations are used only when those arrays were directly verified.
- Replacing child rows changes their generated row IDs. No code treats those child IDs as stable identifiers; their parent/resource and standard-variable contract are the durable identity.
- Deleting untagged CKAN-owned data objects is necessary to remove stale discovery results, but must remain scoped to the exact fetched CKAN resource IDs.
- A single archive can expose several variables. This is intentional: the archive is a model-input bundle rather than a single-variable analytical product.
- Promoted polygons are accepted only when all non-empty spatial values in the target dataset are identical and match the pinned coordinates.
- The live repair writes canonical CKAN package `spatial` extras directly. The form-schema correction still needs deployment so future UI edits preserve the same placement.

## Alternatives considered

- Copy all nine package lists to every resource: rejected because only model archives, not reports, landing pages, grids, or geodatabases, represent the complete model bundle.
- Add a database unique constraint: rejected for this correction because existing duplicates would require a production data migration and scoped transactional replacement is simpler.
- Keep semantically empty adapter objects for unmapped tags: rejected because they cannot support variable discovery and hide metadata defects.
- Tag MODFLOW package/control files with package names: rejected because file types are not scientific variables.

## Test plan

- Unit-test every new variable and format mapping.
- Verify all-unmapped resources are skipped with warnings.
- Verify the Hasura mutation deletes old variable children and reinserts current children in one operation.
- Verify untagged CKAN resources delete only their `ckan-<resource-id>` object.
- Test exact live identities, expected-before drift detection, dry-run payload generation, and no writes by default.
- Run focused SVO adapter tests, Python compilation, and `git diff --check`.
- Before CKAN writes, verify the manifest against a fresh live snapshot and require zero drift.
- After writes, verify exact package/resource values and preservation of NTGAM metadata.
- Run adapter sync dry-run before any adapter database write; then verify two applied syncs produce identical semantic row counts.

## Documentation plan

The runbook and service documentation now record authoritative reconciliation, removed-tag behavior, model-vs-shapefile ZIP handling, dataset-level spatial placement, live correction counts, and the reviewed-but-intentionally-untagged archive policy.

## Rollout/rollback plan

Complete before/after CKAN package snapshots, rollback values, and per-action logs were written under `/tmp/ckan-svo-placement-2026-09-20`. CKAN rollback uses `package_patch`/`resource_patch`; no resources or packages were deleted. Adapter rollback is a code rollback followed by an explicitly approved re-sync; CKAN-owned adapter objects can be rebuilt from CKAN. Credentials are not present in the artifacts or logs.

## Open questions

- Deploy the local `subside_dataset` schema correction and SVO adapter changes through their normal repositories.
- After adapter deployment, run scoped dry-run/apply synchronization and verify repeated-sync row counts.
- Additional variables inside LPF (specific storage/yield) remain unannotated until exact catalog terms are agreed.
- Other GAM archives without reviewed variable evidence remain untagged and may later be characterized or extracted.

## Decisions

### 2026-09-19 — Correct resources, not archives (superseded)

- **Decision:** Initially, annotate only directly interpretable resources and remove package-level/archive-level assertions.
- **Reason:** MINT dataset discovery treats a resource annotation as evidence that the resource satisfies the variable.
- **Alternatives rejected:** Copying package lists to every archive, geodatabase, grid, and report.
- **User feedback:** The user approved the proposed evidence-based correction sequence with “ok lets fix them”.
- **Impact on implementation:** Superseded by the user clarification below. Reports and control files remain untagged, but reviewed model-archive variable lists are retained at resource level.

### 2026-09-19 — Spatial belongs to datasets; model archives carry reviewed SVOs

- **Decision:** Promote identical resource polygons to their parent datasets, clear resource-level polygon copies, and attach each previously reviewed GAM variable list to the corresponding model archive resource.
- **Reason:** Spatial coverage describes the GAM dataset as a whole, while `mint_standard_variables` must be on the downloadable resource for CKAN-to-MINT synchronization. A model archive is itself a useful multi-variable resource.
- **Alternatives rejected:** Keeping duplicate polygons on resources; restoring SVOs at package level; tagging reports, landing pages, grids, or geodatabases with the model bundle's variables.
- **User feedback:** “Spatial should be at the dataset level not the data resource. And model archives ZIPs should have SVO's attached as well.”
- **Impact on implementation:** The reconciliation manifest gains drift-pinned spatial promotion and model-archive annotation actions. ZIP classification is corrected so ordinary model ZIPs are not imported as shapefile archives.

### 2026-09-19 — Transactional sync reconciliation without migration

- **Decision:** Replace variable children transactionally per CKAN resource and delete stale CKAN-owned objects for untagged resources.
- **Reason:** This makes repeated sync idempotent and propagates removals without a risky production uniqueness migration.
- **Alternatives rejected:** Additive nested inserts; a production de-duplication/unique-constraint migration in this batch.
- **User feedback:** This implements the sync-safety step presented immediately before the user's approval.
- **Impact on implementation:** CKAN becomes authoritative for the semantic rows of `ckan-<resource-id>` objects.

### 2026-09-19 — Preserve unrelated repositories and working datasets (partially superseded)

- **Decision:** Initially, do not edit the mode-dirty `ckan-docker` worktree and do not mutate the two working NTGAM packages.
- **Reason:** Both are outside the minimum safe correction set and provide rollback/comparison baselines.
- **Alternatives rejected:** Mixing a CKAN image/schema deployment into this production metadata repair.
- **Impact on implementation:** NTGAM preservation remains in force. The no-edit portion is superseded below because the user clarified the required field placement and the schema defect blocked it.

### 2026-09-20 — Use canonical package extras and correct the form schema

- **Decision:** Store live spatial metadata as CKAN package `spatial` extras, clear resource copies only after package read-back, and correct the local `subside_dataset` schema for future edits.
- **Reason:** The deployed schema silently ignored a top-level `spatial` patch because it declared the field under resources. CKAN's canonical package extra provides the correct live storage without waiting for image deployment.
- **Alternatives rejected:** Clearing resource polygons before successful package storage; leaving the form schema reversed; bypassing read-back after writes.
- **User feedback:** The user said spatial belongs at dataset level and then explicitly asked to continue after the gated write paused.
- **Impact on implementation:** The live correction completed safely; the schema file now places `spatial` under `dataset_fields` and `mint_standard_variables` under `resource_fields`, with deployment still pending.

### 2026-09-20 — Keep model archives distinct from shapefile ZIPs

- **Decision:** Normalize ZIP/ZIPX/7Z model bundles to `zip` and use `shapefile-zip` only for resources explicitly identified as shapefiles.
- **Reason:** A MODFLOW model bundle is a direct model input, not a GIS interchange archive.
- **Alternatives rejected:** Treating every `.zip` URL as a shapefile; using the same adapter format for model and GIS archives.
- **User feedback:** “shapefile zips should be different than modflow zips which the model should directly handle.”
- **Impact on implementation:** `_adapter_format` now checks explicit shapefile evidence, model-archive tests cover ZIP/ZIPX/7Z, and reviewed model archives remain consumable as `zip`.

## User feedback / decisions

- 2026-09-19: The user asked to resume Claude's CKAN SVO correction plan.
- 2026-09-19: After receiving the proposed sequence—sync safety, a reviewed CKAN manifest, approved patching, read-back, and adapter sync—the user responded “ok lets fix them”, approving implementation and the scoped external correction workflow subject to the documented dry-run gate.
- 2026-09-19: The user corrected the metadata placement: spatial belongs at dataset level and model archives should retain SVO annotations. This supersedes the earlier archive-untagged decision while leaving report/control-file cleanup intact.
- 2026-09-20: The user clarified that shapefile ZIPs and MODFLOW model ZIPs require different adapter formats.
- 2026-09-20: After a safety gate paused network access, the user said “continue”; the live reconciliation then completed with 73/73 actions applied and zero drift.
