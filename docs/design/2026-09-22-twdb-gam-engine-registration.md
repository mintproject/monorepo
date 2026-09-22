# Exact MODFLOW engine registration for the TWDB GAM organization

Status: In Review

## Objective

Create an evidence-backed adjudication and registration plan for all 36
packages currently in the CKAN `twdb-gams` organization. Classify every package
and associate each executable model archive with the exact MODFLOW-family
engine/version it uses. Make confirmed MINT model/archive contracts
discoverable and update CKAN annotations without guessing from filenames or
titles.

## User need

**Primary user:** A groundwater modeler or facilitator using Problem
Formulation to select a runnable TWDB model archive.

**Secondary users:** CKAN catalog maintainers, MINT catalog maintainers, and
SVO Adapter operators.

**Job-to-be-done:** Select a TWDB model package and have the system offer the
correct engine-compatible archive and input/output contracts.

**Current pain:** The organization contains 36 packages, while the current
reconciliation allowlist covers 32 primary archives and the current archive
SVO migration recognizes only four version labels. Several live records
explicitly identify MODFLOW-NWT, MODFLOW-USG, or GWSIM, and one package has
multiple model releases.

**Definition of success:** All 36 packages have a reviewed classification and
engine evidence result. Every executable archive has an exact
engine-compatible MINT/CKAN contract or an explicit blocked status, and the UI
does not offer an archive that is incompatible with the selected model
configuration. CKAN and MINT writes are read back and the reconciliation is
idempotent. Success does not require treating non-executable packages as
runnable models.

## Current code/system summary

- The live `twdb-gams` organization snapshot contains 36 packages and 33
  resources with `resource_type=model_archive`; the counts are not
  interchangeable.
- The existing fixed metadata manifest contains 32 primary archive rows.
- `seymour-and-blaine-gam` contains two model archives: a MODFLOW-2000
  archive and a v2.01 MODFLOW 6 archive.
- Four packages are ancillary, superseded, or output/support collections and
  do not currently expose a primary model archive resource.
- The local MINT migration adds version-specific archive labels for MODFLOW 6,
  MODFLOW-2000, MODFLOW-2005, and MODFLOW-96.
- The CKAN reconciler currently derives archive labels only from explicit
  `modflow_variant` package extras and therefore cannot classify every live
  package.
- The SVO Adapter consumes resource-level `mint_standard_variables` and must
  preserve contained scientific-variable annotations alongside archive labels.

## Proposed design

1. Snapshot all 36 live packages and resolve every model/archive resource by
   immutable package ID, resource ID, title, URL, and parentage.
2. Build a 36-row package adjudication matrix plus a resource-level engine
   matrix for all 33 `model_archive` resources. Each package row is classified
   as `register`, `hold`, `historical`, `derived`, `alternative/research`, or
   `not_executable`. Evidence precedence is: archive member/file evidence,
   official TWDB model page or report, then existing curator-reviewed CKAN
   metadata. Title and URL heuristics may identify a candidate but cannot
   authorize a write.

   The read-only matrix is materialized at
   [`2026-09-22-twdb-gam-engine-evidence-matrix.json`](./2026-09-22-twdb-gam-engine-evidence-matrix.json)
   and can be regenerated from a fresh CKAN snapshot with
   `svo-adapter-service/scripts/build_twdb_gam_engine_evidence_matrix.py`.
   A Tapis `cloud.data.exec` tree and remote archive-member inspection resolved
   all twelve previously unresolved resources. The last four were resolved by
   finding `mfusg-beta.exe` in the Brazos archive, `USGs_lrgv.exe` in the Lower
   Rio Grande Valley archive, and by confirming MODFLOW-2000 in the official
   Kinney and Seymour Haskell/Knox/Baylor reports.
3. Record resource-specific overrides where one package contains multiple
   releases. In particular, keep Seymour/Blaine v1.01 MODFLOW-2000 separate
   from v2.01 MODFLOW 6.
4. Extend the controlled archive vocabulary and MINT model/configuration
   contracts only for engines that are confirmed in the evidence matrix and
   absent from the current catalog. Do not silently map MODFLOW-NWT,
   MODFLOW-USG, or GWSIM to a different engine.
