# MINT UI Resource Editor — Nested Modal Workflow Analysis

## 1. Base Class: `resource.ts` (ModelCatalogResource<T>)

**File**: `ui/src/screens/models/configure/resources/resource.ts`  
**Lines**: 1709  
**Custom Element**: `model-catalog-resource`  
**Inheritance**: `LitElement`  
**Generic**: `<T extends BaseResources>` where BaseResources = `{id?, label?, description?}`

### 1.1 Core Data Structures

| Property | Type | Purpose |
|---|---|---|
| `_resources` | `T[]` | Inline references from parent (stubs with just `id`) |
| `_loadedResources` | `IdMap<T>` | Full entities fetched by `resourceApi.get(id)` |
| `_resourcesToEdit` | `IdMap<T>` | Lazy queue: resources edited but not yet PUT |
| `_resourcesToCreate` | `IdMap<T>` | Lazy queue: resources created but not yet POST |
| `_loading` | `IdMap<boolean>` | Per-resource loading state |
| `_error` | `IdMap<boolean>` | Per-resource error state |

### 1.2 Action/Status Enums

```
Action: NONE | SELECT | MULTISELECT | EDIT_OR_ADD
Status: NONE | CREATE | EDIT | CUSTOM_CREATE
```

- **Action** controls the mode of the resource list (view only, pick one, pick many, or editable table).
- **Status** controls what the dialog shows (create form, edit form, or nothing).

### 1.3 Key Methods

#### `setResources(r: T[])` (line 1419)
The primary data-input method. Called by parent editors to populate child resource lists.
1. Stores `r` into `this._resources` (inline stubs with `id` only).
2. Identifies which resources need fetching (`id` contains `PREFIX_URI` and not already loaded).
3. For each, checks Redux store (`_getDBResources()`) first; if not cached, dispatches `this.resourceApi.get(id)`.
4. Stores full response in `_loadedResources[id]`.

**CRITICAL BUG**: The inline `r` from the parent payload may contain junction-only fields (e.g., `isOptional` on DatasetSpecification). The `resourceApi.get(id)` call fetches the entity independently and does NOT return junction fields. They get silently dropped.

#### `getResources()` (line 1642)
Returns the current resource list, mapped through `_loadedResources`. If `id.length < 15` (temp/unsaved), strips the id.

#### `_renderForm()` (line 865)
Default form: label + description textfields. Overridden by every subclass.

#### `_getResourceFromForm()` (line 1217)
Default: reads `#resource-label` and `#resource-desc` textfields and returns `{label: [v], description: [v]}`.

#### `_saveResource(r: T)` (line 1063)
Eager save: calls `_createLazyInnerResources(r)` first (to save nested lazy children), then dispatches `resourceApi.put(r)` or `resourcePost(r)`.

#### `save(): Promise<T[]>` (line 1180)
Batch-saves all lazy queues (`_resourcesToCreate`, `_resourcesToEdit`) for resources in `_resources`. Used by parent editors (e.g., ModelConfiguration saves its lazy Parameters before PUTting itself).

#### `_createLazyInnerResources(r: T)` (line 1089)
Default: returns `Promise.resolve(r)`. Overridden in ModelConfiguration and ModelConfigurationSetup to save lazy inner resources (Parameters, DatasetSpecifications) before the parent PUT.

#### `render()` (line 289)
Three render modes:
- **singleMode** → `_renderFullView()` (full-page detail/edit)
- **inline=true** → `_renderInline()` (compact badge list with edit button)
- **inline=false** → `_renderTable()` (striped table with edit/delete per row)

Every instance also renders a `<wl-dialog id="resource-dialog">` for modals.

#### `_showEditSelectionDialog()` (line 1244)
Opens the modal dialog. Pre-selects current resources in the selection list.

#### `_editResource(r: T)` (line 1259)
Sets `_editingResourceId`, `_status = EDIT`. If `Action.EDIT_OR_ADD`, opens dialog. Calls `_setSubActions()`.

#### `_createResource()` (line 1291)
Sets `_status = CREATE`. If `Action.EDIT_OR_ADD`, opens dialog.

