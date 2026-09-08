# Texas GMA/GAM MINT Capabilities and Objective Plan-or-Reuse

## Status

Implementing

## Objective

Represent all Texas GMA/GAM model capabilities in MINT and extend the SVO Adapter so a DFC objective can prefer a scientifically suitable previous model run/result, or plan a new model run when no suitable run is already registered.

The desired planning behavior is:

```text
DFC objective
→ find matching prior run/result if available
→ otherwise find runnable GAM capability in MINT
→ run/register outputs if approved
→ transform/evaluate against DFC targets
```

No CKAN, Tapis, or database writes should occur without explicit approval. All external-write workflows must support dry-run or manifest review first.

### Goals

- Make MINT the source of truth for Texas GAM/GMA model capabilities.
- Let the adapter classify an objective as reusable, runnable, or blocked by missing metadata.
- Prefer equivalent previous model runs/results before planning a new run.
- Make all write paths explicit, dry-runnable, and approval-gated.
- Start with an NTGAM pilot, then expand to the full Texas GAM/GMA inventory once confirmed.

### Non-goals

- Do not publish new CKAN resources by default.
- Do not automatically submit Tapis runs from a read-only readiness check.
- Do not move transform registry logic into CKAN.
- Do not hardcode all GAM/GMA mappings in the UI.
- Do not claim all GMAs are supported until their MINT capability records and mapping metadata exist.

## User need

Primary user:

- A groundwater decision-support user, modeler, or GMA analyst evaluating adopted DFCs for a selected GMA/aquifer/year.

Job to be done:

- Determine whether a modeled GAM result indicates the selected DFC objective is expected to be met, using an auditable model run/result.

Current pain:

- The current working DFC path depends on one valid precomputed NTGAM GeoTIFF and UI/backend special cases. It does not yet discover all GAM capabilities from MINT, reuse previous runs safely, or report missing model/app/input metadata in a structured way.

Definition of success:

- Given a DFC objective, the adapter returns one of:
  - a suitable previous run/result to reuse,
  - a dry-run plan for a new model run plus DFC evaluation,
  - or a precise missing-requirements report explaining what MINT/Tapis/metadata is incomplete.

A user should be able to ask:

```text
I am in GMA X / aquifer Y / target year Z. Are we expected to meet the DFCs based on the model?
```

The system should not depend on one precomputed demo GeoTIFF. It should discover whether MINT already has a completed suitable model execution. If it does, recommend/reuse it. If not, it should determine whether MINT has the GAM files and runnable MODFLOW app needed to produce the output, then create a dry-run plan for the new run. Live submission remains a separate approval-gated action.

### Phased scope boundary

Phase 1 acceptance target is **NTGAM pilot support**, not all GMAs. It is complete when an NTGAM DFC objective can return a structured readiness/plan-or-reuse decision using MINT capability metadata.

Phase 2 expands to the authoritative Texas GAM/GMA inventory after the model archive list, engine/version mapping, and metadata conventions are confirmed.

Approval of this Phase 1 design authorizes only NTGAM pilot implementation planning. Phase 2 requires a later inventory manifest and batch approval before registering additional GAM/GMA setups.

The phrase “all GMAs” means every adopted-DFC-relevant GMA/GAM combination for which TWDB/GAM source archives and runnable engines are available and registered in MINT. It does not mean unsupported or unavailable models are silently treated as supported.

## Current code/system summary

Current SVO Adapter state:

- `examples/dfc_objectives.json` defines a draft DFC objective, currently `dfc-gma12-carrizo-drawdown-2070`.
- `GET /objectives`, `GET /objectives/{objective_id}`, and `POST /objectives/{objective_id}/evaluate-plan` load objective JSON and create a DFC fan-out plan from an existing modeled output.
- The DFC UI now loads objective specs and calls objective-based planning when the selected context matches.
- `examples/gma_dfc_transforms.json` remains adapter transform logic and should not be moved to CKAN as a runtime dependency.
- `app/mint_sync.py` can map MINT `modelcatalog_configuration` rows into `adapter_transform_spec` rows.

Current local MINT findings from read-only queries after starting the local stack:

- MINT has generic MODFLOW software/configurations for MODFLOW 6, MODFLOW-USG, MODFLOW-2000, and MODFLOW-96.
- These generic configs include useful input/output contracts. Example outputs include HDS/head, CBC/budget, LST, and sometimes observation/drawdown outputs.
- Relevant `tapis_app_id` and `tapis_app_version` fields are currently `null`.
- There is no `ntgam`-named `modelcatalog_configuration` row.
- A resource row exists for the NTGAM archive:
  `https://gw-models.s3.amazonaws.com/Download_GAMs/trnt_n/trnt_n_v301/NTGAM_Final_model_2025.7z`.
