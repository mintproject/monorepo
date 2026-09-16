# Semantic Search Inference Across MINT UI Search Surfaces

Status: Implemented

## Objective

Define a consistent inference model for MINT UI search bars so free-text
queries retrieve semantically related catalog entities and their connected
context, while explicit filters remain deterministic. UI rollout and
dataset/CKAN integration remain separate follow-on work.

## User need

When a user searches for a concept such as `wildfire`, a standard-variable
search should find all standard variables attached to models or configurations
whose searchable context matches wildfire. A model search should work in the
inverse direction: it should find models through their own metadata, attached
standard variables, categories, regions, and related configuration context.
Users need search results that are broad enough to discover relevant entities
but explainable enough to understand why each result matched.

Dataset search currently opens or queries the CKAN portal. That is a larger
integration problem and is explicitly deferred from the first implementation
scope.

## Current code/system summary

The standalone semantic-search service currently accepts `GET /search?q=...`
and returns standard variables ranked by vector distance plus PostgreSQL text
rank. Its embedding text includes the standard-variable label, description, and
linked model/workflow context. The current SQL context includes configuration,
software, and version fields, but not the full region/category inference
proposed here.

The UI calls this service from `StandardVariableCombobox`, used by ETL process
registration and modeling-thread variable controls. Other search surfaces are
currently separate:

1. Model searches use local substring filtering over already-loaded model rows.
2. The model browse page's Region, Category, and Output Variable facets use
   Hasura filters.
3. Explore Variables uses local ranking over the loaded standard-variable table
   and a local category filter.
4. Configuration's combined standard-variable/unit picker uses local ranking;
   its unit search is local.
5. Dataset search calls CKAN.
6. Person, region, unit, model-family, and Tapis-application pickers are
   exact/local or Hasura-backed lookup controls.

## Proposed design

### Search vocabulary and inference rules

Build a searchable context document for each supported target entity. The
document should include the entity's own fields plus connected entities that
are meaningful for discovery.

- **Standard variable target:** label, description, units, model/configuration
  labels and descriptions, model keywords, software/version metadata, input or
  output role, model categories, and model regions. A query such as `wildfire`
  can therefore return every standard variable attached to a matching model.
- **Model/configuration target:** model and configuration labels,
  descriptions, keywords, software/version metadata, input/output standard
  variables, categories, regions, workflow notes, and related problem-statement
  context where that relationship is authoritative. A query such as
  `wildfire` can find a model because wildfire appears in a variable,
  category, region, or model description.
- **Problem statement target:** title, description, goals, region, dates, and
  selected variables/models. This is a candidate for a later target-specific
  index, not a prerequisite for the first catalog search rollout.

The search API should receive an explicit target type and optional structured
filters. Semantic relevance should determine recall and ranking; structured
filters should be applied as hard constraints. Results should return linked
context as match evidence, such as an attached model/configuration, output
variable, region, or category, so the UI can explain the inference.

### UI behavior

Use one shared search contract for catalog entities but preserve the purpose of
each control. Problem-statement-driven discovery is exposed as the explicitly
named `problem_statement_recommendations` capability rather than as a generic
recommendations endpoint:

- SVO controls use semantic SVO retrieval, then apply their scope (`all`,
  `indicator`, or `driver`) as a hard filter.
- Model controls use semantic model retrieval. Region, category, and output
  variable selections remain hard filters combined with the free-text query.
- Explore Variables uses the same semantic SVO retrieval as the SVO controls;
  its category selector remains a hard filter.
- The configuration SVO/unit picker should adopt semantic SVO retrieval for
  its variable search while keeping unit matching local and exact.
- Dataset search remains on the existing CKAN path until a separate dataset
  integration plan is approved.
- Lookup controls for people, units, regions, model families, and Tapis apps
  remain exact/local or Hasura-backed unless a later product decision gives
  them a discovery use case.

