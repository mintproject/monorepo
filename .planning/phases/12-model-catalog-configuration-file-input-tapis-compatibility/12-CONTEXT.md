# Phase 12: Model Catalog Configuration File Input — Tapis Compatibility - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow a model configuration's `hasInput` to be marked optional. Round-trip the flag through the catalog (PostgreSQL + Hasura + v2 REST API), the UI configure editor, and the ensemble manager Tapis submission path so:

- Curators can mark individual inputs of a Configuration / Setup as optional via the UI or v2 PUT.
- The flag persists on the `modelcatalog_configuration_input` junction (per-config, per-input).
- Ensemble manager skips an optional input from Tapis `fileInputs[]` when no dataset is bound, instead of throwing `Component input not found for ${fileInput.name}` (TapisJobService.ts:113).

Reference: Tapis FileInput `inputMode` REQUIRED/OPTIONAL/FIXED — this phase implements the OPTIONAL semantic via a boolean. FIXED is out of scope.

Out of scope:
- Output optionality (Tapis has no output `inputMode`; only fileInputs use that field).
- v1.8.0 REST API changes (legacy Fuseki path stays as-is).
- ETL extraction of an `optional` predicate from TriG (no SDM standard predicate exists; ETL leaves the column at DB default).
- Tapis app `inputMode` cross-validation at submit time.
- Postgres ENUM type for input modes (boolean only).
- Setup-from-Configuration inheritance logic (each level stores its own flag).

</domain>

<decisions>
## Implementation Decisions

### Schema

- **D-01:** Add column `is_optional BOOLEAN NOT NULL DEFAULT FALSE` to `modelcatalog_configuration_input`. PK stays `(configuration_id, input_id)`. Outputs and parameters are unchanged.
- **D-02:** Single junction column — no entity-level (`modelcatalog_dataset_specification`) flag, no entity-default + junction-override pair. Same dataset_specification can be required in config-A and optional in config-B by virtue of two distinct junction rows. Mirrors how Tapis fileInputs carry per-app inputMode.
- **D-03:** Column type stays boolean (not TEXT enum, not Postgres ENUM). Roadmap scope is "optional flag." If FIXED semantics are ever needed, add a separate column or migrate to enum then — boolean today.
- **D-04:** Existing junction rows backfill to `FALSE` via DEFAULT — no separate UPDATE needed because DEFAULT applies to both existing rows (via `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT FALSE`) and any rows ETL inserts that omit the column.

### Hasura Metadata

- **D-05:** Track the new column in `graphql_engine/metadata/tables.yaml` for `modelcatalog_configuration_input`. Insert + select permissions must include `is_optional`. Junction tables in this codebase have insert+delete only — extend insert to include the flag (delete-then-insert is the established update pattern; see Phase 3 buildJunctionInserts).
- **D-06:** Three-migration split per Phase 9/10/11 precedent: SQL migration (ADD COLUMN), then Hasura metadata apply, then codegen + adapter updates. Single PR; commits split per migration.

### v2 REST API

- **D-07:** `is_optional` surfaces as a flat field on each input object inside `ModelConfiguration.hasInput[]` and `ModelConfigurationSetup.hasInput[]`. Junction-row metadata is flattened onto the input as it appears in this configuration. No separate `hasOptionalInput[]` collection. No nested `metadata` blob.
- **D-08:** OpenAPI spec gains `is_optional: boolean` on the relevant DatasetSpecification-as-input shape. POST/PUT for ModelConfiguration accepts the flag in nested `hasInput[]` body and writes it via `buildJunctionInserts` (delete-then-insert path on update).
- **D-09:** v1.8.0 (legacy Fuseki) REST API is **not** modified.
- **D-10:** Field maps (`field-maps.ts`) and resource registry (`resource-registry.ts`) updated to select + write `is_optional`. The hasInput relationship metadata in the `modelconfigurations` and `modelconfigurationsetups` registry entries (resource-registry.ts:202–209 and 286–293) gains an indication that the junction carries `is_optional`.

### ETL

