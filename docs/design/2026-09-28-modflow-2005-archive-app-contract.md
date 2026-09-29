# MODFLOW 2005 archive-first Tapis app contract

**Status:** Implemented

## Objective

Replace the legacy MODFLOW 2005 Tapis app contract with a versioned,
archive-first application that matches the MINT catalog and the newer
MODFLOW application structure.

## User need

Problem-formulation runs currently select a catalog contract containing a
complete MODFLOW 2005 simulation archive plus semantic WEL/RCH inputs, while
the live `modflow-2005/0.0.6` app still requires nine unrelated package files.
That mismatch causes job submission failures and makes the old app difficult to
reuse for CKAN-backed model data.

## Current code/system summary

- The catalog contract has been narrowed to a MODFLOW 2005 simulation archive
  and WEL/RCH package inputs.
- The live `modflow-2005/0.0.6` app uses the old cookbook image and declares
  BAS, DIS, BCF, OC, WEL, DRN, RCH, HFB, and SIP as required file inputs.
- The maintained `modflow-executables` repository contains archive-first apps
  for MODFLOW 6, USG, 2000, and 96, but no MODFLOW 2005 app.
- `TapisJobService` has semantic input matching only for `mf6-*` names, so a
  future MODFLOW 2005 manifest would not bind catalog archive/WEL/RCH rows.

## Proposed design

1. Add a dedicated `modflow-executables/modflow-2005` application using the
   official MODFLOW-2005 1.12.00 executable distribution. It will declare:

   - required `mf2005-simulation-archive` at `simulation.zip`;
   - optional `mf2005-wel` at `provided/model.wel`;
   - optional `mf2005-rch` at `provided/model.rch`.

2. Reuse the established archive safety and staging behavior, but make the
   MODFLOW 2005 runner deterministic:

   - unpack the complete archive before applying overrides;
   - select a single explicit or unambiguous classic `.nam` file;
   - run from the name file's directory and pass the name file explicitly;
   - rewrite only the WEL/RCH records when an override is supplied;
   - preserve archive files when no override is supplied;
   - reject unsafe archive paths and ambiguous name-file selection.

3. Add MODFLOW 2005 metadata and a generated component descriptor to the
   executable repository. The descriptor will use `cbc-mf2005` for the
   version-specific cell-budget output contract.

4. Extend `TapisJobService` with an explicit MODFLOW 2005 semantic mapping for
   the exact `mf2005-simulation-archive`, `mf2005-wel`, and `mf2005-rch` app
   input names. The matching rules will recognize the existing catalog IDs,
   names, and formats without changing MF6 behavior.

5. Add network-free runtime, registration, and job-binding tests. The existing
   `modflow-2005/0.0.6` app and its catalog location remain unchanged until a
   new image has been built and a read-only Tapis check confirms the new app.

6. Stage, but do not apply, the catalog component-location migration until the
   new Tapis app is registered. This prevents a local service restart from
   advertising an app version that does not yet exist.

## Files likely affected

- `modflow-executables/modflow-2005/app.json`
- `modflow-executables/modflow-2005/Dockerfile`
- `modflow-executables/modflow-2005/run.sh`
- `modflow-executables/modflow-2005/resolve_nam.py`
- `modflow-executables/modflow-2005/modflow.py`
- `modflow-executables/modflow-2005/validate_archive.py`
- `modflow-executables/scripts/models_metadata.json`
- `modflow-executables/scripts/register_to_mint.py`
- `modflow-executables/scripts/check_apps.py`
- `modflow-executables/scripts/test_app_runtime.py`
- `modflow-executables/scripts/test_register_to_mint.py`
- `modflow-executables/scripts/components/modflow-2005.json`
- `monorepo/mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts`
- `monorepo/mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts`
- a later catalog migration that repoints `modflow_2005_cfg` after app
  registration

## API/schema changes

No service API or database schema changes are required. The Tapis application
contract gains a new app ID/version. The catalog component location will be
updated in a separate rollout step after the app is registered.