For problem-statement-driven results, use a route such as
`POST /problem-statements/recommendations` for a draft statement and
`GET /problem-statements/{id}/recommendations` for a saved statement. The
initial response target set is `svo` and `model_configuration`.

### Phase 1 recommendation pipeline

Phase 1 is intentionally narrower than a general-purpose ontology reasoner:

1. Normalize the problem statement's text and preserve its structured fields.
2. Generate candidates through typed direct relationships between standard
   variables, presentations, model configurations, categories, and regions.
   Do not traverse model families, datasets, or untyped neighboring concepts.
3. Apply only user-confirmed structured filters as hard eligibility checks.
4. Rank eligible candidates using lexical and embedding relevance from the
   problem-statement context and connected catalog context.
5. Return top-k candidates with stable IDs, scores, and match evidence.
6. Abstain or return an empty result when context is insufficient or no
   candidate survives the hard filters. Never relax a hard filter silently.

Natural-language mentions of a region, category, or variable are ranking and
candidate-generation signals until the user confirms them through a structured
UI control. This keeps the recommendation path explainable and prevents an
ambiguous phrase from becoming an eligibility constraint.

### Result and ranking contract

The implementation extends the existing endpoint while preserving `target=svo`
as its default. The contract defines:

- target entity type;
- query text and result limit;
- structured hard filters;
- stable result identifiers and display fields;
- relevance score and ranking source;
- matched-context evidence;
- linked entities needed by the UI without a second fan-out query.

Configuration embeddings are stored in `modelcatalog_configuration.semantic_text`
and `modelcatalog_configuration.embedding`, alongside the existing standard
variable embedding fields. The service refreshes both target indexes from the
unified post-migration catalog schema.

## Files likely affected

- `semantic-search-service/main.py` and its tests;
- database query/indexing code for model, configuration, region, category, and
  standard-variable context;
- `ui-react/src/components/autocomplete/StandardVariableCombobox.tsx`;
- `ui-react/src/components/autocomplete/StandardVariableUnitPicker.tsx`;
- `ui-react/src/components/models-browse/ModelsBrowsePage.tsx`;
- modeling-thread model browse/search components;
- `ui-react/src/pages/variables/VariablesHome.tsx`;
- generated/API types and focused UI/service tests;
- semantic-search and MINT dev deployment documentation.

## API/schema changes

Phase 1 API changes include a target discriminator, structured filter fields,
match evidence, and the explicit recommendation capability:

- `GET /search?target=svo&q=...` for standard-variable discovery;
- `GET /search?target=model_configuration&q=...` for model-configuration
  discovery;
- `POST /problem-statements/recommendations` for a draft problem statement;
- `GET /problem-statements/{id}/recommendations` for a saved problem statement.

The recommendation response initially targets `svo` and
`model_configuration`. A database schema migration is not necessarily required
if searchable context remains materialized in existing columns, but indexing
strategy and possibly a search-document table should be evaluated before
implementation.

## Data flow

The UI sends free text plus the control's target and hard filters to the
semantic-search service. The service searches the target's materialized
context, ranks candidates with embeddings and lexical relevance, applies hard
filters, and returns target rows with evidence and linked display data. The UI
renders the ranked rows and preserves the existing selection/scoping behavior.
Catalog writes continue to notify the service so affected context documents
are refreshed.

## Risks and tradeoffs

- Cross-entity inference can improve recall while also producing surprising
  matches unless evidence and target-specific ranking are visible.
- Model/category/region relationships may multiply context text and bias
  rankings toward highly connected entities.
- Embedding refresh must respond to changes in variables, models, categories,
  regions, and relationships—not only standard-variable updates.
- Large context documents may increase indexing cost and query latency.
- Keeping hard filters outside the embedding score is less flexible than fully
  learned retrieval, but is predictable and preserves current UI semantics.
- Dataset search should not be coupled to this rollout while its CKAN behavior
  and desired user experience are still under review.

## Alternatives considered

- **Only search each entity's own fields:** rejected because it misses the
  requested inverse inference between wildfire-related models and SVOs.