5. Extend CKAN reconciliation to apply the exact archive label to the exact
   resource, preserving the reviewed contained-variable labels. Packages with
   no executable archive receive a package-level review result but no fabricated
   resource archive annotation.
6. Produce a dry-run containing before/after values, evidence URLs, target
   IDs, unresolved conflicts, and rollback data. Apply MINT and CKAN writes in
   separate explicitly approved phases.
7. Read back MINT registrations and CKAN resources, rerun the dry-run, and
   require zero drift before considering the work complete.

## Files likely affected

- `graphql_engine/migrations/` and `graphql_engine/fixtures/modelcatalog.sql`
  for controlled MINT archive variables and configuration links
- `svo-adapter-service/scripts/reconcile_ckan_svos.py`
- `svo-adapter-service/scripts/twdb_gam_metadata_manifest.json` or a new
  engine evidence manifest beside it
- `svo-adapter-service/tests/test_ckan_svo_reconciliation.py`
- `svo-adapter-service/tests/test_ckan_sync_boundaries.py`
- `svo-adapter-service/app/ckan_sync.py`
- `ui-react/src/lib/datasets/__tests__/ckan.test.ts` and related model-picker
  tests if matching contracts change
- `docs/runbook-ckan-svo-dataset-registration.md`
- this design spec

## API/schema changes

No relational schema change is proposed. The MINT catalog may gain controlled
standard-variable rows and model/configuration/presentation relationships for
confirmed engines. CKAN changes are field-scoped resource/package metadata
updates. Any MINT API registration or CKAN mutation remains external and
approval-gated.

## Data flow

```text
Live CKAN organization
  -> exact package/resource inventory
  -> TWDB page/report/archive evidence
  -> 36-row package adjudication and resource engine matrices
  -> MINT engine/archive contract plan
  -> CKAN resource annotation plan
  -> approved MINT writes
  -> approved CKAN writes
  -> read-back and zero-drift verification
```

## Risks and tradeoffs

- The package count and executable-resource count differ; treating every
  package as an archive would create false resource metadata.
- MODFLOW-NWT is related to the MODFLOW family but is not interchangeable with
  MODFLOW-2005. MODFLOW-USG and GWSIM likewise require distinct contracts if
  exact execution is the goal.
- MINT registrations may require API-level writes beyond the local SQL
  migration/fixture path and need separate provenance and rollback records.
- Large archives may be impractical to download; official report/page evidence
  must be sufficient where archive inspection is not required.
- Concurrent CKAN edits can invalidate a plan; each write must include an
  expected-before fingerprint and stop on drift.

## Alternatives considered

- Force every package into MODFLOW 6/96/2000/2005: rejected because the live
  catalog explicitly identifies NWT, USG, and GWSIM cases.
- Infer engines from model titles, dates, or archive extensions: rejected
  because those signals are not execution contracts.
- Update only the existing 32-row manifest: rejected because the live
  organization contains an additional model archive and four packages outside
  that allowlist.
- Treat all 36 packages as executable archives: rejected because outputs,
  planning documents, and superseded landing pages do not provide executable
  model inputs.

## Test plan

- Assert exact 36-package inventory coverage and classify every package as
  executable archive, multi-release package, or ancillary/support package.
- Assert one engine evidence result per executable archive, with unresolved
  evidence causing a dry-run failure rather than a guessed label.
- Assert Seymour resources receive distinct engine labels.
- Assert CKAN reconciliation preserves all existing contained-variable labels,
  stable IDs, URLs, names, formats, and unrelated resources.
- Assert MINT archive labels and model/configuration relationships are
  internally consistent and idempotent.
- Run focused Python, GraphQL/catalog, Adapter, and UI tests plus a fresh
  CKAN/MINT dry-run and read-back verification.

## Documentation plan

Update the CKAN reconciliation runbook and Adapter documentation with the
36-package inventory, evidence precedence, exact-engine policy, multi-release
handling, and blocked-status behavior.

## Rollout/rollback plan

First publish a read-only evidence matrix and dry-run. Apply approved local
catalog changes, then approved MINT registrations, then approved CKAN
resource/package patches. Save before-state snapshots and target fingerprints.
Rollback restores only changed MINT relationships and CKAN fields when the
post-write fingerprints still match; otherwise stop for review.

