---
phase: quick-260411-hb5
plan: 01
subsystem: ui/datacatalog
tags: [filter-toggles, dataset-selection, ckan, lit-element]
status: awaiting-human-verify
key-files:
  modified:
    - ui/src/util/datacatalog/data-catalog-adapter.ts
    - ui/src/util/datacatalog/ckan-data-catalog.ts
    - ui/src/util/datacatalog/default-data-catalog.ts
    - ui/src/screens/modeling/thread/thread-expansion-datasets.ts
decisions:
  - "Toggle state is not persisted (not in Redux or localStorage) — defaults to all-on on each view open"
  - "Variables toggle applies to both queryDatasets and queryResources for consistent UX"
  - "Cache invalidation on toggle uses full cache clear (datasetCache={}, resourceCache={}) rather than targeted removal"
---

# Quick Task 260411-hb5: Add Filtering Info and Toggles (Time, Region, Variables)

**One-liner:** Filter-info panel with Time/Region/Variables toggles on Select datasets step, backed by optional region/dates/variables in the CKAN and Default catalog adapters.

**Status:** Tasks 1 and 2 complete. Awaiting human verification (Task 3 checkpoint).

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Make region optional in adapter + CKAN + Default | `6e5c7b3` | Complete |
| 2 | Add filter info panel + toggles to thread-expansion-datasets | `b89305a` | Complete |
| 3 | Human verification | — | **Pending** |

---

## Task 1: Adapter interface and implementation changes

### File: `ui/src/util/datacatalog/data-catalog-adapter.ts`

**Change:** `IDataCatalog.listDatasetsByVariableNameRegionDates` signature updated — `region` is now optional.

```typescript
// Before
listDatasetsByVariableNameRegionDates(
  driving_variables: string[],
  region: Region,
  dates?: DateRange
): Promise<Dataset[]>;

// After
listDatasetsByVariableNameRegionDates(
  driving_variables: string[],
  region?: Region,
  dates?: DateRange
): Promise<Dataset[]>;
```

### File: `ui/src/util/datacatalog/ckan-data-catalog.ts`

Three NEW guards added (none were pre-existing):

1. **Region guard** — `ext_bbox` is only added to the CKAN query payload when `region` is truthy:
   ```typescript
   let dsQueryData: any = { rows: 1000 };
   if (region) {
     dsQueryData.ext_bbox = `${region.bounding_box.xmin},...`;
   }
   ```

2. **Dates guard** — The temporal-overlap filter block is now wrapped in `if (dates)`. Previously `dates.end_date` and `dates.start_date` were accessed unconditionally (crash when dates is undefined):
   ```typescript
   if (dates) {
     datasetResponse.result.results = datasetResponse.result.results.filter(...);
   }
   ```

3. **Variables guard** — The per-resource variable filter and the "drop zero-resource datasets" step are wrapped in `if (driving_variables && driving_variables.length > 0)`. Previously `resourceMatchesVariables` returned `false` for empty arrays, dropping all datasets:
   ```typescript
   if (driving_variables && driving_variables.length > 0) {
     for (const dataset of datasetResponse.result.results) { ... }
     datasetResponse.result.results = datasetResponse.result.results.filter(...);
   }
   ```

### File: `ui/src/util/datacatalog/default-data-catalog.ts`

Two NEW guards added:

1. **Region null-guard** — Changed `if (!region.geometries) return;` (crashes when region is undefined) to:
   ```typescript
   if (region && !region.geometries) return;
   // ...
   if (region && region.geometries) {
     dsQueryData.spatial_coverage__intersects = region.geometries[0];
   }
   ```

2. **Variables guard** — `standard_variable_names__in` is omitted from the query body when `driving_variables` is empty (consistent with CKAN behavior):
   ```typescript
   if (driving_variables && driving_variables.length > 0) {
     dsQueryData.standard_variable_names__in = driving_variables;
   }
   ```

---

## Task 2: Filter info panel and toggle integration

### File: `ui/src/screens/modeling/thread/thread-expansion-datasets.ts`

**New properties (three `@property` booleans, all defaulting to `true`):**
```typescript
@property({ type: Boolean }) private filterByTime: boolean = true;
@property({ type: Boolean }) private filterByRegion: boolean = true;
@property({ type: Boolean }) private filterByVariables: boolean = true;
```

**New `renderFilterControls()` method:** Renders an "Active filters" panel (styled with existing `.flex-between` and `.tooltip` classes) above the per-model dataset tables. Each row has:
- A `wl-icon` toggle (check_box / check_box_outline_blank) colored blue when on, grey when off
- Filter name (Time, Region, Variables) in a fixed-width span
- Current value span, greyed out (`opacity: 0.5`) when the filter is disabled
  - Time: ISO date range string
  - Region: region name with bbox in `title=` tooltip
  - Variables: "N variables across M inputs" with tooltip listing all variable names

**New `toggleFilter(which)` method:**
```typescript
private toggleFilter(which: "time" | "region" | "variables"): void {
  if (which === "time") this.filterByTime = !this.filterByTime;
  if (which === "region") this.filterByRegion = !this.filterByRegion;
  if (which === "variables") this.filterByVariables = !this.filterByVariables;
  this.datasetCache = {};   // invalidate so renderRequiredDatasetRow re-queries
  this.resourceCache = {};  // resources also depend on the filter args
  this.requestUpdate();
}
```

**Updated `queryDatasets`:** Cache key includes filter flags; adapter receives conditional args:
```typescript
let cacheid = input.id + region.id + ... + "|t=" + this.filterByTime + "|r=" + this.filterByRegion + "|v=" + this.filterByVariables;
// ...
DataCatalogAdapter.getInstance().listDatasetsByVariableNameRegionDates(
  this.filterByVariables ? input.variables : [],
  this.filterByRegion ? region : undefined,
  this.filterByTime ? dates : undefined
);
```

**Updated `queryResources`:** Cache key includes variables flag; `variableNames` is passed as `undefined` when `filterByVariables` is off (consistent UX — user sees unfiltered resources when Variables toggle is OFF):
```typescript
let cacheid = dataset.id + region.id + ... + "|v=" + this.filterByVariables;
// ...
DataCatalogAdapter.getInstance().listResourcesByDataset(
  dataset.id, region, dates,
  this.filterByVariables ? variableNames : undefined
);
```

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None.

---

## Human Verification Pending

Task 3 requires manual verification in a running browser. Steps:

1. Run `yarn start` in `ui/` submodule and open MINT UI.
2. Navigate to a modeling thread with models, required inputs, and a task region + date range set.
3. Advance to "Select datasets" step.
4. Confirm the "Active filters" panel is visible above dataset tables with Time, Region, Variables rows — all toggles ON by default.
5. Toggle Variables OFF: expect more/different datasets; verify no `mint_standard_variables` filtering; open a dataset's resources to confirm they are also unfiltered.
6. Toggle Time OFF: expect datasets outside the thread date range to appear; confirm no JS console errors.
7. Toggle Region OFF: inspect Network tab `package_search` request body — confirm no `ext_bbox` field present.
8. Re-enable all three: confirm dataset list returns to baseline.
9. Confirm no console errors throughout toggle transitions.

**Resume signal:** Type "approved" once all three toggles behave as described, or describe any issues.