- **Send every UI filter as embedding text:** rejected because region/category
  selections must remain exact constraints rather than approximate relevance.
- **Replace every lookup with semantic search:** rejected because people,
  units, regions, and applications are controlled vocabularies where exact
  lookup is more reliable.
- **Fix CKAN and semantic search together:** deferred; dataset search requires
  a separate integration and indexing decision.

## Test plan

- Unit-test context assembly for SVO and model targets, including variable
  roles, model/configuration metadata, categories, and regions.
- Test that a query matching a connected model returns its attached SVOs.
- Test the inverse: a query matching an attached SVO/category/region returns
  the connected model/configuration.
- Test hard-filter behavior and combinations such as semantic query plus
  region/category/output-variable filters.
- Test evidence labels and stable result IDs.
- Test UI controls for loading, empty, stale, cancelled, and API-error states.
- Use browser Network-panel verification to confirm each intended search bar
  calls the right target and that lookup controls do not unexpectedly call the
  semantic service.
- Keep CKAN dataset search tests separate until its replacement plan exists.

## Documentation plan

Document the search target contract, inference fields, evidence semantics,
hard-filter rules, refresh triggers, and the list of UI surfaces intentionally
excluded from semantic search. The deployment runbook documents the implemented
routes. Add a separate dataset-search design before changing the CKAN integration.

## Rollout/rollback plan

Roll out one target type at a time, beginning with SVO search because it is
already integrated. Add model search behind a controlled UI/configuration
switch, compare result quality and latency, then expand to other catalog
surfaces. Keep the current local/Hasura paths available as fallbacks. Rollback
is the removal of the target switch or endpoint configuration; no catalog data
should be deleted.

## Open questions

- Should model search return configurations, model families, or both as first-
  class result types?
- Should a free-text query be ANDed with hard filters before ranking, or should
  filters narrow the candidate set after semantic retrieval?
- Which region/category relationships are authoritative when a model has
  multiple configurations?
- Should SVO results include only directly attached models, or transitive
  relationships through model families and workflows?
- What evidence should be shown inline versus behind a details affordance?
- Do we need a dedicated search-document table for refreshability and audit?
- What is the desired future relationship between CKAN dataset search and the
  model-catalog semantic index?

## Decisions

### 2026-09-16 - Start with an inference matrix, not an implementation

- **Decision:** Produce an initial mapping of every UI search surface, its
  current backend, proposed semantic behavior, and hard filters before coding.
- **Reason:** The requested inference crosses SVOs, models, categories, and
  regions, and dataset search is a separate CKAN problem.
- **Alternatives rejected:** Implementing only the existing SVO combobox or
  changing CKAN in the same step would leave the broader search behavior
  undefined.
- **User feedback:** The user requested an initial table for discussion and
  explicitly deferred the CKAN issue.
- **Impact on implementation:** The table became the boundary for the API
  phase; UI search-surface changes and CKAN work remain separate.

### 2026-09-16 - Name the problem-statement capability

- **Decision:** Name the capability `problem_statement_recommendations`.
- **Reason:** The name keeps the problem statement explicit as the source of
  context while allowing the response to contain ranked, evidence-backed SVO
  and model-configuration suggestions.
- **Alternatives rejected:** Generic `recommendations` hides the source
  context; `problem_statement_matches` sounds like exact matching rather than
  guided discovery.
- **User feedback:** The user selected `problem_statement_recommendations`.
- **Impact on implementation:** Use `/problem-statements/recommendations` for
  draft requests and `/problem-statements/{id}/recommendations` for saved
  statements. The API phase is implemented; UI adoption remains follow-on work.

### 2026-09-16 - Narrow Phase 1 to evidence-backed direct inference

- **Decision:** Propose a Phase 1 pipeline of typed candidate generation, hard
  eligibility filtering, semantic ranking, and explicit abstention. Limit
  relationships to direct SVO/presentation/model-configuration,
  category, and region edges.
