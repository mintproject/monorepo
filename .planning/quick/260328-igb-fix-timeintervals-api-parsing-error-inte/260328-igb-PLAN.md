---
phase: quick-260328-igb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - model-catalog-api/src/mappers/request.ts
  - model-catalog-api/src/__tests__/request-mapper.test.ts
autonomous: true
requirements: [FIX-TIMEINTERVAL-PARSE]

must_haves:
  truths:
    - "POST /timeintervals with intervalUnit:[{}] no longer returns a 500 parsing error"
    - "POST /timeintervals with intervalUnit:['seconds'] correctly stores 'seconds' as interval_unit"
    - "POST /timeintervals with intervalUnit:[] omits interval_unit (treated as null)"
    - "Other scalar fields with object values are also safely handled (not just intervalUnit)"
  artifacts:
    - path: "model-catalog-api/src/mappers/request.ts"
      provides: "Sanitized unwrapValue that rejects non-primitive values for scalar columns"
      contains: "typeof.*object"
    - path: "model-catalog-api/src/__tests__/request-mapper.test.ts"
      provides: "Unit tests for toHasuraInput covering object-in-array edge cases"
      contains: "intervalUnit"
  key_links:
    - from: "model-catalog-api/src/mappers/request.ts"
      to: "model-catalog-api/src/service.ts"
      via: "toHasuraInput called in create() and update()"
      pattern: "toHasuraInput"
---

<objective>
Fix the timeintervals API parsing error where sending `"intervalUnit":[{}]` (an array containing an empty object) causes a 500 error: "parsing Text failed, expected String, but encountered Object".

Purpose: The `unwrapValue` function in `request.ts` unwraps single-element arrays, so `[{}]` becomes `{}`. This object is then passed to Hasura as a value for the `interval_unit` Text column, which cannot parse an Object as a String. The fix must sanitize unwrapped values to reject non-primitive types before they reach Hasura.

Output: Patched `request.ts` with tests proving the fix.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@model-catalog-api/src/mappers/request.ts
@model-catalog-api/src/service.ts
@model-catalog-api/src/hasura/field-maps.ts

<interfaces>
<!-- Key flow: service.ts calls toHasuraInput(body, resourceConfig) which calls unwrapValue() -->

From model-catalog-api/src/mappers/request.ts:
```typescript
export function toHasuraInput(
  body: Record<string, unknown>,
  resourceConfig: ResourceConfig,
): Record<string, unknown>

// unwrapValue unwraps single-element arrays: ["val"] -> "val", [{}] -> {} (BUG)
function unwrapValue(value: unknown): unknown
```

From model-catalog-api/src/hasura/field-maps.ts:
```
// modelcatalog_time_interval columns are all Text:
// id, label, description, interval_value, interval_unit
```

The bug: `unwrapValue([{}])` returns `{}` which Hasura rejects for Text columns.
The fix: After unwrapping, check if the result is a non-null object -- if so, treat as null (skip it).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add tests for toHasuraInput with object-in-array edge cases</name>
  <files>model-catalog-api/src/__tests__/request-mapper.test.ts</files>
  <behavior>
    - Test: unwrapValue([{}]) should be treated as null (field omitted from output)
    - Test: unwrapValue([{nested: "obj"}]) should be treated as null (field omitted)
    - Test: unwrapValue(["valid string"]) should return "valid string"
    - Test: unwrapValue([42]) should return 42
    - Test: unwrapValue([]) should return null
    - Test: Full toHasuraInput with body matching the failing request: {"intervalUnit":[{}],"description":["desc"],"label":["label"],"type":["TimeInterval"],"intervalValue":["1"]} should produce {description: "desc", label: "label", interval_value: "1"} with NO interval_unit key
    - Test: toHasuraInput with valid intervalUnit: {"intervalUnit":["seconds"]} should produce {interval_unit: "seconds"}
  </behavior>
  <action>
    Create test file `model-catalog-api/src/__tests__/request-mapper.test.ts` that imports `toHasuraInput` and `camelToSnake` from `../mappers/request.js`.

    For the toHasuraInput tests, create a minimal ResourceConfig matching the timeintervals config:
    ```typescript
    const timeintervalConfig = {
      hasuraTable: 'modelcatalog_time_interval',
      typeUri: 'https://w3id.org/okn/o/sdm#TimeInterval',
      typeName: 'TimeInterval',
      typeArray: ['TimeInterval'],
      idPrefix: 'https://w3id.org/okn/i/mint/',
      relationships: {},
    }
    ```

    Write failing tests first. The tests for object-in-array should FAIL initially because the current `unwrapValue` returns `{}` instead of null.

    Run tests to confirm they fail (RED phase).
  </action>
  <verify>
    <automated>cd model-catalog-api && npx vitest run src/__tests__/request-mapper.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>Tests exist and the object-in-array tests fail as expected (RED), proving the bug is captured</done>
</task>

<task type="auto">
  <name>Task 2: Fix unwrapValue to reject non-primitive values for scalar columns</name>
  <files>model-catalog-api/src/mappers/request.ts</files>
  <action>
    In `model-catalog-api/src/mappers/request.ts`, modify the `unwrapValue` function to sanitize unwrapped values. After unwrapping, if the result is a non-null object (not a primitive), return null so the field gets omitted.

    Change `unwrapValue` to:
    ```typescript
    function unwrapValue(value: unknown): unknown {
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        if (value.length === 1) {
          const item = value[0];
          // Reject non-primitive values (objects, arrays) -- Hasura scalar columns
          // cannot store objects. This handles cases like intervalUnit:[{}] where
          // the client sends an empty object placeholder instead of a string value.
          if (item !== null && typeof item === 'object') return null;
          return item;
        }
        // Multi-element arrays: filter out non-primitive items
        const filtered = value.filter(
          (item) => item === null || typeof item !== 'object'
        );
        return filtered.length > 0 ? filtered : null;
      }
      // Non-array objects at top level should also be rejected for scalar columns
      if (value !== null && typeof value === 'object') return null;
      return value;
    }
    ```

    This ensures:
    - `[{}]` -> null (empty object rejected)
    - `[{key: "val"}]` -> null (non-empty object also rejected)
    - `["seconds"]` -> "seconds" (valid string preserved)
    - `[42]` -> 42 (valid number preserved)
    - `[true]` -> true (valid boolean preserved)
    - `["a", {}, "b"]` -> ["a", "b"] (objects filtered from multi-element arrays)

    Run the tests to confirm they pass (GREEN phase).
  </action>
  <verify>
    <automated>cd model-catalog-api && npx vitest run src/__tests__/request-mapper.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>All tests pass. unwrapValue correctly rejects non-primitive values, preventing the "parsing Text failed" error when Hasura receives object values for Text columns.</done>
</task>

</tasks>

<verification>
1. All unit tests pass: `cd model-catalog-api && npx vitest run src/__tests__/request-mapper.test.ts`
2. Existing tests still pass: `cd model-catalog-api && npx vitest run`
3. The specific failing request body `{"intervalUnit":[{}],"description":["desc"],"label":["label"],"type":["TimeInterval"],"intervalValue":["1"]}` is covered by a test that proves `interval_unit` is omitted from the Hasura input
</verification>

<success_criteria>
- toHasuraInput no longer passes object values to Hasura for scalar Text columns
- The exact request body from the bug report produces valid Hasura input (no interval_unit key)
- Valid string values like `["seconds"]` for intervalUnit still work correctly
- All existing tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/260328-igb-fix-timeintervals-api-parsing-error-inte/260328-igb-SUMMARY.md`
</output>
