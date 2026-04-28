# Phase 12: Support optional `hasInput` on model configuration - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/up.sql` | migration | batch | `graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/up.sql` | exact |
| `graphql_engine/metadata/tables.yaml` (modelcatalog_configuration_input section) | config | CRUD | `tables.yaml` lines 3088-3119 (current junction entry) | exact |
| `model-catalog-api/src/mappers/resource-registry.ts` (hasInput entries) | config | CRUD | `resource-registry.ts` lines 202-209 and 286-293 (existing hasInput entries) | exact |
| `model-catalog-api/src/hasura/field-maps.ts` (inputs block) | config | CRUD | `field-maps.ts` lines 216-225 (current inputs block) | exact |
| `model-catalog-api/src/service.ts` (PUT junction row build) | service | CRUD | `service.ts` lines 295-315 (junction insert variable map) | role-match |
| `model-catalog-api/openapi.yaml` (DatasetSpecification schema) | config | request-response | `openapi.yaml` lines 14021-14030 (position field pattern) | role-match |
| `mint-ensemble-manager/src/classes/mint/mint-types.ts` (ModelIO interface) | model | request-response | `mint-types.ts` lines 332-338 (existing ModelIO interface) | exact |
| `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` (modelIOFromCatalogGQL) | service | request-response | `graphql_adapter.ts` lines 480-510 (existing modelFromGQL + modelIOFromCatalogGQL) | exact |
| `mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql` | config | request-response | current file lines 8-16 (inputs junction selection) | exact |
| `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql` | config | request-response | current file lines 24-31 (inputs junction selection) | exact |
| `mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts` (createJobFileInputsFromSeed) | service | request-response | current file lines 103-127 (existing skip/throw logic) | exact |
| `mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts` | test | request-response | current file lines 1-19 (test structure) | exact |
| `mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/app.ts` | test | request-response | current file lines 85-157 (fileInputs with inputMode) | exact |

---

## Pattern Assignments

### `graphql_engine/migrations/1771200016000_modelcatalog_configuration_input_is_optional/up.sql` (migration, batch)

**Analog:** `graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/up.sql`

**Core pattern** (lines 1-4 of analog):
```sql
BEGIN;
ALTER TABLE modelcatalog_parameter
    ADD COLUMN has_accepted_values TEXT[];
COMMIT;
```

**Apply as** (new migration):
```sql
BEGIN;
ALTER TABLE modelcatalog_configuration_input
    ADD COLUMN is_optional BOOLEAN NOT NULL DEFAULT FALSE;
COMMIT;
```

**Key notes:**
- `NOT NULL DEFAULT FALSE` follows D-04: existing junction rows backfill automatically; no separate UPDATE needed.
- PK `(configuration_id, input_id)` stays unchanged.
- Migration directory must be named `1771200016000_modelcatalog_configuration_input_is_optional/` — next in sequence after `1771200015000_thread_model_io_fk/`.

---

### `graphql_engine/metadata/tables.yaml` — modelcatalog_configuration_input section (config, CRUD)

**Analog:** `graphql_engine/metadata/tables.yaml` lines 3088-3119 (current `modelcatalog_configuration_input` entry)

**Current entry** (lines 3088-3119):
```yaml
- table:
    name: modelcatalog_configuration_input
    schema: public
  object_relationships:
  - name: configuration
    using:
      foreign_key_constraint_on: configuration_id
  - name: input
    using:
      foreign_key_constraint_on: input_id
  insert_permissions:
  - role: user
    permission:
      check: {}
      columns: &id007
      - configuration_id
      - input_id
  select_permissions:
  - role: anonymous
    permission:
      columns:
      - configuration_id
      - input_id
      filter: {}
  - role: user
    permission:
      columns: *id007
      filter: {}
  delete_permissions:
  - role: user
    permission:
      filter: {}
```

**Modified entry** — add `is_optional` to all column lists:
```yaml
- table:
    name: modelcatalog_configuration_input
    schema: public
  object_relationships:
  - name: configuration
    using:
      foreign_key_constraint_on: configuration_id
  - name: input
    using:
      foreign_key_constraint_on: input_id
  insert_permissions:
  - role: user
    permission:
      check: {}
      columns: &id007
      - configuration_id
      - input_id
      - is_optional
  select_permissions:
  - role: anonymous
    permission:
      columns:
      - configuration_id
      - input_id
      - is_optional
      filter: {}
  - role: user
    permission:
      columns: *id007
      filter: {}
  delete_permissions:
  - role: user
    permission:
      filter: {}
```

