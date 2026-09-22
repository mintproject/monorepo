# Model-driven DFC outcome inference

Status: Implemented

## Objective

Allow the Problem Formulation wizard to select a derived Desired Future
Condition outcome, such as spring flow, and surface the model configurations
that can produce it through registered SVO adapter transforms. For the SVO demo
case, selecting spring flow should make the compatible MODFLOW configuration
available through the `cbc-mf6 → spring__volume_flow_rate` chain.

## User need

**Primary user:** A groundwater modeler using the Problem Formulation wizard.

**Secondary users:** SVO/ETL registry maintainers and developers operating the
MINT model catalog.

**Job-to-be-done:** State a groundwater planning outcome, such as a spring-flow
DFC, and identify a valid MODFLOW model plus the data/transform path needed to
evaluate it.

**Current pain:** The wizard only matches a desired outcome against direct
model output SVOs. The SVO demo can plan MODFLOW CBC to spring flow, but that
relationship is invisible to the model-selection step.

**Definition of success:** Selecting `spring__volume_flow_rate` in Desired
outcome causes the Models step to include the compatible MODFLOW configuration,
without showing unrelated models. The selected model's downstream driver list
continues to use the existing model/ETL/SVO inference behavior.

## Current code/system summary

- `ModelsStep` filters model rows using direct standard-variable presentations
  and model output formats reachable through adapter transforms.
- `useScopedStandardVariables` now infers drivers from model, ETL, and optional
  adapter transforms, and no longer falls back to the global driver list when
  an outcome is selected.
- The SVO DFC fixture registers `modflow6-drain-gma-extract` with an input
  format of `cbc-mf6` and an output SVO of
  `spring__volume_flow_rate`, followed by a unit conversion to cfs.
- The Problem Formulation model query requests input/output formats so it can
  match a model-produced CBC file to the adapter input.
- `spring__volume_flow_rate` is registered in the model-catalog migration and
  fixture, and adapter output SVOs are included in the indicator picker.

Implementation note: the UI now requests adapter output SVOs for the indicator
picker, requests dataset formats in the model tree, and traverses adapter
contracts backward to find compatible model configurations. A focused catalog
migration and fixture entry register the spring-flow vocabulary and the
format-only MODFLOW CBC output.

## Proposed design

1. Add the spring-flow standard variable to the model-catalog controlled
   vocabulary with the canonical URI used by the SVO adapter.
2. Extend the model-tree query and its hand-authored types to include each
   input/output dataset specification's `has_format` value.
3. Represent the MODFLOW configuration's CBC output as a format-only model
   output contract (`cbc-mf6`) where the catalog data currently omits it.
4. Add a shared graph helper that walks registered adapter transforms backward
   from the selected outcome. Edges match on standard-variable URI when one is
   present, or on exact format when a contract is format-only.
5. Update `ModelsStep` to union direct outcome matches with model configurations
   whose output contracts are reachable through that graph. Keep the existing
   direct-output behavior for outcomes with no adapter path.
6. Keep adapter inference optional at runtime. If the authenticated Hasura role
   cannot read the adapter registry, the wizard must remain usable for direct
   model outcomes and must not show the global unrelated-model list.

## Files likely affected

- `ui-react/src/graphql/generated/modeling.ts`
- `ui-react/src/pages/modeling/thread/wizard/ModelsStep.tsx`
- `ui-react/src/lib/modeling/outcome-driver-inference.ts`
- `ui-react/src/components/autocomplete/useScopedStandardVariables.ts`
- `graphql_engine/fixtures/modelcatalog.sql` or a focused migration/seed for
  the spring-flow vocabulary and MODFLOW CBC output contract
- `graphql_engine/metadata/tables.yaml` if adapter read permissions need to be
  applied to the deployed authenticated role
- focused UI and inference tests
- this design spec and the deployment runbook as needed

## API/schema changes

- No new public REST endpoint is required.
- The UI GraphQL model-tree selection will request `has_format` on dataset
  specifications.
- The adapter GraphQL selection will request contract `format` alongside SVO
  fields.
- Catalog data must contain the canonical spring-flow standard-variable row and
  a format-only `cbc-mf6` output contract for the compatible MODFLOW model.

## Data flow