#### `_onSaveButtonClicked()` (line 1020)
Reads form data via `_getResourceFromForm()` or `_getResourceFromFullForm()`, handles create vs edit, saves eagerly or lazily.

#### `_loadAllResources()` (line 1672)
Dispatches `resourceApi.getAll()` — loads every resource of this type into `_loadedResources`. Used to populate the select dialog list.

---

## 2. ModelConfiguration (`model-configuration.ts`)

**File**: 1115 lines  
**Custom Element**: `model-catalog-model-configuration`  
**Inheritance**: `connect(store)(ModelCatalogResource)<ModelConfiguration>`  
**API**: `ModelCatalogApi.myCatalog.modelConfiguration`

### 2.1 Purpose
Edits a single ModelConfiguration in **singleMode** (full-page). Manages the largest set of sub-resources.

### 2.2 Child Resource Editors (Sub-Resources)

| Field | Editor Class | Action Mode | Lazy? |
|---|---|---|---|
| `author` | `ModelCatalogPerson` | MULTISELECT | No |
| `hasGrid` | `ModelCatalogGrid` | SELECT | No |
| `hasOutputTimeInterval` | `ModelCatalogTimeInterval` | SELECT | No |
| `usefulForCalculatingIndex` | `ModelCatalogNumericalIndex` | MULTISELECT | No |
| `hasModelCategory` | `ModelCatalogCategory` | MULTISELECT | No |
| `hasRegion` | `ModelCatalogRegion` | MULTISELECT | No |
| `hasProcess` | `ModelCatalogProcess` | MULTISELECT | No |
| `hasSoftwareImage` | `ModelCatalogSoftwareImage` | SELECT | No |
| `hasComponentLocation` | `ModelCatalogTapisApp` | SELECT | No |
| **`hasParameter`** | **`ModelCatalogParameter`** | **EDIT_OR_ADD** | **Yes** |
| **`hasInput`** | **`ModelCatalogDatasetSpecification`** | **EDIT_OR_ADD** | **Yes** |
| **`hasOutput`** | **`ModelCatalogDatasetSpecification`** | **EDIT_OR_ADD** | **Yes** |
| `hasSourceCode` | `ModelCatalogSourceCode` | SELECT | No |
| `hasConstraint` | `ModelCatalogConstraint` | MULTISELECT | No |

### 2.3 Key Methods

- **`_initializeSingleMode()`**: Creates all child editor instances. Sets `inline=false`, `lazy=true`, `disableCreation()`, `setNameEditable(false)` for Parameter and DS Input.
- **`_setSubResources(r)`**: Calls `child.setResources(r.field)` for every child.
- **`_renderFullResource(r)`**: Renders details table + `${this._inputParameter}`, `${this._inputDSInput}`, `${this._inputDSOutput}` as LitElement template expressions.
- **`_renderFullForm()`**: Same layout but with editable fields, sub-editors have edit actions set.
- **`_getResourceFromFullForm()`**: Reads all form fields + calls `child.getResources()` for each sub-resource editor. Assembles `ModelConfigurationFromJSON(jsonRes)`.
- **`_createLazyInnerResources(r)`**: Calls `this._inputParameter.save()`, `this._inputDSInput.save()`, `this._inputDSOutput.save()` in parallel, then resolves with the updated ModelConfiguration.

### 2.4 API Calls
- `ModelCatalogApi.myCatalog.modelConfiguration.get(id)` — fetch single
- `ModelCatalogApi.myCatalog.modelConfiguration.put(r)` — update
- `ModelCatalogApi.myCatalog.modelConfiguration.post(r, parentVersionId)` — create under a SoftwareVersion

---

## 3. ModelConfigurationSetup (`model-configuration-setup.ts`)

**File**: 1136 lines  
**Custom Element**: `model-catalog-model-configuration-setup`  
**Inheritance**: `connect(store)(ModelCatalogResource)<ModelConfigurationSetup>`  
**API**: `ModelCatalogApi.myCatalog.modelConfigurationSetup`

### 3.1 Purpose
Nearly identical to ModelConfiguration but for Setup entities. Key difference: Parameters have `isSetup=true` (enabling fixed-value editing and adjustability toggles), and DatasetSpecifications have `setAsSetup()` (enabling fixed file selection).

