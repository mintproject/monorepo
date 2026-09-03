# DFC Working Extraction — Real Integration Path

**Status:** Implemented

---

## Objective

Remove the misleading DFC demo behavior that fabricates modeled values, and make the DFC flow integrate honestly with the existing planner, generated Tapis workflow, geo_actor-backed task code, DFC target lookup, and UI result rendering.

The implementation must not create deterministic fake/model-like values. If real extraction prerequisites are missing, the system should report exactly what is missing and should not display `MEETS` / `EXCEEDS` as if a valid extraction ran.

---

## User need

The user asks: “I’m in a GMA. Are we expected to meet the DFCs based on the model?” The answer must come from real modeled-output extraction at the same spatial scope as the adopted DFC target rule. For area-specific DFC rules, this means extracting/aggregating model output over the relevant district/county/DFC planning-area boundary, not reusing one GMA-wide scalar.

---

## Current code/system summary

- `POST /workflows/submit` currently has a `settings.demo_mode` branch in `app/main.py` that simulates completed tasks.
- The previous demo branch returned hardcoded values (`42.5`, `120.3`) and persisted mock `tasks`; this made the UI look complete without real extraction.
- `examples/gma_dfc_transforms.json` already contains transform specs for GMA boundary query, GCD/county boundary query, DFC area intersection, head aggregation, budget extraction, saturated thickness extraction, and `dfc_compliance`.
- `app/task_code.py` contains real task snippets for geo_actor-backed operations, but `_DFC_COMPLIANCE_SNIPPET` is still a stub.
- `app/tapis.py` can generate fused DFC workflow tasks for live execution, but live execution depends on Tapis token, geo_actor ID, source model artifact URI, and boundary/runtime args.
- Frontend now renders DFC results honestly and flags GMA-average-vs-area-specific scope mismatches.

---

## Proposed design

### Phase 1 in this session: no mock execution, real integration validation

1. **Remove fake completed DFC runs in demo mode.**
   - Demo mode may still seed fixture transform metadata and DFC target records.
   - Demo mode may generate/dry-run the workflow definition.
   - Demo mode must not return fabricated completed task outputs.

2. **Make “Run workflow” integration-aware.**
   - If `settings.demo_mode` and `dry_run=false`, return a clear error explaining that real extraction requires live mode and the required runtime args.
   - If `dry_run=true`, return the generated workflow definition and resolved args without registering/running Tapis.
   - Non-demo `dry_run=false` keeps the existing Tapis submission path, gated by required args and user-provided bearer token.

3. **Implement real `dfc_compliance` task logic at the snippet level.**
   - Replace the current `stub_pending_implementation` with an inline comparison implementation that consumes modeled scalar JSON and DFC target JSON/CSV when provided.
   - The snippet must fail closed if required inputs are missing; it must not synthesize modeled values.
   - It should output structured compliance rows only when modeled metric scope and DFC target scope match.

4. **Expose area-specific runtime requirements.**
   - Add/propagate args for DFC target area: `area`, `area_type`, `gcd_name`, `county_name`, and `dfc_area_boundary_uri` where applicable.
   - Update UI run args so selected target record context can be sent to workflow generation/submission.
   - For area-specific targets, generated workflows must require an area boundary, not only `gma_boundary_uri`.

5. **Improve UI language for real integration.**
   - The UI should distinguish `Generate workflow` from `Run workflow`.
   - Demo mode should not imply completed extraction; it should show the generated workflow and missing live prerequisites.

### Explicitly out of scope unless separately approved

- Running Tapis Workflows.
- Invoking geo_actor.
- CKAN or MINT writes.
- Downloading/staging model files.
- Claiming scientific compliance without real model outputs and matching boundaries.

---

## Files likely affected

- `app/main.py` — remove demo fake completion; enforce dry-run/live boundaries; persist only real/generate outputs.
- `app/task_code.py` — replace `dfc_compliance` stub with real comparison logic that consumes provided modeled/target inputs.
- `static/js/main.js` — pass selected DFC target context/runtime args; dry-run in demo mode; update run messaging.
- `static/js/components/history.js` — continue honest result rendering; render generated/missing-prerequisite states clearly.
- `static/index.html` — possible label changes (`Generate workflow`, `Run live workflow`) if needed.
- Tests — backend and browser smoke tests for dry-run/no-mock behavior.

