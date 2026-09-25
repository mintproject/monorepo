# Region subcategory creation

Status: Implemented

## Objective

Make the plus button beside the region tabs create a persistent child category
under the currently viewed top-level region category, such as `Aquifer GAMs`
under `Hydrology`, while keeping shared catalog writes behind the existing
curator authorization boundary.

This phase covers child-category creation only. It does not add category
rename/delete/re-parent controls, bulk category import, or model-file
registration; those remain separate workflows.

## User need

### Primary user

An authenticated region curator who manages the shared MINT region catalog.

### Secondary users

Authenticated and anonymous catalog users who browse the resulting category
tabs and regions but do not manage the shared category hierarchy.

### Job-to-be-done

Create a meaningful region grouping before loading its region boundaries, so
GAM footprints and other hydrology boundary sets can be organized and selected
independently.

### Current pain

The plus button is rendered beside the Hydrology/Watersheds tabs but is
disabled. A curator cannot create a new child category from the UI and must
use direct database/admin operations.

### Definition of success

From a category page, a curator can click plus, enter a subcategory name and
optional citation, submit it, and immediately see the new tab selected. The
subcategory remains available after a reload, and a non-curator cannot create
one by calling either the UI or the API directly.

## Current code/system summary

- `ui-react/src/pages/regions/RegionsEditor.tsx` renders the plus button and
  uses the existing curator access check to enable the creation dialog.
- `useListRegionCategoriesWithHierarchy` reads `region_category` and derives
  child tabs from `region_category_tree`.
- PostgreSQL already has `region_category(id, name, citation)` and
  `region_category_tree(region_category_id, region_category_parent_id)` with
  foreign keys and a composite primary key.
- Hasura metadata exposes anonymous/user reads and currently allows the `user`
  role to insert both category and category-tree rows.
- `model-catalog-api` already validates Tapis bearer tokens, checks the
  operator-managed `region_curator` table, and performs admin-secret Hasura
  writes for region imports.
- The region-import API is the established pattern for keeping large/shared
  writes out of the browser's direct Hasura mutation path.

## Proposed design

### 1. Curator-gated category API

Add one custom model-catalog-api handler:

- `POST /v2.0.0/regions/categories`
  - Accept `{ parent_category_id, name, citation? }`.
  - Reuse the existing Tapis identity and `region_curator` authorization.
  - Return `401` for missing/invalid credentials and `403` for a valid
    non-curator before attempting any write.
  - Validate that the parent exists, the name is non-empty and bounded, the
    parent is a top-level category, and the resulting child identifier is
    unique.
  - Generate a stable slug identifier from the submitted name. The API owns
    this normalization so clients cannot create inconsistent IDs.
  - Insert the category and its parent relationship atomically through the
    Hasura admin client.
  - Return the created `{ id, name, citation, parent_category_id }`.
  - Return structured `400`, `401`, `403`, `409`, and `502/503` errors.

### 2. Hasura permission boundary

Remove ordinary `user` insert permissions for `region_category` and
`region_category_tree`. Keep their anonymous/user select permissions. The API
becomes the only supported category-creation path and uses the admin secret
only after curator authorization succeeds.

### 3. UI workflow

- Replace the disabled plus button with an enabled button only when the
  existing `GET /regions/import/access` curator check succeeds. This check is
  a presentation optimization; the category POST repeats authorization.
- Open a small dialog containing:
  - required display name;
  - optional citation/source text;
  - submit and cancel actions.
- Call the category API with the current parent category ID.
- On success, refetch the category hierarchy, select the returned child ID,
  and leave region loading to the existing Add regions workflow.
- Display duplicate, authorization, validation, and service errors in the
  dialog without retrying a request that may have committed.
- Keep the existing plus button visually distinct from the Add regions button:
  plus creates a category; Add regions loads geometries into that category.

## Files likely affected

- `model-catalog-api/src/region-category.ts` (new shared category handler)
- `model-catalog-api/src/custom-handlers.ts`
- `model-catalog-api/src/app.ts` or custom OpenAPI routing registration
- `model-catalog-api/openapi.yaml`
- `model-catalog-api/README.md`
- `model-catalog-api/src/__tests__/region-import.test.ts` (category validation
  coverage alongside existing import authorization tests)
- `ui-react/src/lib/region-category-api.ts` (new API client)
- `ui-react/src/pages/regions/RegionsEditor.tsx`
- `ui-react/src/pages/regions/useRegionCategories.ts`
- `ui-react/src/lib/__tests__/region-category-api.test.ts`
- `graphql_engine/metadata/tables.yaml`
- `compose/README.md` if the curator workflow/configuration documentation
  needs a new entry
- this design spec, for implementation status and decisions

## API/schema changes

- Add one custom REST operation under `/v2.0.0/regions/categories`.
- Add no database columns or tables; the existing category and tree tables are
  sufficient.
- Remove Hasura `user` insert permissions for `region_category` and
  `region_category_tree`.