```text
Desired outcome: spring__volume_flow_rate
        ↓ backward graph over adapter contracts
spring__volume_flow_rate (gma-scalar, m3s)
        ↓ flow-m3s-to-cfs
spring__volume_flow_rate (cfs)
        ↓ modflow6-drain-gma-extract
cbc-mf6 format-only output
        ↓ exact format match
MODFLOW 6 model configuration
```

The Models step uses the reachable model configuration IDs. After a model is
selected, the Variables step uses the existing outcome-driver graph to expose
the model's upstream inputs and any registered ETL/adapter drivers.

## Risks and tradeoffs

- Format-only matching can produce false positives if unrelated models publish
  the same generic format. Exact format matching is therefore limited to
  registered adapter input contracts and cataloged model outputs.
- Adding a CBC output contract changes catalog semantics but makes the actual
  execution artifact explicit and discoverable.
- Adapter metadata drift must remain a degraded-mode condition, not a reason to
  expose all catalog models or drivers.
- The first implementation supports registered transform chains; it does not
  infer arbitrary model semantics from names or descriptions.

## Alternatives considered

- **Match model labels containing “MODFLOW”:** rejected because it is not
  data-driven and would select models unrelated to the requested outcome.
- **Treat every adapter transform as a model:** rejected because transforms do
  not satisfy the thread's model-configuration foreign key or execution path.
- **Show all models for derived outcomes:** rejected because it recreates the
  unrelated-model filtering problem.
- **Use only direct spring-flow outputs:** rejected because the demo's valid
  path begins with a MODFLOW CBC artifact and derives spring flow afterward.

## Test plan

- Unit-test graph traversal for SVO-only, format-only, and mixed
  SVO/format edges.
- Test that a spring-flow outcome includes the MODFLOW configuration connected
  through `cbc-mf6` and excludes an unrelated model with no reachable output.
- Test that adapter query validation/permission errors preserve direct model
  filtering and never restore the global model list.
- Test the model-tree query fixture includes output formats and the canonical
  spring-flow vocabulary row.
- Run the focused UI tests, TypeScript check, and lint.
- In the local stack, seed the GMA DFC adapter fixture and verify the rendered
  model list and planned chain.

Completed checks: focused inference/UI tests (38 tests), TypeScript typecheck,
ESLint on changed UI files, and GraphQL document regression checks pass. The
local rendered-plan check remains dependent on a populated adapter registry.

## Documentation plan

Document the catalog contract requirement and the authenticated Hasura metadata
smoke query in the MINT dev deployment runbook. Update this spec with the final
catalog IDs and any implementation deviations.

## Rollout/rollback plan

Apply the catalog data/migration and Hasura metadata before deploying the UI so
the spring-flow option and adapter registry are available. Deploy the UI, then
verify the authenticated model-tree and adapter GraphQL queries. Roll back the
UI independently if needed; do not remove live adapter or catalog rows without
an explicit data-recovery decision.

## Open questions

- The Problem Formulation wizard selects the MODFLOW configuration; the full
  SVO adapter plan is generated later in the dataset/run steps.
- `spring__volume_flow_rate` is a normal selectable controlled-vocabulary
  outcome, with model availability determined by the graph.
- The existing `Modflow6 Changes to Well Files` configuration owns the demo's
  `cbc-mf6` output contract.

## Decisions

### 2026-09-21 - User approved the implementation defaults

- Select the MODFLOW configuration in the wizard and expose the complete SVO
  adapter plan in later steps.
- Make spring flow a normal outcome option.
- Associate the existing `Modflow6 Changes to Well Files` configuration with
  the `cbc-mf6` output contract.

## User feedback / decisions

- 2026-09-21: User confirmed that the desired behavior is to select a spring-
  flow DFC and receive a compatible MODFLOW model through the SVO adapter path.

## Implementation status

- Added `has_format` to model input/output catalog selection and matching.
- Added optional adapter-registry reads for outcome SVOs and model inference;
  adapter permission/validation failures degrade without restoring unrelated
  model or driver options.
- Added the `spring__volume_flow_rate` vocabulary row and the
  `modflow6_cbc_output` (`cbc-mf6`) relation for the existing MODFLOW 6
  configuration in migration `1771300000001_modflow6_dfc_output`.
- Full downstream workflow-plan generation remains intentionally deferred to
  the later dataset/run steps, as approved in the open questions.