### 3.2 Differences from ModelConfiguration
- `_inputParameter.setAsSetup()` — shows "Value in this setup" and "Adjustable" columns
- `_inputDSInput.setAsSetup()` — enables fixed resource/collection file picking
- On creation, copies parent ModelConfiguration's sub-resources via `setResourcesAsCopy()`
- `resourcePost` passes `_parentConfig.id` as parent

### 3.3 Child Resource Editors
Same as ModelConfiguration (Person, Grid, TimeInterval, NumericalIndex, Category, Region, Process, SoftwareImage, TapisApp, Parameter, DatasetSpecification×2, SourceCode, Constraint).

---

## 4. DatasetSpecification (`dataset-specification.ts`)

**File**: 464 lines  
**Custom Element**: `model-catalog-dataset-specification`  
**Inheritance**: `connect(store)(ModelCatalogResource)<DatasetSpecification>`  
**API**: `ModelCatalogApi.myCatalog.datasetSpecification`

### 4.1 Purpose
Edits input/output file specifications. Each has variables (VariablePresentations), data transformations, and optionally fixed sample resources.

### 4.2 Child Resource Editors

| Field | Editor Class | Action Mode |
|---|---|---|
| `hasPresentation` | `ModelCatalogVariablePresentation` | MULTISELECT |
| `hasDataTransformation` | `ModelCatalogDataTransformation` | MULTISELECT |
| `hasFixedResource` (SampleResource) | `ModelCatalogSampleResource` | SELECT |
| `hasFixedResource` (SampleCollection) | `ModelCatalogSampleCollection` | SELECT |

### 4.3 Junction-Field Workaround (isOptional)
Lines 88-118: The `isOptional` field is a junction column (on model_configuration_input relationship, NOT on the DatasetSpecification entity). `setResources()` is overridden to stash `isOptional` from the inline payload into `_junctionOverlay`, then re-applies it in `requestUpdate()` onto `_loadedResources` entries. This is the patch for the known junction-field-drop bug.

### 4.4 Key Methods
- **`_renderForm()`**: Name, Description, Format textfields + `${this._inputVariablePresentation}` + conditionally `${this._inputSampleResource}` or `${this._inputSampleCollection}` (for setups) or `${this._inputDataTransformation}` (for configs).
- **`_getResourceFromForm()`**: Reads form, gets `this._inputVariablePresentation.getResources()`, builds `DatasetSpecificationFromJSON(jsonRes)`. Warns via `confirm()` if no variables.
- **`_renderRow(r)`**: Table row showing label, description, readiness check (has presentation or fixed resource), variables display.
- **`_editResource(r)`**: Sets sub-resource editors with editing resource's data.

### 4.5 API Calls
- `ModelCatalogApi.myCatalog.datasetSpecification.get(id)` — fetch single
- `ModelCatalogApi.myCatalog.datasetSpecification.put(r)` — update
- `ModelCatalogApi.myCatalog.datasetSpecification.post(r)` — create

---

## 5. VariablePresentation (`variable-presentation.ts`)

**File**: 312 lines  
**Custom Element**: `model-catalog-variable-presentation`  
**Inheritance**: `connect(store)(ModelCatalogResource)<VariablePresentation>`  
**API**: `ModelCatalogApi.myCatalog.variablePresentation`

### 5.1 Purpose
Edits variable presentations — the bridge between dataset specifications and standard scientific variables. Each VP has a label, description, short/long names, min/max values, standard variables, and units.

### 5.2 Child Resource Editors

| Field | Editor Class | Action Mode |
|---|---|---|
| `hasStandardVariable` | `ModelCatalogStandardVariable` | MULTISELECT |
| `usesUnit` | `ModelCatalogUnit` | MULTISELECT |