- Keep the existing read schema and generated category query unchanged.
- No category delete, rename, or re-parent operation is included in this
  phase.

## Data flow

```text
Curator clicks plus
  -> UI reuses the existing region-curator access check
  -> dialog submits parent + name + citation
  -> model-catalog-api verifies bearer JWT and region_curator row
  -> API validates parent and slug
  -> Hasura admin mutation writes category + tree edge atomically
  -> API returns created category
  -> UI refetches category hierarchy and selects new tab
  -> existing Add regions workflow loads boundaries into that category
```

## Risks and tradeoffs

- Removing direct Hasura inserts is a compatibility change for any undocumented
  clients that create categories directly; the repository search and local
  tests should confirm no supported caller relies on that path.
- Slug generation can produce collisions for names that normalize similarly;
  the API must return a clear `409` and never silently overwrite an existing
  category.
- A category can be created without regions, which is intentional so the user
  can create the grouping first and load data afterward.
- Reusing the region-curator table centralizes authorization but means category
  management and region import currently share the same permission level.
- The API continues to depend on the configured Tapis key endpoint for writes;
  read-only browsing remains available when curator authorization is down.

## Alternatives considered

- **Enable the existing Hasura mutation directly from the button:** rejected;
  it would make a shared taxonomy write available to every `user` role and
  would bypass the curator authorization already established for region
  imports.
- **Hardcode `gams` in the frontend:** rejected; it would not support other
  curator-managed boundary groupings and would not persist a true category
  hierarchy.
- **Create categories only with SQL/admin tooling:** rejected; it leaves the
  curator workflow disconnected from the region-loading workflow.
- **Add a separate category service/database:** rejected; the existing tables,
  API, and curator authorization are sufficient.

## Test plan

- API tests for missing/invalid credentials, non-curator denial, parent
  validation, name normalization, duplicate slug conflicts, and successful
  atomic creation.
- API tests proving no Hasura mutation occurs when validation or authorization
  fails.
- UI tests for hidden/disabled behavior before access resolves, dialog submit,
  error display, hierarchy refetch, and selecting the new tab.
- Metadata validation proving ordinary `user` cannot insert category or tree
  rows while anonymous/user reads continue to work.
- Typecheck, focused unit tests, API build, Compose metadata validation, and
  `git diff --check`.

## Documentation plan

- Document the category endpoints, curator requirement, slug behavior, and
  relationship to region imports in the model-catalog API README/OpenAPI.
- Update local Compose notes if the category authorization workflow changes
  operator setup instructions.
- Update this spec to `Implemented` and record deviations after QA.

## Rollout/rollback plan

1. Add the API and UI workflow while existing category rows remain untouched.
2. Verify curator creation and anonymous/user reads locally.
3. Remove direct Hasura user inserts after the API path is working.
4. Roll back by restoring the two metadata insert permissions and hiding the
   button; existing categories and tree edges remain intact.

## Open questions

None for this implementation phase. The approved defaults are: active region
curators may create categories, citation is optional free text, and the new
subcategory is selected automatically after creation.

## Decisions

- The plus button creates taxonomy, while Add regions loads geometry data into
  the selected taxonomy node.
- GAMs should be represented as a child category such as `Aquifer GAMs`, with
  individual GAM footprints represented as regions under that category.
- Category creation follows the existing curator/API boundary rather than
  adding a direct browser Hasura mutation.

### 2026-09-24 — Approve curator-gated subcategory creation

- **Decision:** Implement the plus button as a curator-gated category creation
  workflow using the existing region-curator authorization boundary.
- **Reason:** The user needs to create groupings such as `Aquifer GAMs` from
  the same screen where their boundaries will later be loaded, without
  exposing shared taxonomy writes to ordinary users.
- **Alternatives rejected:** Direct browser Hasura mutation was rejected
  because the current `user` insert permission would bypass curator policy;
  hardcoded `gams` was rejected because the hierarchy must support future
  boundary groupings.
- **User feedback:** User approved the design with “do it”.
- **Impact on implementation:** Add the authenticated category API, remove
  ordinary Hasura category inserts, add the UI dialog/refetch flow, and test
  both authorization and persistence.

### 2026-09-24 — Implementation result

- **Result:** Implemented the curator-gated `POST /v2.0.0/regions/categories`
  endpoint, removed ordinary Hasura user insert permissions for category and
  tree rows, and wired the plus button to create and select a new child tab.
- **Verification:** API/UI builds, focused API-client and validation tests,
  lint/format checks, Compose rebuild, Hasura metadata initialization, and a
  browser smoke check all passed. The live smoke check opened the dialog but
  did not create a test category or mutate local catalog data.
- **Deviation:** The existing `/regions/import/access` check is reused for
  the UI enablement decision, while the new category endpoint repeats the
  curator authorization server-side as designed.

## User feedback / decisions

- 2026-09-24: User confirmed the plus button should become functional so a
  GAM-oriented subcategory can be created from the UI. Detailed permission and
  citation choices remain open for review.
