# MINT Dataset Discovery and Model Fit

**Status:** Implemented

## Objective

Replace the primary CKAN iframe on `/datasets/browse` with a first-party MINT-aware discovery surface. The surface resolves free-text queries through Vector Search to MINT Standard Variables, retrieves matching CKAN datasets, exposes a map-based spatial bounding-box filter and temporal coverage filters, and shows model compatibility in a side panel.

## User need

- **Primary user:** Facilitators and data scientists.
- **Job-to-be-done:** Find scientifically relevant, MINT-ready datasets; understand which model inputs they can satisfy; and move into model setup with the dataset context preserved in the URL.
- **Current pain:** The browse route embeds CKAN, while custom search and model-input matching are separate experiences.
- **Definition of success:** A user can search natural language, see SVO-backed dataset matches, inspect compact spatial/temporal signals, open compatible models, and start model setup.

## Current code/system summary

- `ui-react/src/pages/datasets/DatasetsBrowse.tsx` previously rendered the CKAN UI in an iframe.
- `ui-react/src/lib/datasets/ckan.ts` provides CKAN transport and resource-level SVO annotation matching.
- `ui-react/src/lib/datasets/data-catalog-api.ts` maps CKAN packages to typed dataset objects.
- `ui-react/src/hooks/useSemanticSearch.ts` already supports semantic search with `target=svo` and `target=model_configuration`.
- `ui-react/src/graphql/generated/modeling.ts` exposes model configurations, inputs, dataset specifications, variable presentations, and regions.
- `ui-react/src/pages/modeling/thread/MintDatasets.tsx` contains existing model-input dataset selection and resource selection behavior.

## Proposed design

The browse page now has two modes:

1. Browse MINT-ready datasets.
2. Find data for a model/configuration.

Free-text search uses Vector Search with `target=svo`, normalizes the returned SVO labels/IDs, then matches exact canonical resource annotations in CKAN. Browse-mode multi-SVO search uses OR semantics. Model mode uses required-input coverage to rank datasets; run completeness remains a property of a model plus a selected dataset set, not an individual dataset.

The result card shows title, description, source, SVO chips, compact spatial/temporal coverage, format, profile link, and a `Models` action. `Models` opens a lazy side panel grouping complete and partial model matches. Complete matches link to model setup; partial matches link to build-complete-run context. No model is executed by this feature.

Spatial coverage is selected by drawing a bounding box on a map positioned beside the search/filter card; the map spans the card height. Temporal coverage uses two year range sliders. Validation status, metadata freshness, file size, and resource count are intentionally excluded from the MVP.

## Files likely affected

- `ui-react/src/pages/datasets/DatasetsBrowse.tsx`
- `ui-react/src/components/datasets/DatasetDiscovery.tsx`
- `ui-react/src/components/datasets/DatasetCompatibilityPanel.tsx`
- `ui-react/src/components/datasets/DatasetSpatialMap.tsx`
- `ui-react/src/lib/datasets/discovery.ts`
- `ui-react/src/lib/datasets/spatial.ts`
- `ui-react/src/lib/datasets/ckan.ts`
- `ui-react/src/lib/datasets/data-catalog-api.ts`
- `ui-react/src/lib/datasets/types.ts`
- `ui-react/src/__tests__/datasets/DatasetsBrowse.test.tsx`

## API/schema changes

No CKAN writes, MINT execution changes, database migrations, or new server endpoints. The UI composes the existing semantic-search API, CKAN Action API, and Hasura-generated model catalog query. Dataset query types now support exact canonical SVO lists and temporal ranges.

## Data flow

```text
free-text query -> semantic-search target=svo -> canonical SVO labels
  -> CKAN package_search/package_show -> exact resource annotation match
  -> dataset cards -> optional Hasura model tree query
  -> compatibility side panel -> existing modeling route
```

## Risks and tradeoffs

- The MVP still loads the CKAN catalog client-side because CKAN resource annotations are not reliably searchable through Solr. This is acceptable for the current catalog size but should move server-side or into a synchronized dataset index if the catalog grows.
- Semantic results may need future alias normalization if Vector Search labels diverge from CKAN annotations.
- Unknown spatial/temporal metadata remains visible rather than being treated as incompatible.
- The modeling route currently receives model and dataset IDs in query parameters; consuming those parameters to prepopulate a new modeling thread is a follow-up integration.

