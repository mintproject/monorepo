---
phase: quick-260405-nrv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/src/screens/modeling/actions.ts
  - ui/src/queries/model/list-in.graphql
  - ui/src/queries/model/new.graphql
  - ui/src/queries/emulator/get-model-type-configs.graphql
  - ui/src/util/graphql_adapter.ts
autonomous: true
requirements: [NRV-01]

must_haves:
  truths:
    - "UI no longer sends GraphQL queries referencing the deleted 'model' table"
    - "cacheModelsFromCatalog callers continue to work without errors"
    - "Dead GraphQL query files are removed"
  artifacts:
    - path: "ui/src/screens/modeling/actions.ts"
      provides: "No-op cacheModelsFromCatalog, removed imports of deleted queries"
    - path: "ui/src/util/graphql_adapter.ts"
      provides: "Removed dead threadModelsToGQL and modelToGQL functions"
  key_links:
    - from: "ui/src/screens/modeling/thread/thread-expansion-models.ts"
      to: "cacheModelsFromCatalog"
      via: "function call in save()"
      pattern: "await cacheModelsFromCatalog"
    - from: "ui/src/screens/modeling/thread/mint-models.ts"
      to: "cacheModelsFromCatalog"
      via: "function call"
      pattern: "await cacheModelsFromCatalog"
---

<objective>
Fix runtime GraphQL error "field 'model' not found in type: 'query_root'" by removing all references to the deleted `model` table.

Purpose: The `model` table was removed during DYNAMO v2.0 migration (Phase 09). The `cacheModelsFromCatalog` function queries this table and fails at runtime. Since `thread_model` now references `modelcatalog_configuration_id` directly, the caching step is obsolete.

Output: Clean UI code with no references to the deleted `model` table.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ui/src/screens/modeling/actions.ts
@ui/src/screens/modeling/thread/thread-expansion-models.ts
@ui/src/screens/modeling/thread/mint-models.ts
@ui/src/util/graphql_adapter.ts
@ui/src/queries/model/list-in.graphql
@ui/src/queries/model/new.graphql
@ui/src/queries/emulator/get-model-type-configs.graphql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Neutralize cacheModelsFromCatalog and remove dead model-table code</name>
  <files>
    ui/src/screens/modeling/actions.ts
    ui/src/util/graphql_adapter.ts
  </files>
  <action>
In `ui/src/screens/modeling/actions.ts`:
1. Remove the imports of `listExistingModelsGQL` (from "../../queries/model/list-in.graphql") and `newModelsGQL` (from "../../queries/model/new.graphql") — lines 49-50.
2. Remove the import of `modelToGQL` and `threadModelsToGQL` from the graphql_adapter import block (line 71-72). Keep all other imports from that block.
3. Remove the import of `fetchModelsFromCatalog` from "screens/models/actions" (line 88).
4. Replace the body of `cacheModelsFromCatalog` (lines 1099-1146) with an early return. Keep the function signature and export so callers do not break. Add a comment explaining why:
```typescript
export const cacheModelsFromCatalog = async (
  models: Model[],
  allSoftwareImages: IdMap<SoftwareImage>,
  allConfigs: IdMap<ModelConfiguration>,
  allVersions: IdMap<SoftwareVersion>,
  allModels: IdMap<MCModel>
) => {
  // No-op: The local 'model' caching table was removed in DYNAMO v2.0.
  // thread_model now references modelcatalog_configuration_id directly.
  return;
};
```

In `ui/src/util/graphql_adapter.ts`:
1. Remove the `threadModelsToGQL` function (lines 420-433). It references `modelToGQL` and builds objects for the deleted `model` table. It is imported but never called.
2. Remove the `modelToGQL` function (lines 661+). It builds insert objects for the deleted `model` table. After removing cacheModelsFromCatalog's body and threadModelsToGQL, it has no callers.
3. Remove these two functions from the file's exports if they appear in an export block.
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint/ui && grep -rn "listExistingModelsGQL\|newModelsGQL\|modelToGQL\|threadModelsToGQL\|fetchModelsFromCatalog" src/screens/modeling/actions.ts src/util/graphql_adapter.ts; echo "exit: $?"</automated>
  </verify>
  <done>
    - cacheModelsFromCatalog is a no-op with preserved signature
    - No imports referencing deleted model query files remain in actions.ts
    - modelToGQL and threadModelsToGQL removed from graphql_adapter.ts
    - No references to fetchModelsFromCatalog in modeling/actions.ts
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete dead GraphQL query files</name>
  <files>
    ui/src/queries/model/list-in.graphql
    ui/src/queries/model/new.graphql
    ui/src/queries/emulator/get-model-type-configs.graphql
  </files>
  <action>
1. Delete `ui/src/queries/model/list-in.graphql` — queries the deleted `model` table, no longer imported after Task 1.
2. Delete `ui/src/queries/model/new.graphql` — mutation for the deleted `model` table, no longer imported after Task 1.
3. Delete `ui/src/queries/emulator/get-model-type-configs.graphql` — queries the deleted `model` table, confirmed not imported anywhere in the codebase (dead code).
4. If `ui/src/queries/model/` directory is now empty, remove the directory.
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint/ui && test ! -f src/queries/model/list-in.graphql && test ! -f src/queries/model/new.graphql && test ! -f src/queries/emulator/get-model-type-configs.graphql && echo "PASS: all dead query files deleted" || echo "FAIL: some files still exist"</automated>
  </verify>
  <done>
    - All three dead GraphQL files deleted
    - No remaining .graphql files reference the deleted `model` table
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify build compiles without errors</name>
  <files></files>
  <action>
Run the UI build to confirm no compile-time errors from the removed imports and functions. If TypeScript compilation errors appear, fix them — likely candidates:
- Unused import warnings (remove stale imports)
- Missing export references (check no other file imports modelToGQL or threadModelsToGQL)

Search the entire ui/src directory for any remaining references to the three deleted .graphql files or to `modelToGQL`/`threadModelsToGQL` and fix any found.
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint/ui && npx tsc --noEmit 2>&1 | head -50</automated>
  </verify>
  <done>
    - TypeScript compilation succeeds with no errors related to removed code
    - No remaining references to deleted model table queries anywhere in ui/src
  </done>
</task>

</tasks>

<verification>
1. `grep -rn "query.*model\b\|mutation.*model\b\|insert_model\|model_pkey" ui/src/queries/` should return no hits referencing the old `model` table
2. `grep -rn "modelToGQL\|threadModelsToGQL" ui/src/` should return no hits
3. TypeScript compiles cleanly: `cd ui && npx tsc --noEmit`
</verification>

<success_criteria>
- The "field 'model' not found in type: 'query_root'" GraphQL error no longer occurs at runtime
- cacheModelsFromCatalog is a safe no-op preserving its call signature
- All dead code referencing the removed model table is cleaned up
- UI compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260405-nrv-fix-graphql-query-referencing-old-model-/260405-nrv-SUMMARY.md`
</output>