---

## API/schema changes

No new endpoints are required.

`POST /workflows/submit` response behavior changes in demo mode:

- `dry_run=true`: returns generated workflow definition and args.
- `dry_run=false`: no fabricated completion; returns a validation error unless live mode is configured.

Potential new optional args in existing `args` object:

- `area`
- `area_type`
- `gcd_name`
- `county_name`
- `dfc_area_boundary_uri`
- `dfc_targets_uri` or inline target payload if already supported by generated task code

---

## Data flow

```
UI selects GMA/aquifer/year/metric/area target
  -> /plans generates transform chain from real registered specs
  -> /workflows/submit dry_run=true in demo/dev validation
       -> tapis.generate_tapis_workflow(plan)
       -> validate required live args
       -> return workflow definition + missing prerequisites
  -> /workflows/submit dry_run=false only in live/non-demo mode
       -> register/submit generated workflow to Tapis
       -> function task calls geo_actor using real source_uri + boundary args
       -> dfc_compliance compares real modeled scalar(s) to matching TWDB target(s)
       -> UI renders compliance only when scopes match
```

---

## Risks and tradeoffs

- A true working extraction depends on external geo_actor operations that are outside this repo.
- The existing transform registry has area-boundary specs, but the current UI/planner path primarily plans model-output transforms; it may need target-record-specific planning to derive district/county boundaries.
- The current DFC compliance task is a stub; implementing comparison is necessary but not sufficient for spatial extraction.
- Dry-run validation can prove workflow integration shape, args, and generated task code, but cannot prove geo_actor correctness without live execution approval.

---

## Alternatives considered

- Deterministic fixture modeled values — rejected by user; still a mock.
- Keep GMA-average mocked output and label scope mismatch — useful as a warning, but not a working extraction.
- Jump directly to live Tapis execution — blocked until explicit external-write/run approval and credentials/actor IDs are supplied.

---

## Test plan

- Unit/static checks for JS modules.
- Backend tests that demo `dry_run=false` no longer returns fake completed tasks.
- Backend tests that `dry_run=true` returns generated workflow definition and required args.
- Backend tests for `dfc_compliance` snippet logic using supplied modeled scalar + target payload and ensuring it fails closed when inputs are missing.
- Browser smoke test that demo mode displays generated workflow/missing prerequisites instead of fake compliance outputs.

---

## Documentation plan

- Update this spec after implementation with actual deviations.
- Update service docs/README only if endpoint/user-facing run behavior changes need to be documented.

---

## Rollout/rollback plan

- Rollout is local/dev only.
- Rollback by reverting `app/main.py`, `app/task_code.py`, and frontend messaging changes.
- No external state is mutated in this implementation.

---

## Open questions

- Do we have a reachable geo_actor ID and sample staged HDS/CBC/DIS model artifacts for a later live test?
- Should the first live path target only drawdown, or include saturated thickness and flow metrics immediately?
- Should area-boundary derivation be planned as a separate workflow step per DFC target row?

---

## Decisions

- User rejected mock/fixture modeled values and requested real system integration.
- This implementation will remove fabricated demo completion and replace it with dry-run/live validation plus real task comparison logic.
- No external Tapis/CKAN/MINT writes or live runs will be performed without separate explicit approval.
- Implemented demo-mode behavior as workflow generation only (`dry_run=true` from UI); no fake completed task outputs are emitted.
- Implemented `dfc_compliance` as fail-closed comparison logic over supplied modeled scalar JSON and DFC target payload/URI; it does not synthesize modeled values.
- Added DFC area boundary/runtime args to the generated workflow contract for the current head extraction path.

---

## User feedback / decisions

- “skip the mock parts and make sure all systems are integrating properly” — implement real integration plumbing and fail-fast validation rather than fake outputs.