**Key notes:**
- Junction tables have insert+delete only — no update_permissions block. The `is_optional` column must be added to insert_permissions and both select_permissions roles.
- The anonymous select permission uses an inline column list (not the `*id007` anchor) — add `is_optional` there too.

---

### `model-catalog-api/src/mappers/resource-registry.ts` — hasInput entries (config, CRUD)

**Analog:** `resource-registry.ts` lines 202-209 (modelconfigurations) and lines 286-293 (modelconfigurationsetups)

**Current entries:**
```typescript
// modelconfigurations (lines 202-209)
hasInput: {
  hasuraRelName: 'inputs',
  type: 'array',
  junctionTable: 'modelcatalog_configuration_input',
  junctionRelName: 'input',
  parentFkColumn: 'configuration_id',
  targetResource: 'datasetspecifications',
},

// modelconfigurationsetups (lines 286-293)
hasInput: {
  hasuraRelName: 'inputs',
  type: 'array',
  junctionTable: 'modelcatalog_configuration_input',
  junctionRelName: 'input',
  parentFkColumn: 'configuration_id',
  targetResource: 'datasetspecifications',
},
```

**What to add:** A new optional field `junctionColumns` on `RelationshipConfig` interface (lines 9-27) and on both `hasInput` entries to advertise the `is_optional` junction column. The `RelationshipConfig` interface (lines 9-27) must gain:

```typescript
/**
 * Extra scalar columns stored on the junction row itself (beyond the two FK columns).
 * Used by the PUT path in service.ts to pass per-row extra data.
 * Map from junction column name to the corresponding camelCase key in the request body item.
 */
junctionColumns?: Record<string, string>;
```

Both `hasInput` entries become:
```typescript
hasInput: {
  hasuraRelName: 'inputs',
  type: 'array',
  junctionTable: 'modelcatalog_configuration_input',
  junctionRelName: 'input',
  parentFkColumn: 'configuration_id',
  targetResource: 'datasetspecifications',
  junctionColumns: { is_optional: 'isOptional' },
},
```

**Key note:** `buildJunctionInserts` in `request.ts` and the PUT path in `service.ts` must be updated to read `relConfig.junctionColumns` and include those columns in the junction row object. See service.ts pattern below.

---

### `model-catalog-api/src/hasura/field-maps.ts` — inputs block (config, CRUD)

**Analog:** `field-maps.ts` lines 216-225 (current inputs block inside `modelcatalog_configuration`)

**Current block:**
```typescript
inputs {
  input {
    id
    label
    description
    has_format
    has_dimensionality
    position
  }
}
```

**Modified block** — add `is_optional` as a sibling of `input` on the junction row:
```typescript
inputs {
  is_optional
  input {
    id
    label
    description
    has_format
    has_dimensionality
    position
  }
}
```

**Key note:** `is_optional` lives on the junction row (`modelcatalog_configuration_input`), not on the `input` nested object (`modelcatalog_dataset_specification`). It must appear at the same level as `input {…}`, before the nested object.

---

### `model-catalog-api/src/service.ts` — PUT junction row variable build (service, CRUD)

**Analog:** `service.ts` lines 295-315 (existing junction insert variable-map in the `update` method)

**Current pattern** (lines 302-311):
```typescript
variables[varName] = items.map((item: Record<string, unknown>) => {
  const rawItemId = item['id'] as string | undefined
  const targetId = rawItemId
    ? rawItemId.startsWith('https://') ? rawItemId : `${ID_PREFIX}${rawItemId}`
    : `${ID_PREFIX}${randomUUID()}`
  return {
    [relConfig.parentFkColumn!]: fullId,
    [targetFkColumn]: targetId,
  }
})
```

**Modified pattern** — include `junctionColumns` extra fields in each row:
```typescript
variables[varName] = items.map((item: Record<string, unknown>) => {
  const rawItemId = item['id'] as string | undefined
  const targetId = rawItemId
    ? rawItemId.startsWith('https://') ? rawItemId : `${ID_PREFIX}${rawItemId}`
    : `${ID_PREFIX}${randomUUID()}`
  const row: Record<string, unknown> = {
    [relConfig.parentFkColumn!]: fullId,
    [targetFkColumn]: targetId,
  }
  // Include any extra junction-row columns (e.g., is_optional)
  if (relConfig.junctionColumns) {
    for (const [colName, camelKey] of Object.entries(relConfig.junctionColumns)) {
      if (item[camelKey] !== undefined) row[colName] = item[camelKey]
    }
  }
  return row
})
```