### 5.3 Key Methods
- **`_renderForm()`**: Label, Description, Short Name, Long Name, Min/Max textfields + `${this._inputStandardVariable}` + `${this._inputUnit}`.
- **`_getResourceFromForm()`**: Reads form, gets `this._inputUnit.getResources()` and `this._inputStandardVariable.getResources()`, builds `VariablePresentationFromJSON(jsonRes)`.
- **`_renderResource(r)`**: Shows label + unit abbreviation with tooltip for description.
- **`_checkLabelUniq(r)`**: Custom uniqueness check that considers label+unit combination (not just label alone).
- **Constructor**: Pre-loads all units via `this._inputUnit.getAllResources()` into `_allUnits` for display rendering.

### 5.4 API Calls
- `ModelCatalogApi.myCatalog.variablePresentation.get(id)` — fetch single
- `ModelCatalogApi.myCatalog.variablePresentation.getAll()` — fetch all (for select dialog)
- `ModelCatalogApi.myCatalog.variablePresentation.put(r)` — update
- `ModelCatalogApi.myCatalog.variablePresentation.post(r)` — create

---

## 6. StandardVariable (`standard-variable.ts`)

**File**: 80 lines  
**Custom Element**: `model-catalog-standard-variable`  
**Inheritance**: `connect(store)(ModelCatalogResource)<StandardVariable>`  
**API**: `ModelCatalogApi.myCatalog.standardVariable`

### 6.1 Purpose
Simple leaf editor for standard variables (scientific ontology terms). Minimal — just label and description.

### 6.2 Child Resource Editors
**None** — this is a leaf node.

### 6.3 Key Methods
- **`_renderForm()`**: Simple label + description form.
- **`_getResourceFromForm()`**: Returns `StandardVariableFromJSON({type: ["StandardVariable"], label: [v], description?: [v]})`.
- **`_renderResource(r)`**: Monospace font label.
- **`uniqueLabel = true`**: Enforces label uniqueness.

### 6.4 API Calls
- `ModelCatalogApi.myCatalog.standardVariable.get(id)` / `.getAll()` / `.put(r)` / `.post(r)`

---

## 7. Unit (`unit.ts`)

**File**: 86 lines  
**Custom Element**: `model-catalog-unit`  
**Inheritance**: `connect(store)(ModelCatalogResource)<Unit>`  
**API**: `ModelCatalogApi.myCatalog.unit`

### 7.1 Purpose
Leaf editor for measurement units. Simple label + description.

### 7.2 Child Resource Editors
**None** — this is a leaf node.

### 7.3 Key Methods
- **`_renderForm()`**: Label + description.
- **`_getResourceFromForm()`**: Returns `UnitFromJSON({type: ["Unit"], label: [v], description?: [v]})`.
- **`pageMax = 10`**: Paginated selection list.

### 7.4 API Calls
- `ModelCatalogApi.myCatalog.unit.get(id)` / `.getAll()` / `.put(r)` / `.post(r)`

---

## 8. Parameter (`parameter.ts`)

**File**: 816 lines  
**Custom Element**: `model-catalog-parameter`  
**Inheritance**: `connect(store)(ModelCatalogResource)<Parameter>`  
**API**: `ModelCatalogApi.myCatalog.parameter`

### 8.1 Purpose
Edits model parameters with rich type-specific forms (int, float, string, boolean). Supports min/max/default/increment/accepted-values depending on data type. Has setup mode for fixed-value editing and adjustability toggle.

### 8.2 Child Resource Editors

| Field | Editor Class | Action Mode |
|---|---|---|
| `usesUnit` | `ModelCatalogUnit` | SELECT |
| `hasPresentation` | `ModelCatalogVariablePresentation` | MULTISELECT |
| `relevantForIntervention` | `ModelCatalogIntervention` | SELECT |

### 8.3 Key Features
- **`lazy = true`** by default — saved in batch by parent
- **`positionAttr = "position"`** — supports drag-to-reorder
- **Setup mode** (`isSetup`): Shows "Value in this setup" + "Adjustable" toggle; `isAdjustable` checkbox
- **`_renderForm()`**: Complex form with data-type switcher, conditional sections for int/float/string/boolean

### 8.4 API Calls
- `ModelCatalogApi.myCatalog.parameter.get(id)` / `.getAll()` / `.put(r)` / `.post(r)` / `.delete(id)`

---

## 9. SoftwareVersion (`software-version.ts`)