- **D-11:** ETL does **not** attempt to extract an `optional` predicate from TriG. No new SPARQL query in `etl/extract.py`. The DB DEFAULT FALSE is the sole source of truth at first load. Curators flip the flag post-migration via the UI or v2 PUT.
- **D-12:** ETL load step inserts junction rows without enumerating `is_optional` in the column list; Postgres DEFAULT handles it. Mirrors how `etl/transform.py:601-607` builds rows today (only `configuration_id`, `input_id`).

### Ensemble Manager — Tapis submission

- **D-13:** `ModelIO` interface (`mint-ensemble-manager/src/classes/mint/mint-types.ts:332`) gains `is_optional?: boolean` (default `false`).
- **D-14:** `modelIOFromCatalogGQL` (`mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts:500`) reads `is_optional` from the junction row. Junction shape becomes `{ input: {...}, is_optional: boolean }` instead of `{ input: {...} }`. Adapter signature changes from `modelIOFromCatalogGQL(io)` to `modelIOFromCatalogGQL(junctionRow)` so it can access the sibling field. Update both callers (`modelFromGQL` lines 490–491).
- **D-15:** `TapisJobService.createJobFileInputsFromSeed` (TapisJobService.ts:103) updated logic:
  - For each `app.jobAttributes.fileInputs[fileInput]`:
    - Find `modelInput = model.input_files.find(i => i.name === fileInput.name)`.
    - If `modelInput` not found AND modelInput-by-some-other-key is `is_optional` → log info and skip (continue to next fileInput).
    - If `modelInput` found AND `seed.datasets[modelInput.id]` is empty/missing AND `modelInput.is_optional` → log info `"Skipping optional input ${modelInput.name} — no datasets bound"` and return `[]` for this fileInput (no JobFileInput emitted).
    - Required-but-missing keeps throwing the existing `Component input not found` / current error path — behavior unchanged for required inputs.
- **D-16:** No Tapis Apps API cross-check at submit time. MINT trusts the catalog's `is_optional`. If a Tapis app declares `inputMode: REQUIRED` for a fileInput that MINT marks optional, Tapis itself will reject the job — that error surfaces back through the existing error path. Cross-validation deferred.

### UI (configure)

- **D-17:** Both `ui/src/screens/models/configure/resources/model-configuration.ts` and `model-configuration-setup.ts` input editors gain the optional checkbox. Each level edits its own junction row independently — no inheritance from Configuration to Setup.
- **D-18:** Visual marker in **all** views (read + edit): a small `optional` badge next to the input label. Edit mode adds a checkbox per input row in the `_inputDSInput` editor. Read mode renders the badge only.
- **D-19:** Save path (`getResources()` in model-configuration.ts:828 and model-configuration-setup.ts:833) returns `hasInput` items with `is_optional` populated; the v2 REST API call PUTs/POSTs the flag through to the junction row.
- **D-20:** Existing `_inputDSInput` resource picker emits `DatasetSpecification[]` today. It evolves to emit either `(DatasetSpecification & { is_optional: boolean })[]` or a tuple/wrapper shape — exact TS shape is Claude's discretion, must round-trip through the existing setResources/getResources contract without breaking the model-configuration-setup.ts:284 setResourcesAsCopy path.

### Test coverage

- **D-21:** Unit tests added for:
  - `TapisJobService.createJobFileInputsFromSeed` skip path (optional + no dataset → omitted); required + no dataset → still throws; optional + dataset present → included normally.
  - `modelIOFromCatalogGQL` adapter reads `is_optional` from junction row (default false when absent).
  - `buildJunctionInserts` path includes `is_optional` in the configuration_input insert.
- **D-22:** No new integration tests required. Existing junction integration test pattern (Phase 3) covers POST/PUT round-trip; extend the configuration_input case to assert the flag persists.

### Build + Codegen

- **D-23:** `npm run codegen` in mint-ensemble-manager regenerates `types.ts` after Hasura tables.yaml apply. UI codegen (if present) regenerates accordingly. Commit generated types in the same PR.

### Claude's Discretion