**Key note:** Same pattern applies to the CREATE path in `buildJunctionInserts` (`request.ts` lines 186-230): when building the junction row object inside `data: items.map(...)`, check `relConfig.junctionColumns` and spread those columns onto the junction row (not onto the nested `data:` for the target entity).

---

### `model-catalog-api/openapi.yaml` — DatasetSpecification schema (config, request-response)

**Analog:** `openapi.yaml` lines 14021-14030 (the `position` field pattern — also an integer, nullable, array-of-one)

**Analog pattern** (lines 14021-14030):
```yaml
position:
  description:
    Position of the parameter or input/output in the model configuration.
    This property is needed to know how to organize the I/O of the component
    on execution
  items:
    format: int32
    type: integer
  nullable: true
  type: array
```

**New field to add** inside `DatasetSpecification` properties (line ~14034, after `position`):
```yaml
isOptional:
  description: >-
    When true, this input is optional for the configuration.
    Ensemble manager will skip it during Tapis job submission if no dataset
    is bound, rather than failing with an error.
  nullable: true
  type: boolean
```

**Key notes:**
- `isOptional` is camelCase in the API (OpenAPI/JSON) to match the existing API conventions (e.g., `hasDimensionality`, `hasFormat`).
- It is a flat boolean (not an array) because optionality is a single flag per junction row, not a multi-valued property.
- This field is junction-level metadata that surfaces flattened onto each input item inside `ModelConfiguration.hasInput[]` — the DatasetSpecification schema serves as the input item shape.

---

### `mint-ensemble-manager/src/classes/mint/mint-types.ts` — ModelIO interface (model, request-response)

**Analog:** `mint-types.ts` lines 332-338 (existing `ModelIO` interface)

**Current interface** (lines 332-338):
```typescript
export interface ModelIO extends IdNameObject {
    type?: string;
    variables: string[];
    value?: Dataslice;
    position?: number;
    format?: string;
}
```

**Modified interface** — add `is_optional`:
```typescript
export interface ModelIO extends IdNameObject {
    type?: string;
    variables: string[];
    value?: Dataslice;
    position?: number;
    format?: string;
    is_optional?: boolean;
}
```

**Key note:** Use `is_optional` (snake_case) to mirror how the junction column is named in Postgres and how the GraphQL field will be named after codegen. The `?` makes it optional — default is `false` (treated as required) when absent.

---

### `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` — modelFromGQL + modelIOFromCatalogGQL (service, request-response)

**Analog:** `graphql_adapter.ts` lines 480-510 (existing `modelFromGQL` and `modelIOFromCatalogGQL`)

**Current code** (lines 480-510):
```typescript
export const modelFromGQL = (config: any): Model => {
    return {
        id: config.id,
        name: config.label || config.id,
        description: config.description || "",
        category: "",
        region_name: "",
        model_configuration: config.model_configuration_id || null,
        software_image: config.has_software_image || "",
        code_url: config.has_component_location || "",
        input_files: (config.inputs || []).map((row: any) => modelIOFromCatalogGQL(row.input)),
        output_files: (config.outputs || []).map((row: any) => modelIOFromCatalogGQL(row.output)),
        input_parameters: (config.parameters || []).map((row: any) =>
            modelParameterFromCatalogGQL(row.parameter)
        )
    } as Model;
};

// Maps a catalog input/output from the unified modelcatalog_configuration junction shape
// (no nested model_io wrapper; flat fields from modelcatalog_dataset_specification)
export const modelIOFromCatalogGQL = (io: any): ModelIO => {
    return {
        id: io.id,
        name: io.label || io.id,
        type: "",
        format: io.has_format || "",
        value: null,
        position: io.position || 0,
        variables: []
    } as ModelIO;
};
```

**Modified code** — pass the full junction row to `modelIOFromCatalogGQL`:
```typescript
export const modelFromGQL = (config: any): Model => {
    return {
        id: config.id,
        name: config.label || config.id,
        description: config.description || "",
        category: "",
        region_name: "",
        model_configuration: config.model_configuration_id || null,
        software_image: config.has_software_image || "",
        code_url: config.has_component_location || "",
        input_files: (config.inputs || []).map((row: any) => modelIOFromCatalogGQL(row)),
        output_files: (config.outputs || []).map((row: any) => modelIOFromCatalogGQL(row.output, {})),
        input_parameters: (config.parameters || []).map((row: any) =>
            modelParameterFromCatalogGQL(row.parameter)
        )
    } as Model;
};

// Maps a catalog input/output junction row.
// junctionRow has shape { input: {...}, is_optional: boolean } for inputs,
// or { output: {...} } for outputs (is_optional not present on output junction).
export const modelIOFromCatalogGQL = (junctionRow: any, entityKey?: string): ModelIO => {
    const key = entityKey ?? 'input';
    const io = junctionRow[key] ?? junctionRow;
    return {
        id: io.id,
        name: io.label || io.id,
        type: "",
        format: io.has_format || "",
        value: null,
        position: io.position || 0,
        variables: [],
        is_optional: junctionRow.is_optional ?? false,
    } as ModelIO;
};
```