- That NTGAM archive is bound only through old `execution_data_binding` rows to `modflow6_input_simulation-archive`, not as a reusable fixed input.
- `model_input_fixed_binding` currently has count `0`.
- Regional setup configs exist, e.g. Carrizo-Wilcox central, Yegua-Jackson, Trinity Hill Country, but currently have `inputs: 0` and `outputs: 0`.
- No machine-readable GMA/aquifer/layer/time mapping was found.
- Startup issues were observed: Redis not responding, Hasura metadata apply warnings, and Ensemble Manager not healthy. Hasura and model-catalog-api were queryable enough for catalog inspection.

## Proposed design

### 1. Treat MINT as the model/app capability source of truth

All Texas GAM/GMA model capabilities should be represented in MINT, not as UI hardcoding and not as adapter-only model registries. MINT should contain enough metadata to answer:

- Which GAM/model setup covers this GMA/aquifer?
- Which MODFLOW engine/version runs it?
- Which model input archive/resource is required?
- Which outputs can it produce?
- Which Tapis app/version runs it?

The adapter should project this catalog metadata into planning contracts via MINT sync.

### 2. Register all GAM/GMA setups

Create or repair MINT entries for all relevant Texas GAMs, with NTGAM as the first pilot. Each setup should include:

- stable model/setup ID
- human label and description
- GMA coverage
- aquifer coverage
- MODFLOW engine/version
- model archive/input resource
- input DatasetSpecifications or inherited generic MODFLOW inputs
- output DatasetSpecifications for HDS/CBC/etc.
- Tapis app ID/version when runnable
- metadata needed for objective matching

Registration should be driven by a manifest, not ad hoc writes. Proposed manifest path:

```text
svo-adapter-service/examples/gam_capability_manifest.ntgam.dry-run.json
```

or a generated artifact under:

```text
svo-adapter-service/tmp/gam-capability-manifests/
```

The manifest must show all MINT rows, fixed bindings, and metadata mappings that would be written before any write occurs.

### 3. Use reusable model input bindings

Move model archive knowledge out of old executions into reusable model input bindings.

For example, for NTGAM:

```text
model_input_fixed_binding:
  model_io_id: <simulation archive input>
  resource_id: <NTGAM archive resource>
```

This allows the adapter to know the model setup has the input package even before a new execution exists.

### 4. Add GMA/aquifer/layer/time metadata

DFC objectives need mapping metadata that is not currently discoverable from generic MODFLOW configs:

```json
{
  "model_setup_id": "ntgam-v301",
  "gma_id": "GMA 12",
  "aquifer": "Carrizo",
  "layers": [8],
  "layer_names": ["Hosston"],
  "time_index": [
    {"year": 2019, "stress_period": 132}
  ]
}
```

Preferred location is MINT if an existing schema field can hold this cleanly. If not, add an adapter-owned capability metadata table or JSON resource with stable references to MINT IDs.

Fallback adapter-owned schema if MINT does not have a suitable metadata field:

```text
adapter_model_capability_metadata
  id text primary key
  model_configuration_id text not null
  setup_id text null
  gma_id text not null
  aquifer text not null
  model_layers jsonb not null
  time_index jsonb not null
  source_resource_id text null
  metadata_json jsonb not null default '{}'
```

This table would remain a projection/mapping layer and would not replace MINT as the source of truth for model/app capabilities.

### 5. Add adapter capability/readiness endpoint

Add a read-only endpoint, for example:

```text
POST /objectives/{objective_id}/readiness
```

It should report:

- objective selectors
- matching DFC target records
- matching MINT model setup(s)
- existing suitable run/results, if any
- whether a runnable app exists
- whether model input bindings exist
- whether aquifer/layer/time mapping exists
- missing requirements

This endpoint should not submit jobs or write data.

Request body:

```json
{
  "gma_id": "GMA 12",
  "aquifer": "Carrizo",
  "metric": "drawdown",
  "target_year": 2070,
  "prefer_existing_runs": true
}
```

If omitted, fields are read from the objective spec.

### 6. Add objective plan-or-reuse endpoint

Add:

```text
POST /objectives/{objective_id}/plan-or-reuse
```

Decision modes:

```text
reuse_existing
plan_from_existing_output
plan_new_model_run
missing_requirements
```