- **Reason:** The requested wildfire inference is useful, but untyped or
  transitive traversal could turn adjacent concepts into unjustified results.
- **Alternatives rejected:** A broad ontology reasoner and automatic filter
  relaxation are deferred until an evaluation set and provenance rules exist.
- **User feedback:** The user asked to get started on the problem-statement
  recommendation plan; this is the smallest implementation boundary that
  preserves the requested behavior without hiding ambiguity.
- **Impact on implementation:** Add target-specific contracts, provenance
  evidence, hard-filter enforcement, minimum-context/abstention behavior, and
  offline evaluation before broader UI rollout. The implementation uses a
  minimum text context of one non-empty title/name, description, or goal and
  returns an explicit abstention response when that context is absent.

### 2026-09-16 - Implement the API contract first

- **Decision:** Implement the target-aware catalog API before changing the UI.
- **Reason:** The UI needs one stable response shape for SVO and model/configuration
  search, including hard filters and evidence, before each search surface is migrated.
- **User feedback:** The user explicitly asked to make the API changes first.
- **Defaults:** `target=svo` preserves the existing `/search` caller; model and
  recommendation results use the unified catalog configuration schema. Recommendation
  requests are on-demand, top-k, and abstain without silently relaxing hard filters.

### 2026-09-16 - Normalize legacy region selections at the API boundary

- **Decision:** Accept both the UI's legacy `region.id` values and
  `modelcatalog_region.id` URIs for region filters, resolving legacy rows to
  their `model_catalog_uri` when available.
- **Reason:** Problem statements and model-catalog configuration regions use
  different identifier namespaces in the existing schema.
- **Impact on implementation:** The semantic service preserves the caller's
  value while adding the authoritative model-catalog URI to the hard-filter
  candidate set; it also honors the legacy configuration `has_region` field.
  It does not turn an unknown value into an unfiltered query.

### 2026-09-16 - API implementation deviations

> The first deviation below described the API-only phase and is superseded by
> the UI rollout decision immediately following it.

- **Deviation:** The UI remains unchanged in this phase because the user asked
  to establish the API contract first. Existing SVO callers continue to work
  with the default target; model and recommendation targets are ready for the
  subsequent UI migration.
- **Deviation:** The current persisted problem-statement schema has `name`,
  dates, region, and task-linked variables but no description/goals/model
  selection columns. Draft requests accept those richer fields; saved requests
  derive context from the fields and task/thread model relationships that
  currently exist.
- **Deviation:** Evidence is relationship-backed context evidence (linked
  model/configuration, variable role, category, or region); exact per-field
  lexical attribution is deferred until the evaluation set is available.

### 2026-09-16 - Roll out one shared client across approved UI surfaces

- **Decision:** Adopt a shared abort-safe semantic-search hook for the SVO
  comboboxes, Explore Variables, the model browse page, and both modeling-thread
  model selectors. Keep local/Apollo/Hasura paths as fallbacks and leave unit
  and CKAN search unchanged.
- **Reason:** The approved inference matrix calls for consistent target and
  hard-filter handling without duplicating request cancellation and stale-result
  logic in each control.
- **Alternatives rejected:** Replacing controlled-vocabulary lookups wholesale
  was rejected because unit search must remain exact; removing local/Hasura
  fallbacks was rejected because semantic-service availability must not make
  existing controls unusable.
- **User feedback:** The user approved the planned UI rollout with “Ok Do it”.
- **Impact on implementation:** Added `useSemanticSearch`, explicit `target`
  and repeated hard-filter parameters, semantic ranking preservation for model
  groups, loading/cancellation/error-safe fallback behavior, focused tests, and
  UI README documentation. No API or database schema changes.

## User feedback / decisions

- The user wants a search such as `wildfire` to retrieve SVOs attached to
  wildfire-related models.
- The user wants inverse model search that also considers regions, categories,
  and connected variables.
- The user wants an initial table to discuss what works and what does not.
- CKAN dataset search is acknowledged as a larger follow-on issue and is out of
  the first scope.