- Exact migration filename + numbering (continue the `1771200016000_*` sequence after 1771200015000_thread_model_io_fk).
- SQL syntax for the ALTER TABLE.
- Hasura metadata YAML diff for `modelcatalog_configuration_input` permissions.
- Exact resource-registry.ts shape for advertising the new junction column to `buildJunctionInserts`.
- TS shape for the UI editor's input + flag pair (object with `is_optional` field, parallel array, etc.).
- Whether to add an index on `is_optional` (probably no — junction is small, queries always filter by configuration_id).
- Log level / format for the skip notice in TapisJobService.
- OpenAPI documentation wording for the new field.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Project

- `.planning/ROADMAP.md` § "Phase 12: Support optional `hasInput`…" — full phase scope and affected components
- `.planning/PROJECT.md` — DYNAMO v2.0 migration context, key decisions, junction permissions pattern

### External: Tapis FileInput

- https://tapis.readthedocs.io/en/latest/technical/apps.html — FileInput `inputMode` REQUIRED/OPTIONAL/FIXED reference

### Phase 9 — junction merge + buildJunctionInserts pattern

- `.planning/phases/09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships/09-CONTEXT.md` — unified `modelcatalog_configuration_input` junction structure, three-migration split, ETL two-pass loading

### Phase 10 — adapter pattern + GraphQL codegen flow

- `.planning/phases/10-check-the-required-changes-on-mint-ensemble-manager-after-migration/10-CONTEXT.md` — adapter update pattern, codegen + commit flow, `modelIOFromCatalogGQL`

### Phase 3 — junction CRUD pattern

- `.planning/phases/03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource/03-CONTEXT.md` — `buildJunctionInserts`, delete-then-insert update path, parentFkColumn in resource registry

### Database Schema

- `graphql_engine/migrations/1771105509000_modelcatalog_schema/up.sql` § lines 83-87 — `modelcatalog_configuration_input` table definition (current shape)
- `graphql_engine/migrations/1771200015000_thread_model_io_fk/` — most recent migration; numbering reference
- `graphql_engine/metadata/tables.yaml` — Hasura table tracking + insert/select permissions for `modelcatalog_configuration_input`

### model-catalog-api

- `model-catalog-api/src/mappers/resource-registry.ts` § lines 202-209 (modelconfigurations.hasInput) and lines 286-293 (modelconfigurationsetups.hasInput) — junction relationship metadata that must be extended
- `model-catalog-api/src/services/service.ts` — generic CRUD with `buildJunctionInserts` (Phase 3)
- `model-catalog-api/src/mappers/field-maps.ts` — GraphQL field selection per table; add `is_optional` to configuration_input row
- `model-catalog-api/openapi.yaml` (or equivalent spec file) — DatasetSpecification-as-input schema gains `is_optional: boolean`

### ETL

- `etl/extract.py` § lines 463-480, 687-704 — `hasInput` link extraction (no change required, but reviewer must confirm no SDM optional predicate exists in TriG)
- `etl/transform.py` § lines 560-654 — `build_junction_tables` → `config_input_rows` (no change; DEFAULT FALSE applies)

### Ensemble Manager

- `mint-ensemble-manager/src/classes/mint/mint-types.ts:332` — `ModelIO` interface; add `is_optional?: boolean`
- `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts:480-510` — `modelFromGQL` and `modelIOFromCatalogGQL`; signature change to read junction-row `is_optional`
- `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql` — fragment must select `is_optional` on the inputs junction
- `mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql` — same selection
- `mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts:103-127` — `createJobFileInputsFromSeed`; skip-when-optional logic
- `mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts` — extend with optional-skip cases
- `mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/app.ts` — Tapis app fixtures already use `inputMode` (REQUIRED/FIXED); add OPTIONAL fixture

### UI

- `ui/src/screens/models/configure/resources/model-configuration.ts` § lines 197, 293, 828 — `_inputDSInput` editor wiring; `getResources()` save path
- `ui/src/screens/models/configure/resources/model-configuration-setup.ts` § lines 210, 284, 318, 833, 959 — same editor at the Setup level; `setResourcesAsCopy` round-trip
- UI v2 REST client (path TBD by researcher) — must round-trip `is_optional` on hasInput items

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `buildJunctionInserts` (Phase 3) handles junction-row writes generically once the resource-registry entry advertises the column shape — extension here is purely in registry metadata, not the helper itself.
- `modelIOFromCatalogGQL` (graphql_adapter.ts:500) is the single mapper for catalog inputs/outputs in ensemble manager — one signature change covers both inputs and outputs.
- Three-migration split (SQL → metadata → codegen) is established (Phase 9/10/11) — same template applies.
- Junction NOT NULL DEFAULT pattern already used elsewhere in modelcatalog migrations.
- `_inputDSInput` UI editor in configure already manages list of DatasetSpecification rows with add/remove buttons — checkbox slot fits without restructuring.