**Key notes:**
- `input_files` callers pass the full `row` (junction row) — `modelIOFromCatalogGQL(row)` with default `entityKey = 'input'`.
- `output_files` callers pass `row` but with `entityKey = 'output'` so the nested entity is found at `row.output` — or keep backward compat by passing `row.output` directly; `is_optional` will be `false` since outputs are out of scope.
- Both callers at lines 490-491 must be updated.

---

### `mint-ensemble-manager/src/classes/graphql/queries/fragments/model-info.graphql` (config, request-response)

**Analog:** Current file lines 8-16 (inputs junction selection)

**Current inputs block** (lines 8-16):
```graphql
inputs {
    input {
        id
        label
        has_format
        position
        description
    }
}
```

**Modified block** — add `is_optional` at junction level:
```graphql
inputs {
    is_optional
    input {
        id
        label
        has_format
        position
        description
    }
}
```

**Key note:** `is_optional` is on the junction row, not on the nested `input` object. It must precede the `input {…}` block.

---

### `mint-ensemble-manager/src/classes/graphql/queries/model/get-modelcatalog-configuration.graphql` (config, request-response)

**Analog:** Current file lines 24-31 (inputs junction selection)

**Current inputs block** (lines 24-31):
```graphql
inputs {
  input {
    id
    label
    has_format
    position
    description
  }
}
```

**Modified block:**
```graphql
inputs {
  is_optional
  input {
    id
    label
    has_format
    position
    description
  }
}
```

**Key note:** Both this file and `model-info.graphql` select the same junction. Both must be updated in the same commit to keep the codegen types consistent.

---

### `mint-ensemble-manager/src/classes/tapis/adapters/TapisJobService.ts` — createJobFileInputsFromSeed (service, request-response)

**Analog:** `TapisJobService.ts` lines 103-127 (existing `createJobFileInputsFromSeed`)

**Current code** (lines 103-127):
```typescript
public createJobFileInputsFromSeed(
    seed: TapisComponentSeed,
    app: Apps.TapisApp,
    model: Model
): Jobs.JobFileInput[] {
    const jobInputs =
        app.jobAttributes?.fileInputs?.flatMap((fileInput) => {
            const modelInput = model.input_files.find((input) => input.name === fileInput.name);

            if (!modelInput) {
                throw new Error(`Component input not found for ${fileInput.name}`);
            }

            const datasets = seed.datasets[modelInput.id] || [];
            return datasets.map(
                (dataset: DataResource) =>
                    ({
                        name: modelInput.name,
                        sourceUrl: dataset.url
                    }) as Jobs.JobFileInput
            );
        }) || [];

    return jobInputs;
}
```

**Modified code** — skip optional inputs when no datasets bound (D-15):
```typescript
public createJobFileInputsFromSeed(
    seed: TapisComponentSeed,
    app: Apps.TapisApp,
    model: Model
): Jobs.JobFileInput[] {
    const jobInputs =
        app.jobAttributes?.fileInputs?.flatMap((fileInput) => {
            const modelInput = model.input_files.find((input) => input.name === fileInput.name);

            if (!modelInput) {
                if (/* some optional check by name from app inputMode */ false) {
                    // Future: cross-check Tapis app inputMode. Deferred per D-16.
                }
                throw new Error(`Component input not found for ${fileInput.name}`);
            }

            const datasets = seed.datasets[modelInput.id] || [];

            if (datasets.length === 0 && modelInput.is_optional) {
                // Skip optional input — no datasets bound, safe to omit
                logger.info(
                    `Skipping optional input ${modelInput.name} — no datasets bound`
                );
                return [];
            }

            return datasets.map(
                (dataset: DataResource) =>
                    ({
                        name: modelInput.name,
                        sourceUrl: dataset.url
                    }) as Jobs.JobFileInput
            );
        }) || [];

    return jobInputs;
}
```