**File**: 462 lines  
**Custom Element**: `model-catalog-software-version`  
**Inheritance**: `connect(store)(ModelCatalogResource)<SoftwareVersion>`  
**API**: `ModelCatalogApi.myCatalog.softwareVersion`

### 9.1 Purpose
Edits software versions. Single-mode full-page view. Has author (Person) as sole sub-resource.

### 9.2 Child Resource Editors

| Field | Editor Class | Action Mode |
|---|---|---|
| `author` | `ModelCatalogPerson` | MULTISELECT |

### 9.3 Key Methods
- `resourcePost` passes `_parentModel.id` as parent context
- `_renderFullResource()` / `_renderFullForm()` / `_getResourceFromFullForm()` — standard pattern

---

## 10. Model (`model.ts`)

**File**: 1042 lines  
**Custom Element**: `model-catalog-model`  
**Inheritance**: `connect(store)(ModelCatalogResource)<Model>`  
**API**: `ModelCatalogApi.myCatalog.model`

### 10.1 Purpose
Top-level model editor in single mode. Rich set of sub-resources. Supports CoupledModel type.

### 10.2 Child Resource Editors

| Field | Editor Class | Action Mode |
|---|---|---|
| `author` | `ModelCatalogPerson` | MULTISELECT |
| `hasGrid` | `ModelCatalogGrid` | SELECT |
| `usefulForCalculatingIndex` | `ModelCatalogNumericalIndex` | MULTISELECT |
| `hasFunding` | `ModelCatalogFundingInformation` | MULTISELECT |
| `hasSampleVisualization` | `ModelCatalogVisualization` | MULTISELECT |
| `hasModelCategory` | `ModelCatalogCategory` | MULTISELECT |
| `logo` | `ModelCatalogImage` | SELECT |
| `hasSourceCode` | `ModelCatalogSourceCode` | SELECT |
| `hasProcess` | `ModelCatalogProcess` | MULTISELECT |
| `hasInputVariable` | `ModelCatalogVariablePresentation` | MULTISELECT |
| `hasOutputVariable` | `ModelCatalogVariablePresentation` | MULTISELECT |
| `usesModel` (CoupledModel) | `ModelCatalogModel` | MULTISELECT |

---

## 11. The 5-Level Nested Modal Workflow

```
Level 0: Model (full page)
  └─ Level 1: ModelConfiguration (full page, singleMode)
       └─ Level 2: DatasetSpecification (table row → modal dialog)
            └─ Level 3: VariablePresentation (inline list → modal dialog)
                 ├─ Level 4a: StandardVariable (inline list → modal dialog)
                 └─ Level 4b: Unit (inline list → modal dialog)
```

### Level 1: ModelConfiguration

**What opens it**: URL navigation to `/models/configure/{modelId}/{versionId}/{configId}`. The parent page creates a `ModelCatalogModelConfiguration` in singleMode and calls `setResource(config)`.

**What renders**: Full-page form (`_renderFullResource` or `_renderFullForm`) with details table + three sub-resource tables (Parameters, Input Files, Output Files).

**Sub-resource display**: `_inputDSInput` and `_inputDSOutput` render as `<table>` (inline=false). Each row has edit/delete buttons.

**Data flow up**: On save, `_getResourceFromFullForm()` collects all sub-resource arrays via `child.getResources()`, then `_createLazyInnerResources()` batch-saves lazy children (Parameters, DS Input, DS Output) before PUTting the ModelConfiguration.

**API calls**:
- `modelConfiguration.get(id)` on load
- `parameter.post(r)` / `parameter.put(r)` for each lazy parameter
- `datasetSpecification.post(r)` / `datasetSpecification.put(r)` for each lazy DS
- `modelConfiguration.put(r)` final save

### Level 2: DatasetSpecification (MODAL)

**What opens the modal**: Clicking the edit button (pencil icon) on a DS row in the EDIT_OR_ADD table calls `_editResource(r)`, which sets `_status = EDIT`, `_dialogOpen = true`, and calls `showDialog("resource-dialog", this.shadowRoot)`.

Or clicking "Add a new dataset specification" link calls `_createResource()`, which sets `_status = CREATE` and opens the dialog.