## Alternatives considered

- Keeping the iframe was rejected because it cannot explain MINT SVO matches or model fit in the first-party workflow.
- Direct CKAN vector indexing was deferred because no synchronization path is established in this repository.
- A generic “run complete” dataset badge was rejected because completeness depends on a model and a selected set of datasets.

## Test plan

- Preserve exact CKAN resource annotation matching and paging tests.
- Test first-party browse rendering and iframe removal.
- Test semantic-search and CKAN orchestration with mocked external services.
- Test model compatibility grouping separately from run completeness.
- Run the full UI test suite, typecheck, build, lint, and format checks.

## Documentation plan

This design spec documents the new behavior and implementation boundary. The UI code includes comments where CKAN, SVO, model compatibility, and run completeness are intentionally separated. No new runtime configuration was required.

## Rollout/rollback plan

Rollout is a frontend-only replacement of the browse page. Rollback is to restore the previous `DatasetsBrowse` iframe implementation. No external writes or deployment operations were performed.

## Open questions

- Whether CKAN packages/resources should eventually be indexed directly by Vector Search.
- How the modeling workflow should consume `modelId` and `datasetId` query parameters to prepopulate a new thread.
- Whether spatial filtering should later use named regions or server-side geometry queries in addition to the client-side bounding-box overlap filter.

## Decisions

### 2026-09-17 - SVO-first hybrid search

- **Decision:** Use Vector Search for free-text SVO resolution, then deterministic CKAN annotation matching.
- **Reason:** Both pieces already exist and preserve explainable scientific matching.
- **Impact:** Added `discovery.ts` and canonical annotation helpers without changing the semantic-search service contract.

### 2026-09-17 - Separate compatibility from completeness

- **Decision:** Dataset cards and the side panel show model compatibility/input coverage; complete-run semantics remain model-contextual.
- **Reason:** A dataset can satisfy one input without completing a model run.
- **Impact:** The side panel reports complete/partial input matches and uses distinct actions.

### 2026-09-17 - Simplified MVP filters

- **Decision:** Combine region/spatial coverage in one compact filter, use temporal range sliders, and omit validation, freshness, file-size, and resource-count facets.
- **Reason:** The user identified unsupported or low-value signals for the initial release.
- **Impact:** The listing stays compact; detailed coverage remains on the profile.

### 2026-09-17 - Compatibility side panel

- **Decision:** Load compatible models lazily in a side panel from each dataset result.
- **Reason:** It preserves dataset-list scanability while exposing model fit on demand.
- **Impact:** Added `DatasetCompatibilityPanel.tsx` using the existing generated model-tree query.

### 2026-09-17 - Implementation deviations

**Status:** Superseded by the 2026-09-18 map-based spatial bounding-box decision below.

- **Decision:** The initial spatial control is a coverage-status selector rather than a full named-region/map geometry picker.
- **Reason:** The current browse route does not carry a region geometry and the user did not request a new map-selection API in this implementation pass.
- **Impact:** A true region/map intersection control remains an open follow-up.

### 2026-09-18 — Map-based spatial bounding-box filter

- **Decision:** Replace the coverage-status selector with an interactive map that lets users draw a bounding box; place it to the right of the search/filter card and match the card height.
- **Reason:** A facilitator or data scientist needs to filter by an actual area rather than only whether spatial metadata exists.
- **Alternatives rejected:** Keeping the `Has spatial coverage` / `Spatial coverage unknown` selector was too coarse; adding named-region selection would require a separate region-selection workflow and geometry source.
- **User feedback:** The user requested a map with a bounding box positioned to the right of the search box.
- **Impact on implementation:** Added `DatasetSpatialMap.tsx` and spatial normalization/overlap helpers; dataset results with declared coverage are filtered client-side by overlap, while datasets without usable geometry are excluded when a box is active. Added map rendering and spatial helper tests.

The 2026-09-17 implementation-deviation entry is superseded by this decision.

## User feedback / decisions

- User requested implementation of the clarified dataset discovery design.
- User requested Vector Search → SVO → dataset retrieval for free-text search.
- User clarified that model compatibility and run completeness differ.
- User requested combined region/spatial coverage, temporal slider treatment, minimized spatial display, and a model compatibility side panel.
- User removed validation status, metadata freshness, file size, and resource count from the initial scope.