## Data flow

```text
MINT archive / WEL / RCH inputs
              |
              v
  TapisJobService semantic binding
              |
              v
  modflow-2005-simulation job
              |
              v
  validate + extract archive -> apply overrides -> resolve .nam
              |
              v
             mf2005
              |
              v
    archive outputs (cbb, hds, ddn, lst)
```

## Risks and tradeoffs

- The official MODFLOW-2005 executable is old; the image must record its
  release and build provenance before remote registration.
- WEL/RCH overrides are only meaningful when the archive name file contains
  the corresponding package records. The runner will not silently invent a
  missing package.
- The app manifest will be versioned separately from the legacy app so rollback
  remains a Tapis app-version choice.
- Archive URLs and remote registration are not changed by local tests.

## Alternatives considered

- Reusing `modflow-2000` was rejected because MODFLOW 2000 and MODFLOW 2005
  are different engines, executables, output contracts, and catalog families.
- Mutating `modflow-2005/0.0.6` was rejected because it would remove a rollback
  target and make existing jobs depend on a changed input contract.
- Keeping nine individual required package inputs was rejected because it
  duplicates the complete archive and conflicts with the current catalog.

## Test plan

- Parse the new manifest and verify archive/WEL/RCH requiredness and target
  paths.
- Run the local synthetic archive harness with a fake `mf2005` executable.
- Test archive-only, WEL override, RCH override, both overrides, nested roots,
  ambiguous `.nam` files, and unsafe archives.
- Verify generated component descriptor parity with the manifest.
- Verify semantic MODFLOW 2005 archive/WEL/RCH binding and regression coverage
  for existing MF6 bindings.
- Run read-only Tapis app inspection after an image is available; do not submit
  a remote model job in this implementation step.

## Documentation plan

Document the new app's archive layout, override precedence, binary provenance,
local runtime test command, and staged remote-registration procedure in the
app README and executable-repository design notes.

## Rollout/rollback plan

1. Build and test the new image locally/through CI.
2. Register a new Tapis app ID/version while preserving `modflow-2005/0.0.6`.
3. Run a read-only descriptor check and an explicitly approved smoke job.
4. Apply the catalog component-location migration only after the smoke job
   succeeds.
5. Roll back by restoring the prior catalog location or selecting the legacy
   app; do not retag or delete images.

## Open questions

- The final immutable image digest and Tapis app version are determined by the
  build commit; the local descriptor uses the current executable-repository
  revision as its release candidate.
- The output-handoff layer still needs a successful remote run before its CBB
  file matching can be confirmed against the actual Barton Springs archive.

## Decisions

- User explicitly approved implementation with “ok do it.”
- Use a dedicated MODFLOW 2005 app and retain the legacy app for rollback.
- Keep the catalog repointing staged until the replacement Tapis app exists.
- Keep transforms modular: model execution produces files, then SVO/ETL steps
  consume the declared outputs.
- Do not synthesize a MODFLOW-2005 name file from loose package files; the
  archive must provide an explicit name-file execution contract.
- Do not invent WEL/RCH records for overrides; supplied packages must replace
  records already declared by the selected name file.

## User feedback / decisions

- The user asked whether the old MODFLOW 2005 app aligns with the newer apps;
  the implementation addresses the identified structural mismatch.
- The user wants the model path inside the SVO-owned workflow, so this change
  fixes the provider app contract rather than adding an external ETL discovery
  workaround.

- QA identified two contract violations in the first implementation: archives
  without a name file were being synthesized, and an override could append a
  missing WEL/RCH package record. The resolver now rejects both cases, with
  focused regression tests.

## Implementation status

The local implementation is complete and verified with network-free runtime,
registration dry-run, and ensemble-manager binding tests. Remote image build,
Tapis app registration, read-only inspection, smoke execution, and catalog
component repointing remain a separately gated rollout step because the final
immutable image digest is produced by CI.