## Open questions

- Which confirmed engines are not yet represented in MINT and therefore need
  new model/configuration registrations rather than only CKAN SVO labels?
- Should a package with no executable archive remain visible as historical or
  derived catalog context, or be excluded from the model-picker entirely?

## Decisions

### 2026-09-22 — Use exact-engine registration

- **Decision:** Do not force a known NWT, USG, or GWSIM archive into a different
  MODFLOW label.
- **Reason:** The user approved the exact-engine path by responding “do it” to
  the recommendation to use exact engine registration and add missing MINT
  support rather than falsify compatibility.
- **Impact:** The implementation must either register the missing engines in
  MINT or report them as blocked; it may not silently substitute a label.

### 2026-09-22 — Adjudicate before promising 36 runnable registrations

- **Decision:** Treat 36 as the complete organization scope, but require a
  package/resource adjudication before claiming that all 36 are executable
  model registrations.
- **Reason:** Review found 33 model-archive resources, four ancillary or
  historical/support packages, and multiple engine families that are not
  interchangeable.
- **Alternatives rejected:** Blindly force every package into one of four
  engine labels; rejected because it would create false execution contracts.
- **User feedback:** The user asked to proceed with exact registration; no
  approval was given to misclassify unsupported or non-executable packages.
- **Impact on implementation:** Dry-run summaries must report register, hold,
  and excluded counts, and unknown or conflicting rows must fail closed.

### 2026-09-22 — Apply exact archive labels to supported CKAN resources

- **Decision:** Update only the resource-level `mint_standard_variables` field
  for the 21 evidence-backed resources whose engines already have exact MINT
  archive vocabulary entries.
- **Result:** Each target now contains its exact
  `groundwater_model_modflow<version>_simulation_archive` label while retaining
  its existing scientific-variable labels. The 12 held resources were not
  changed.
- **Verification:** The live CKAN API read back all 21 target values exactly;
  the 12 held resources were verified unchanged. The before-state snapshot and
  rollback values are recorded in the dry-run/apply audit artifacts.

### 2026-09-22 — Materialize the first evidence matrix

- **Decision:** Store a snapshot-pinned JSON matrix with one row for every live
  package and one row for every live `model_archive` resource.
- **Result:** The first pass covers 36 packages and 33 archive resources. It
  identifies 13 resources eligible for the four existing exact archive SVOs,
  6 confirmed resources blocked on a distinct MINT contract, 2 candidate
  resources requiring release confirmation, and 10 resources with unresolved
  engine evidence. The package-level result is 11 `register`, 18 `hold`, 3
  `alternative/research`, 2 `derived`, 1 `historical`, and 1 `not_executable`.
- **Safety rule:** The matrix is read-only planning data. It does not write
  CKAN or MINT, and unresolved/candidate rows receive no target archive SVO.

### 2026-09-22 — Use the existing Tapis model tree for archive adjudication

- **Decision:** Inspect the existing `cloud.data.exec` tree under
  `/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/` instead of downloading
  the twelve large CKAN archives.
- **Result:** All twelve resources now have high-confidence evidence. Northern
  Carrizo-Wilcox is MODFLOW 6; Hueco, Mesilla, and Igneous/West Texas Bolsons
  are MODFLOW-96; Llano, Brazos, and Lower Rio Grande Valley are MODFLOW-USG;
  Presidio/Redford, Red Light/Green River/Eagle Flat, Kinney County, and
  Seymour Haskell/Knox/Baylor are MODFLOW-2000; and Rustler is MODFLOW-NWT.
- **Impact:** The matrix is now version `2026-09-22.3`: 21 resources are
  registerable under existing exact-engine contracts, 12 remain on hold, and
  the unresolved-engine count is zero. Rustler and the USG resources remain
  held because their distinct MINT contracts are not yet registered.
- **Safety rule:** Only metadata, small text evidence, and archive-directory
  tails were read remotely; no model archive was downloaded in full or
  modified.

## User feedback / decisions

- 2026-09-22: User clarified that the complete CKAN organization scope is 36
  models/packages and requested exact registration work proceed.
- 2026-09-22: User responded “do it” to the exact-engine recommendation.