**Key notes:**
- Required inputs with no datasets still throw the existing error — behavior unchanged.
- The `logger` reference: use the class-level logger already present in `TapisJobService.ts`.
- `modelInput.is_optional` reads from the `ModelIO` interface field added above.

---

### `mint-ensemble-manager/src/classes/tapis/adapters/tests/jobs.test.ts` (test, request-response)

**Analog:** Current file lines 1-19 (existing test structure)

**Current test pattern:**
```typescript
import seeds from "./fixtures/seeds";
import app from "./fixtures/app";
import model from "./fixtures/model";
import jobFileInputsExpected from "./expected/jobFileInputs";
import { expectedJobParameterSetNonDefault } from "./expected/jobParameterSet";
import { TapisJobService } from "@/classes/tapis/adapters/TapisJobService";
import { Jobs } from "@tapis/tapis-typescript";

test("test create job file inputs from seed", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    const jobInputs = jobService.createJobFileInputsFromSeed(seeds[0], app, model);
    const jobParameterSet = jobService.createJobParameterSetFromSeed(seeds[0], app, model);
    expect(jobInputs).toEqual(jobFileInputsExpected);
    expect(jobParameterSet).toEqual(expectedJobParameterSetNonDefault);
});
```

**New tests to add** — extend file with three additional `test()` blocks:

```typescript
// Test: optional input with no datasets → omitted from result
test("optional input with no datasets is skipped", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    // Use a model with one optional input and a seed with no dataset for that input
    const jobInputs = jobService.createJobFileInputsFromSeed(
        seedWithMissingOptionalInput,
        appWithOptionalInput,
        modelWithOptionalInput
    );
    // The optional input must be absent from the result
    expect(jobInputs.find((i) => i.name === "optional_file")).toBeUndefined();
});

// Test: required input with no datasets → throws
test("required input with no datasets throws", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    expect(() =>
        jobService.createJobFileInputsFromSeed(
            seedWithMissingRequiredInput,
            appWithRequiredInput,
            modelWithRequiredInput
        )
    ).toThrow("Component input not found");
});

// Test: optional input with datasets present → included normally
test("optional input with datasets present is included", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    const jobInputs = jobService.createJobFileInputsFromSeed(
        seedWithOptionalInputBound,
        appWithOptionalInput,
        modelWithOptionalInput
    );
    expect(jobInputs.find((i) => i.name === "optional_file")).toBeDefined();
});
```

**Fixture imports needed:** `seedWithMissingOptionalInput`, `appWithOptionalInput`, `modelWithOptionalInput`, `seedWithMissingRequiredInput`, `appWithRequiredInput`, `modelWithRequiredInput`, `seedWithOptionalInputBound` — all come from `tests/fixtures/`.

---

### `mint-ensemble-manager/src/classes/tapis/adapters/tests/fixtures/app.ts` (test, request-response)

**Analog:** Current file lines 85-157 (existing `fileInputs` array with `inputMode: "REQUIRED"`)

**Current fileInputs entry pattern** (lines 86-93):
```typescript
fileInputs: [
    {
        name: "bas6",
        description: "Basic Package Input for the Groundwater Flow Process",
        inputMode: "REQUIRED",
        autoMountLocal: true,
        sourceUrl: null,
        targetPath: "input.ba6"
    },
    // ... more REQUIRED entries
]
```

**New export to add** — an app fixture with one OPTIONAL fileInput:
```typescript
export const appWithOptionalInput: Apps.TapisApp = {
    ...baseAppDefaults,
    jobAttributes: {
        ...baseJobAttributeDefaults,
        fileInputs: [
            {
                name: "optional_file",
                description: "An optional supplementary input file",
                inputMode: "OPTIONAL",
                autoMountLocal: true,
                sourceUrl: null,
                targetPath: "optional.dat"
            }
        ]
    }
} as Apps.TapisApp;
```

**Key note:** The existing `app.ts` exports a default. Add named exports (`appWithOptionalInput`, `appWithRequiredInput`) alongside. The `inputMode: "OPTIONAL"` string is a valid Tapis SDK value — see existing `"REQUIRED"` and `"FIXED"` patterns in the same file (lines 39, 62, 89, 99...).

---

## Shared Patterns

### Junction Row NOT NULL DEFAULT Pattern
**Source:** `graphql_engine/migrations/1771200002000_modelcatalog_parameter_accepted_values/up.sql` (full file)
**Apply to:** New migration `up.sql`
```sql
BEGIN;
ALTER TABLE <table>
    ADD COLUMN <column> <type> NOT NULL DEFAULT <value>;
COMMIT;
```

