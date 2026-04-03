---
phase: quick
plan: 260326-uar
type: execute
wave: 1
depends_on: []
files_modified:
  - model-catalog-api/src/service.ts
  - model-catalog-api/src/__tests__/service-type-filter.test.ts
autonomous: true
requirements: [BUG-models-endpoint-missing-subtypes]

must_haves:
  truths:
    - "GET /models returns rows with type sdm#Model AND all subclass types (EmpiricalModel, CoupledModel, Emulator, HybridModel, Theory-GuidedModel)"
    - "GET /empiricalmodels still returns only EmpiricalModel rows (exact match unchanged)"
    - "GET /softwares returns all software rows with no type filter (unchanged)"
  artifacts:
    - path: "model-catalog-api/src/service.ts"
      provides: "Updated getSoftwareTypeFilter returning array for models, updated list() using _in for arrays"
      contains: "_in"
    - path: "model-catalog-api/src/__tests__/service-type-filter.test.ts"
      provides: "Unit tests for getSoftwareTypeFilter and list() type filtering"
  key_links:
    - from: "model-catalog-api/src/service.ts#getSoftwareTypeFilter"
      to: "model-catalog-api/src/service.ts#list"
      via: "typeFilter variable consumed in where clause"
      pattern: "_in.*typeFilter|_eq.*typeFilter"
---

<objective>
Fix the /models endpoint to return all Model subclass types, not just exact sdm#Model matches.

Purpose: The /models endpoint currently uses `_eq` to filter by `sdm#Model` type, which excludes EmpiricalModel, CoupledModel, Emulator, HybridModel, and Theory-GuidedModel rows from the response. The OKN ontology defines these as subclasses of Model, so /models should return all of them.

Output: Updated service.ts with array-based type filtering for the models resource.
</objective>

<context>
@model-catalog-api/src/service.ts
@model-catalog-api/src/mappers/resource-registry.ts
</context>

<interfaces>
<!-- From model-catalog-api/src/service.ts -->
```typescript
// Current (buggy) — returns single string
function getSoftwareTypeFilter(resource: string): string | null

// Used in list() as:
// whereConditions.push('type: { _eq: $typeFilter }')
// variables['typeFilter'] = typeFilter
// varDecls += ', $typeFilter: String!'
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix getSoftwareTypeFilter and list() to support array-based type filtering</name>
  <files>model-catalog-api/src/service.ts, model-catalog-api/src/__tests__/service-type-filter.test.ts</files>
  <behavior>
    - getSoftwareTypeFilter('models') returns array of all 6 Model type URIs (Model, EmpiricalModel, CoupledModel, Emulator, HybridModel, Theory-GuidedModel)
    - getSoftwareTypeFilter('empiricalmodels') returns single string 'https://w3id.org/okn/o/sdm#EmpiricalModel' (unchanged behavior)
    - getSoftwareTypeFilter('softwares') returns null (no type filter, unchanged)
    - getSoftwareTypeFilter('persons') returns null (non-software type, unchanged)
    - list() generates `type: { _in: $typeFilter }` with `$typeFilter: [String!]!` when filter is an array
    - list() generates `type: { _eq: $typeFilter }` with `$typeFilter: String!` when filter is a string (subtype endpoints unchanged)
  </behavior>
  <action>
    1. Export `getSoftwareTypeFilter` so it can be tested (add `export` keyword).

    2. Change return type of `getSoftwareTypeFilter` from `string | null` to `string | string[] | null`.

    3. For the `models` key, return an array of all 6 Model type URIs:
       ```
       models: [
         'https://w3id.org/okn/o/sdm#Model',
         'https://w3id.org/okn/o/sdm#EmpiricalModel',
         'https://w3id.org/okn/o/sdm#CoupledModel',
         'https://w3id.org/okn/o/sdm#Emulator',
         'https://w3id.org/okn/o/sdm#HybridModel',
         'https://w3id.org/okn/o/sdm#Theory-GuidedModel',
       ]
       ```
       All other entries in SUBTYPE_MAP remain single strings.

    4. In the `list()` method, after getting `typeFilter`, branch on whether it's an array or string:
       - If `Array.isArray(typeFilter)`: push `'type: { _in: $typeFilter }'` to whereConditions, set `variables['typeFilter'] = typeFilter`, and append `', $typeFilter: [String!]!'` to varDecls.
       - If string (not array): keep existing `_eq` logic unchanged.

    5. Create test file `model-catalog-api/src/__tests__/service-type-filter.test.ts` that imports the exported `getSoftwareTypeFilter` and tests:
       - 'models' returns array of 6 URIs containing all subclass types
       - 'empiricalmodels' returns single string
       - 'hybridmodels' returns single string
       - 'coupledmodels' returns single string
       - 'emulators' returns single string
       - 'theory_guidedmodels' returns single string (underscore alias)
       - 'theory-guidedmodels' returns single string (hyphen variant)
       - 'softwares' returns null
       - 'persons' returns null
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint/model-catalog-api && npx vitest run src/__tests__/service-type-filter.test.ts</automated>
  </verify>
  <done>
    - getSoftwareTypeFilter('models') returns 6-element array of all Model subclass URIs
    - list() builds _in filter for arrays, _eq for strings
    - All individual subtype endpoints (empiricalmodels, etc.) still use exact _eq match
    - All tests pass
  </done>
</task>

</tasks>

<verification>
- `cd model-catalog-api && npx vitest run` -- all tests pass (existing + new)
- `cd model-catalog-api && npx tsc --noEmit` -- no type errors
</verification>

<success_criteria>
- GET /models generates GraphQL with `type: { _in: [...] }` containing all 6 Model subclass URIs
- GET /empiricalmodels (and other subtypes) generates GraphQL with `type: { _eq: "..." }` for exact match
- GET /softwares generates GraphQL with no type filter
- All unit tests pass
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260326-uar-fix-model-not-returned-by-v2-api-id-mism/260326-uar-SUMMARY.md`
</output>