### Established Patterns

- Junction tables: insert+delete permissions only; updates done via delete-then-insert in service.ts (`buildJunctionInserts`).
- URI TEXT primary keys; `modelcatalog_` table prefix.
- Hasura metadata edits live in `graphql_engine/metadata/tables.yaml` and are applied via `hasura metadata apply`.
- Codegen regeneration after schema changes: `npm run codegen` in `mint-ensemble-manager`, commit `types.ts`.
- Adapter functions kept clean and stateless — `modelIOFromCatalogGQL` adds the new field by reading the junction row alongside the input.

### Integration Points

- Configuration POST/PUT in v2 API → `buildJunctionInserts` → modelcatalog_configuration_input INSERT (with `is_optional`).
- Submission flow: `model-catalog-api` (read) → ensemble manager `modelFromGQL` → `model.input_files[].is_optional` → `TapisJobService.createJobFileInputsFromSeed` skip decision.
- UI configure editor reads `model.hasInput[].is_optional` (or equivalent) → renders badge/checkbox → emits flag back through PUT.

### Known Hazards

- `modelIOFromCatalogGQL` signature change: every caller (currently 2 — graphql_adapter.ts:490, 491) must pass the junction row instead of the bare input. If a similar adapter exists for outputs, it must NOT be changed (outputs out of scope).
- TriG has no `sd:hasOptionalInput` predicate today (researcher to confirm). ETL leaves column at DEFAULT FALSE — first load won't set anything optional. Document this in user-facing release notes.
- v1.8.0 REST API consumers expect today's hasInput shape — flag must NOT leak into the legacy response. v1.8.0 path is Fuseki-backed and unchanged regardless, but worth a regression check.
- Junction PK is (configuration_id, input_id). Adding `is_optional` does NOT change PK. delete-then-insert update pattern still applies — flag is replaced wholesale on update, not patched.

</code_context>

<specifics>
## Specific Ideas

- Boolean field name: `is_optional` (snake_case to match existing column naming in `modelcatalog_*` tables: `has_format`, `has_dimensionality`, etc. — well, `is_*` is novel here; reviewer confirms but `is_optional` is more idiomatic Postgres than `optional`).
- Display badge text: `optional` lowercase, neutral color — matches existing badge usage in the configure UI (researcher to grep for existing badge styles).
- Skip log message: `info` level, format: `"Skipping optional input ${input.name} — no datasets bound for execution ${execution.id}"`.
- Migration filename suffix: `_modelcatalog_configuration_input_is_optional`.

</specifics>

<deferred>
## Deferred Ideas

- **Output optionality** — Tapis has no fileOutput inputMode equivalent. If MINT ever needs to model optional outputs, that's a separate phase and a separate column on `modelcatalog_configuration_output`.
- **Tapis app cross-validation at submit** — verify catalog `is_optional` matches Tapis app `inputMode`. Belongs in a future "Tapis app validation" phase, ideally driven by a real bug report rather than speculative.
- **FIXED inputMode** — Tapis third state. Not requested. If needed later, migrate `is_optional BOOLEAN` to `input_mode TEXT` enum or add a sibling column.
- **ETL extraction of an optional predicate from TriG** — only worthwhile if a future curated TriG dataset starts emitting one. Today, all data is legacy and predates this feature.
- **Setup-from-Configuration flag inheritance** — single-source-of-truth via Configuration with Setup overrides. Adds inheritance complexity for negligible UX gain. If multiple Setups under the same Configuration always need identical optional flags, revisit.

</deferred>

---

*Phase: 12-model-catalog-configuration-file-input-tapis-compatibility*
*Context gathered: 2026-04-27*