### Hasura Junction Table Permissions Pattern
**Source:** `graphql_engine/metadata/tables.yaml` lines 3088-3119 (modelcatalog_configuration_input)
**Apply to:** Updated tables.yaml section for modelcatalog_configuration_input
- Junction tables: insert + select + delete permissions only (no update_permissions)
- anonymous role gets its own inline column list (not the YAML anchor)
- user role select re-uses the insert anchor (`*id00N`)

### GraphQL Junction-Level Field Selection Pattern
**Source:** `model-catalog-api/src/hasura/field-maps.ts` lines 216-225
**Apply to:** field-maps.ts inputs block; both GraphQL fragment files
- Fields on the junction row itself go at the same indent level as the nested object relationship
- Fields on the linked entity go inside the nested `input { … }` block
- Junction-level fields always come before the nested object block

### Junction Row Extra Columns in PUT (delete-then-insert) Pattern
**Source:** `model-catalog-api/src/service.ts` lines 295-315
**Apply to:** service.ts update() method and request.ts buildJunctionInserts()
- The junction row object (returned in the `variables[varName]` array) must include all `junctionColumns` entries
- Column name comes from `relConfig.junctionColumns` key (snake_case); value comes from the corresponding camelCase key on the request body item
- Items that omit the optional flag default to the DB DEFAULT (FALSE)

### ModelIO Field Extension Pattern
**Source:** `mint-ensemble-manager/src/classes/mint/mint-types.ts` lines 332-338
**Apply to:** ModelIO interface
- New optional fields on existing interfaces use `?` to maintain backward compatibility
- snake_case field names match Postgres/GraphQL column naming

### GraphQL Fragment `is_optional` Selection Pattern
**Source:** Current `model-info.graphql` and `get-modelcatalog-configuration.graphql` inputs blocks
**Apply to:** Both files' `inputs { … }` block
- `is_optional` is a scalar on the junction, selected before the nested relationship
- After editing, run `npm run codegen` in `mint-ensemble-manager` to regenerate `types.ts`

### Tapis Job Submission Skip Pattern
**Source:** `TapisJobService.ts` lines 103-127 (the `flatMap` returning `[]` for empty datasets)
**Apply to:** `createJobFileInputsFromSeed` — optional input branch
- Return `[]` from `flatMap` to produce zero `JobFileInput` entries for that fileInput
- Log at `info` level before returning
- Required path is unchanged: still throws the existing error

### Test Fixture Composition Pattern
**Source:** `tests/fixtures/app.ts` (default export object), `tests/fixtures/model.ts`
**Apply to:** New fixture exports for optional-input scenarios
- Spread `...existingFixture` and override only what differs
- Keep fixture objects typed (`as Apps.TapisApp`, `as Model`)
- Expected output fixtures live in `tests/expected/` — add a new file for the optional-skip scenario if needed

---

## No Analog Found

All files in Phase 12 have close analogs in the existing codebase. No new patterns are required from external sources.

---

## Key Hazards for Planner

1. **modelIOFromCatalogGQL signature change:** Two callers at `graphql_adapter.ts` lines 490-491. Both must be updated. The output path (`row.output`) must NOT receive `is_optional` — only the input path reads the junction flag.

2. **field-maps.ts `is_optional` placement:** Must be a sibling of `input { … }` (junction-row level), not a child of `input { … }` (dataset_specification level). Wrong placement causes the field to resolve to null in GraphQL.

3. **service.ts update path vs. create path:** Two separate locations must both propagate `is_optional`:
   - CREATE (`buildJunctionInserts` in `request.ts`): the junction row inside `data: [...]` for the nested insert.
   - UPDATE (delete-then-insert in `service.ts`): the flat row objects in `variables[varName]`.

4. **Codegen order:** `npm run codegen` must run after `hasura metadata apply` — not before. Commit `types.ts` in the same PR after codegen succeeds.

5. **tables.yaml anonymous select:** The anonymous role's column list is an inline list (not the `*id007` YAML anchor). If `is_optional` is only added to the anchor, anonymous queries will not be able to select it.

---

## Metadata

**Analog search scope:** `graphql_engine/migrations/`, `graphql_engine/metadata/`, `model-catalog-api/src/`, `mint-ensemble-manager/src/`, `ui/src/screens/models/configure/resources/`
**Files scanned:** 18
**Pattern extraction date:** 2026-04-27