**What renders inside**: `_renderFormDialog()` → `_renderForm()`:
- Name textfield (`#ds-label`)
- Description textarea (`#ds-desc`)
- Format textfield (`#ds-format`)
- **Variables section**: `${this._inputVariablePresentation}` — rendered inline with MULTISELECT action
- (Setup only) File type selector + `${this._inputSampleResource}` or `${this._inputSampleCollection}`
- (Config only) Data transformations: `${this._inputDataTransformation}`

**How data flows up**: On Save click → `_onSaveButtonClicked()` → `_getResourceFromForm()`:
1. Reads form fields
2. Gets `this._inputVariablePresentation.getResources()` for presentations
3. Builds `DatasetSpecificationFromJSON(jsonRes)`
4. If lazy: added to `_resourcesToCreate` or `_resourcesToEdit` queue (no immediate API call)
5. If eager: dispatches `datasetSpecification.post()` or `.put()`
6. Fires `model-catalog-save` CustomEvent
7. Closes dialog

**API calls**: When lazy (typical), deferred to parent's `save()` call. When eager, `datasetSpecification.post(r)` or `.put(r)`.

### Level 3: VariablePresentation (NESTED MODAL)

**What opens the modal**: Inside the DatasetSpecification modal, the VariablePresentation editor renders inline with an "edit" button (because `setActionMultiselect()` was called). Clicking that button calls `_showEditSelectionDialog()`, which opens a **second nested** `<wl-dialog>` inside the VP component's shadow DOM.

**What renders inside**: `_renderSelectDialog()`:
- Search textfield
- Scrollable list of all VariablePresentations with checkboxes (MULTISELECT)
- "Create a new variable presentation" button at bottom
- Each list item has edit and delete buttons

If "Create" is clicked → `_createResource()` → form dialog replaces the select dialog:
- Name, Description, Short Name, Long Name, Min/Max textfields
- **Standard Variables section**: `${this._inputStandardVariable}` — inline with MULTISELECT
- **Units section**: `${this._inputUnit}` — inline with MULTISELECT

**How data flows up**: On "Select" button → `_onSelectButtonClicked()`:
1. Collects all checked resources from `_selectedResources`
2. Maps to `_loadedResources[id]`
3. Sets `this._resources` to the selected set
4. Closes dialog
5. Parent (DatasetSpecification) later calls `this._inputVariablePresentation.getResources()` on save

**API calls**:
- `variablePresentation.getAll()` — loads all VPs for the selection list
- `variablePresentation.post(r)` — on create
- `variablePresentation.put(r)` — on edit
- `variablePresentation.delete(id)` — on delete

### Level 4a: StandardVariable (NESTED MODAL)

**What opens the modal**: Inside the VP create/edit form, the StandardVariable editor renders inline with an "edit" button (MULTISELECT). Clicking opens a **third nested** `<wl-dialog>`.

**What renders inside**: Select dialog with search + checkbox list of all StandardVariables. Create form has just Name + Description.

**How data flows up**: Same select pattern → sets `_resources` → parent (VP) calls `getResources()` on save.

**API calls**: `standardVariable.getAll()`, `.post(r)`, `.put(r)`, `.delete(id)`

### Level 4b: Unit (NESTED MODAL)

**What opens the modal**: Inside the VP create/edit form, the Unit editor renders inline with an "edit" button (MULTISELECT). Clicking opens another **third nested** `<wl-dialog>`.

**What renders inside**: Select dialog with search + checkbox list of all Units. Create form has just Name + Description.

**How data flows up**: Same pattern as StandardVariable.

**API calls**: `unit.getAll()`, `.post(r)`, `.put(r)`, `.delete(id)`

---

## 12. Data Flow Summary: Save Propagation

```
User clicks "Save" on ModelConfiguration (Level 1)
  │
  ├── _getResourceFromFullForm() collects:
  │     ├── _inputParameter.getResources()      → Parameter[]
  │     ├── _inputDSInput.getResources()         → DatasetSpecification[]
  │     ├── _inputDSOutput.getResources()        → DatasetSpecification[]
  │     ├── _inputCategory.getResources()        → Category[]
  │     └── ... (all other sub-resources)
  │
  ├── _createLazyInnerResources(config):
  │     ├── _inputParameter.save()               → POST/PUT each parameter
  │     ├── _inputDSInput.save()                 → POST/PUT each DS input
  │     └── _inputDSOutput.save()                → POST/PUT each DS output
  │
  └── modelConfiguration.put(fullConfig)          → PUT final config
```