Request body:

```json
{
  "dry_run": true,
  "prefer_existing_runs": true,
  "allow_new_model_run": true,
  "allow_external_writes": false,
  "source_data_object_id": null
}
```

Rules:

- `dry_run: true` is the default.
- `allow_external_writes: false` is the default.
- If `allow_external_writes` is false, the endpoint must not submit Tapis jobs, register outputs, mutate MINT, or publish CKAN resources.
- Even if `allow_external_writes` is true, the service must require explicit user approval at the caller/workflow layer before Tapis/CKAN/MINT writes.

Reuse should match on a semantic key that includes:

- objective type/version
- GMA
- aquifer
- metric
- target year
- DFC target source/version
- model setup ID
- model input archive/resource ID/version
- layer(s)
- stress period/timestep/year
- output type/format
- transform registry version/hash if available

### 7. Register outputs and provenance after new runs

When a new run completes, the adapter should:

- retrieve output URIs from Tapis
- register HDS/CBC/derived outputs as adapter data objects
- bind output resources to MINT execution rows where appropriate
- attach objective/model/layer/time metadata
- record provenance events
- optionally publish final validated outputs/results to CKAN only after approval

## Files likely affected

Likely adapter files:

- `app/main.py` — new readiness and plan-or-reuse endpoints.
- `app/mint_sync.py` — improve MINT projection, warnings, Tapis app propagation, setup handling.
- `app/hasura.py` — new queries for model capabilities, executions, bindings, fixed inputs.
- `app/tapis.py` — model-run pipeline generation/reuse support if not already sufficient.
- `app/poller.py` — output registration/provenance metadata after completion.
- `examples/dfc_objectives.json` — objective references to model capability requirements.
- `static/js/main.js` — UI calls plan-or-reuse/readiness instead of direct evaluate-plan once stable.
- Tests under `tests/` for readiness, reuse, missing requirements, and output registration.

Likely MINT/catalog files:

- `graphql_engine/migrations/...` — only if new adapter mapping table or MINT metadata fields are required.
- `graphql_engine/metadata/tables.yaml` — Hasura metadata for any new table.
- `svo-adapter-service/scripts/` — new dry-run/registration manifest tooling if housed with adapter.
- `svo-adapter-service/examples/` or `svo-adapter-service/tmp/gam-capability-manifests/` — dry-run manifests for review.
- Existing external registration scripts under `ntgam/` if they become the preferred MINT registration entry point.

## API/schema changes

### Adapter API additions

Proposed read-only readiness endpoint:

```http
POST /objectives/{objective_id}/readiness
```

Response sketch:

```json
{
  "objective_id": "dfc-gma12-carrizo-drawdown-2070",
  "status": "ready_to_reuse | ready_to_run | missing_requirements",
  "matching_targets": 5,
  "existing_runs": [],
  "model_capabilities": [],
  "missing": ["tapis_app_id", "model_input_fixed_binding", "aquifer_layer_time_map"]
}
```

Error/missing-requirements response shape:

```json
{
  "objective_id": "...",
  "status": "missing_requirements",
  "missing": [
    {
      "code": "missing_tapis_app_id",
      "message": "MINT configuration has no tapis_app_id.",
      "owner": "mint_catalog_admin",
      "suggested_action": "Register or select the MODFLOW Tapis app and set modelcatalog_configuration.tapis_app_id."
    }
  ]
}
```

Proposed planning endpoint:

```http
POST /objectives/{objective_id}/plan-or-reuse
```

Response sketch:

```json
{
  "decision": "reuse_existing",
  "objective_id": "...",
  "run_id": "...",
  "output_data_object_id": "...",
  "suitability": {
    "score": 1.0,
    "matched_on": ["model_setup", "target_year", "layer", "source_archive"]
  }
}
```

or:

```json
{
  "decision": "plan_new_model_run",
  "objective_id": "...",
  "model_plan_id": "...",
  "dfc_plan_id": null,
  "requires_approval": ["tapis_submit"]
}
```

Additional response for missing requirements:

```json
{
  "decision": "missing_requirements",
  "objective_id": "...",
  "missing": [
    {"code": "missing_model_setup", "message": "No MINT setup matched GMA/aquifer."},
    {"code": "missing_aquifer_layer_time_map", "message": "No mapping for objective aquifer/year."}
  ],
  "writes_performed": []
}
```

### MINT/schema needs

Existing fields that should be used if available:

- `modelcatalog_configuration.tapis_app_id`
- `modelcatalog_configuration.tapis_app_version`
- `model_input_fixed_binding`
- `execution_data_binding`
- `resource`
- `execution`

Potential missing concept:

- model setup metadata for GMA/aquifer/layer/time mapping.

Before adding schema, inspect whether existing metadata JSON or relationship tables can store these mappings cleanly.

If schema is added, it should be adapter-scoped first unless MINT maintainers approve a more general catalog schema. This reduces risk while preserving stable references to MINT model configuration IDs.

### Operational approval gates

| Path | Read/write | Dry-run required | Explicit approval required |
|---|---:|---:|---:|
| `/objectives/{id}/readiness` | read-only | no | no |
| Generate GAM registration manifest | local file only | yes | no external approval, but user review required before writes |
| MINT GAM registration writes | DB/API write | yes | yes |
| `/admin/sync-from-mint` live | adapter DB write | yes | yes |
| `/objectives/{id}/plan-or-reuse` with `dry_run=true` | read/local plan only | yes/default | no external write approval |
| Tapis model-run submission | external Tapis write/run | yes | yes |
| Output registration/binding | adapter/MINT DB write | yes or preview | yes |
| CKAN result publication | CKAN write | yes | yes |

## Data flow

### Reuse path

```text
objective
→ select DFC target records
→ resolve required model variable/layer/time
→ query MINT executions/output bindings
→ rank suitable previous runs
→ return recommended run/result
→ optionally run DFC aggregation/compliance from existing output
```

### New-run path

```text
objective
→ select DFC targets
→ resolve GAM setup from MINT
→ verify fixed input binding and Tapis app ID
→ build model-run workflow
→ dry-run for approval
→ submit if approved
→ poll Tapis
→ register outputs/provenance
→ run DFC aggregation/compliance
```

### Missing-requirements path

```text
objective
→ capability search
→ no suitable previous run and no runnable setup
→ return exact missing requirements
```

## Risks and tradeoffs

- **Catalog incompleteness:** Current MINT has generic MODFLOW capabilities but not complete GAM setup metadata. Mitigate with inventory and dry-run registration manifest.
- **Incorrect engine binding:** The NTGAM archive is currently bound to MODFLOW 6 execution rows, but the DFC demo context also references MODFLOW-USG-style outputs. Verify actual engine/version before writing registrations.
- **Tapis app ID gaps:** `tapis_app_id` is currently null for relevant configs. Without app IDs, the adapter can identify capability but not run it remotely.
- **Previous-run equivalence:** Reusing a run is only safe if model/archive/layer/time/objective metadata match. Use conservative semantic keys and show suitability details.
- **Schema creep:** GMA/aquifer/layer/time metadata may not fit existing MINT tables. Prefer existing metadata patterns first; add schema only if necessary.
- **External writes:** MINT registration, Tapis runs, CKAN publishing, and output binding are external writes. Require dry-run and explicit approval.
- **Local stack health:** Redis/metadata/ensemble issues may block full end-to-end testing even when Hasura is queryable.

## Alternatives considered

1. **Keep all model capability metadata in SVO Adapter JSON.**
   - Rejected as the primary path because MINT should be the model/app source of truth.

2. **Require all model outputs to be precomputed and in CKAN.**
   - Rejected because the adapter should be able to run a registered model when output does not already exist.

3. **Always run new models, never reuse previous runs.**
   - Rejected because previous scientific runs should be recommended/reused when equivalent.

4. **Use historical executions as the only source of model input bindings.**
   - Rejected because old executions are not reusable catalog capabilities. Use fixed input bindings or setup metadata instead.

## Test plan

### Catalog/readiness tests

- Unit-test capability classification for:
  - no setup found
  - setup found but missing Tapis app ID
  - setup found but missing fixed input binding
  - setup found with prior suitable run
  - setup found and runnable but no prior run

Pass criteria:

- Readiness endpoint performs no writes.
- Each missing condition returns a stable `code`, human message, owner, and suggested action.
- NTGAM pilot readiness identifies current known missing items until catalog repair is performed.

### Planner tests

- Existing objective still produces five-area GMA 12 fan-out when using existing output.
- `plan-or-reuse` returns `reuse_existing` when a completed equivalent run/output is present.
- `plan-or-reuse` returns `plan_new_model_run` when no equivalent run exists but MINT has a runnable setup.
- `plan-or-reuse` returns `missing_requirements` with actionable missing fields when metadata is incomplete.

Pass criteria:

- `plan-or-reuse` never submits Tapis or mutates CKAN/MINT/adapter DB when `dry_run=true` and `allow_external_writes=false`.
- Reuse requires exact semantic key match unless a lower suitability score is explicitly shown.
- New-run planning returns a dry-run workflow plus required approval list.

### Integration tests

- Dry-run MINT registration manifest for NTGAM only.
- Dry-run `/admin/sync-from-mint` and verify projected transform specs.
- Dry-run Tapis workflow generation for a model run.
- Poller/output registration test with mocked Tapis detail.

Pass criteria:

- Dry-run registration manifest contains deterministic IDs and can be reviewed in diff form.
- Live sync only occurs after approval and produces expected adapter transform specs.
- Output registration records objective/model/layer/time provenance.

## Documentation plan

Update or add:

- SVO Adapter README section on objective planning and model capability discovery.
- `docs/ckan-vs-adapter-boundary.md` with MINT capability ownership.
- DSO Architecture docs if API endpoints, environment variables, ports, or startup behavior change.
- A catalog registration runbook for adding a new GAM/GMA setup.

## Rollout/rollback plan

### Rollout

1. Inventory all GAM/GMA model archives and target MINT rows.
2. Generate dry-run registration manifest for NTGAM pilot.
3. User reviews and approves MINT writes.
4. Register NTGAM pilot metadata and fixed input binding.
5. Sync MINT to adapter in dry-run, then live after approval.
6. Add readiness endpoint and verify missing/ready statuses.
7. Add plan-or-reuse endpoint.
8. Extend to remaining GAM/GMA setups in batches.

Each batch should have a manifest and acceptance checklist before writes.

### Rollback

- MINT writes should be idempotent and tagged by stable IDs plus a registration batch/version value where possible so pilot rows can be deleted or superseded.
- Adapter sync can be rerun after removing incorrect MINT rows.
- New endpoints are additive and can be disabled from UI by falling back to existing objective evaluate-plan.
- No CKAN resources should be published until final outputs are validated and approved.
- If fixed input bindings are wrong, remove the binding rows and rerun readiness before any model-run submission.

## Must resolve before implementation

1. Authoritative pilot scope: exact NTGAM model archive, engine/version, and target MINT setup ID.
2. Tapis app IDs/versions for whichever MODFLOW engine is used in the pilot.
3. Whether setup-specific configs should duplicate I/O contracts or reference generic MODFLOW configs.
4. Storage location for GMA/aquifer/layer/time mapping.
5. Exact previous-run suitability key for the pilot.
6. Confirmation that `plan-or-reuse` does not automatically submit jobs in its initial implementation.

## Open questions

1. What is the authoritative list of Texas GAM/GMA model archives to register first?
2. Is `NTGAM_Final_model_2025.7z` actually MODFLOW 6, MODFLOW-USG, or a bundle containing multiple forms?
3. Which Tapis app IDs/versions should be used for MODFLOW 6, USG, 2000, and 96?
4. Should setup-specific configs duplicate I/O contracts or reference/inherit generic MODFLOW configs?
5. Where should GMA/aquifer/layer/time mapping live if MINT lacks a clean existing field?
6. What makes a previous run “suitable enough” for reuse: exact archive ID, exact year/stress period, same app version, same transform registry hash?
7. Should plan-or-reuse automatically submit new model runs, or only return a dry-run plan requiring explicit approval?
8. Should final DFC compliance reports be published to CKAN by default, or only on user request?

## Decisions

- DFCs are objectives, not transform registry entries.
- MINT should be the source of truth for model/app capabilities across all GMAs/GAMs.
- The adapter should prefer suitable previous runs/results before planning a new model run.
- Historical execution bindings are not sufficient as reusable capabilities; fixed input bindings or setup metadata are needed.
- External writes require dry-run/manifest review and explicit user approval.
- Initial `plan-or-reuse` implementation must not automatically submit new Tapis jobs; it returns reuse recommendations, dry-run plans, or missing requirements. Live submission is a separate approval-gated action.
- Implemented first read-only capability step: `POST /objectives/{objective_id}/readiness` reports matching DFC targets, existing registered outputs, MINT model capabilities when available, fixed input bindings, existing completed runs, missing requirements, and `writes_performed: []`.

## User feedback / decisions

- User clarified that all GMAs/GAMs should be represented in MINT, not only NTGAM.
- User wants previous runs to be recommended/reused by default when suitable.
- If no suitable prior run exists, the system should add/run/register through the appropriate workflow, subject to approval gates.