**Important**: VariablePresentations, StandardVariables, and Units are saved **eagerly** (immediately when created/edited inside their modal dialogs), NOT lazily. Only Parameters and DatasetSpecifications use lazy saving.

---

## 13. Known Issues & Architectural Concerns

### 13.1 Junction Field Drop (CONFIRMED)
`setResources()` stores inline parent payload in `_resources` but calls `resourceApi.get(id)` per row, storing the entity GET response in `_loadedResources[id]`. Junction-only fields (like `isOptional` on model_configuration_input) get dropped because the entity endpoint doesn't return them.

**Current workaround**: `dataset-specification.ts` overrides `setResources()` and `requestUpdate()` to stash and re-apply `isOptional` via `_junctionOverlay`. This is fragile and type-unsafe.

### 13.2 Shadow DOM Modal Stacking
Each resource editor has its own `<wl-dialog>` inside its shadow DOM. Nested modals stack on top of each other visually, but:
- Z-index management is implicit (each dialog has `fixed` + `backdrop`)
- Closing an inner dialog doesn't close outer ones (correct behavior)
- But backdrop clicking on an outer dialog while an inner one is open can cause confusing states

### 13.3 All-or-Nothing Form Collection
`_getResourceFromForm()` reads from shadow DOM elements (`this.shadowRoot.getElementById(...)`) at save time. If the modal was closed or the element was removed from DOM, values are lost silently.

### 13.4 Inconsistent Save Semantics
- Parameters, DS Inputs, DS Outputs: **lazy** (queued, saved on parent save)
- VPs, StandardVariables, Units, Persons, Regions, etc.: **eager** (saved immediately when created/edited)
- This means a user can create a VP inside a DS modal, close without saving the DS, and the VP already exists in the database — orphaned.

### 13.5 Resource Loading Race Conditions
`setResources()` fires async `resourceApi.get()` calls and updates `_loadedResources` on resolution. If the user interacts with the form before all resources load, the form can show stale or missing data.

### 13.6 Temp ID Scheme
Lazy-created resources get `Math.random().toString(36)` as temporary IDs. These are checked with `id.length < 15` in `getResources()` to strip before sending to API. Fragile length-based check.

---

## 14. Entity Hierarchy Diagram

```
Model
  └── SoftwareVersion
        └── ModelConfiguration
              ├── Parameter [lazy]
              │     ├── Unit
              │     ├── VariablePresentation
              │     └── Intervention
              ├── DatasetSpecification (input) [lazy]
              │     ├── VariablePresentation
              │     │     ├── StandardVariable
              │     │     └── Unit
              │     ├── DataTransformation
              │     ├── SampleResource (setup only)
              │     └── SampleCollection (setup only)
              ├── DatasetSpecification (output) [lazy]
              │     └── (same as input)
              ├── Person (author)
              ├── Grid
              ├── TimeInterval
              ├── NumericalIndex
              ├── Category
              ├── Region
              ├── Process
              ├── SoftwareImage
              ├── TapisApp
              ├── SourceCode
              └── Constraint
```

---

## 15. React Rewrite Implications

1. **Replace LitElement shadow DOM modals** with React portal-based modals or a modal manager (e.g., Zustand modal store).
2. **Replace lazy save queues** with React state + React Query mutations. Use optimistic updates.
3. **Fix junction field drop** by either:
   - Fetching from a junction-aware endpoint, or
   - Merging inline parent fields with entity GET responses in the API layer.
4. **Unify save semantics** — all sub-resources should either be lazy or eager, not mixed.
5. **Replace `Math.random()` temp IDs** with UUIDs.
6. **Replace class-based programmatic child creation** (`new ModelCatalogVariablePresentation()`) with React composition (components rendered in JSX, state lifted via context or form state management).
