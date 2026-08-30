# /models/register — an input can have zero, one, or many standard variables

**Date:** 2026-06-12
**Scope:** `ui-react` only. Register page (`CreateModelForm`) gets full multi-variable
support; the shared edit form (`ConfigurationForm`) keeps its current single-presentation
behavior unchanged.

## Problem

The `/models/register` form lets an input carry **at most one** standard variable. The
mutation hard-codes a single-element `presentations.data: [ ... ]`, the Zod schema models a
single `standardVariable`/`unit` on each input row, and the UI shows one Standard Variable +
Unit picker per input. Domain scientists need an input (e.g. one NetCDF file) to expose
**several** variables.

## Data model (confirmed)

`VariablePresentation` is the hub; the three other entities only connect through it.

```
Input (sd:DatasetSpecification)
└─ contains one or more ─► VariablePresentation        ← the row / list item
                              • label (NOT NULL), long name, short name
                              ├─ sd:hasStandardVariable ─► StandardVariable  (0..1, SVO)
                              └─ sd:usesUnit ───────────► Unit               (0..1, QUDT)
```

- `DatasetSpecification → VariablePresentation` is **1:N** via the junction table
  `modelcatalog_dataset_specification_presentation`.
- `VariablePresentation → StandardVariable` and `→ Unit` are each a **single nullable FK**.
- "An input has many standard variables" = the input has many presentations, each with one SV.

No DB / Hasura / API change is required — only `ui-react`.

## Decisions

1. **Row = VariablePresentation.** Each row's headline is the variable **Name** (label).
   Standard Variable and Unit are optional fields on the row. (SV is option B: optional.)
2. **Name handling (option B).** Name is shown and optional. On submit, if blank it is
   derived from the selected Standard Variable's label (fallback: short name). A row with
   **no name, no SV, and no unit** is dropped — no meaningless VP is created.
   `label` is NOT NULL in the DB, so every *kept* row resolves to a non-empty label.
3. **A new input starts with one empty variable row.** Users can remove it (→ zero
   variables) or add more.
4. **Persistence — Approach 1.** Parameterize the existing mutations:
   `AddConfigurationInput` / `AddConfigurationOutput` take
   `$presentations: [modelcatalog_dataset_specification_presentation_insert_input!]!`
   and use `presentations: { data: $presentations }`. One atomic mutation per input creates
   DatasetSpec + junction + N presentations. Requires `npm run codegen`.
5. **Scope guard.** A new `allowMultipleVariables` prop gates the multi-variable UI.
   Register passes `true` (full list). The edit form leaves it `false`, rendering a single
   fixed presentation editor bound to `presentations[0]` — identical to today's behavior,
   so no silent data loss on existing configurations. Full edit support is a follow-up.

## Changes

### Schema — `src/schemas/configuration.ts`
- Add `presentationRowSchema` (`existingPresentationId?`, `standardVariable`, `unit`,
  `variableLabel?`, `variableLongName?`, `variableShortName?`) and `PresentationRowSchema`.
- `inputRowSchema`: drop the per-row `standardVariable`/`unit`/`variable*`/
  `existingPresentationId`; add `presentations: z.array(presentationRowSchema).default([])`.
- Add `emptyPresentationRow()`. `emptyInputRow()` seeds `presentations: [emptyPresentationRow()]`.

### Mutation builder — `src/lib/mutation-builder.ts`
- Add `PresentationRow` type; `InputRow` now holds `presentations: PresentationRow[]`.
- `buildAddInputVariables` / `buildAddOutputVariables` map kept presentations to an array of
  `modelcatalog_dataset_specification_presentation_insert_input` (each nesting
  `presentation.data`), generating a URI per presentation, deriving label per decision 2,
  and dropping fully-empty rows.
- `diffInputRows` compares `presentations[0]` fields (edit form is single-presentation).

### GraphQL — `src/graphql/mutations/model-catalog.graphql`
- `AddConfigurationInput` / `AddConfigurationOutput`: replace the single-presentation scalar
  vars with the `$presentations` array variable.
- Regenerate `src/graphql/generated/graphql.ts` via `npm run codegen`.

### UI
- New `VariablePresentationRow` component: Name + StandardVariableCombobox + UnitCombobox +
  collapsible long/short-name overrides + remove button.
- `InputRow`: add `allowMultipleVariables` prop. When true, render a `presentations`
  field array (add/remove). When false, render one fixed `VariablePresentationRow` bound to
  `presentations.0`.
- `InputOutputSection`: thread `allowMultipleVariables` through to `InputRow`.
- `CreateModelForm`: pass `allowMultipleVariables` to its input/output sections.
- `ConfigurationForm`: map loaded presentations into a single-element `presentations` list
  in `configToFormData`; update the save path to read `presentations[0]`.

### Tests
- Update `schemas-configuration.test.ts`, `mutation-builder.test.ts`, and affected component
  tests (`ConfigurationForm`, `InputOutputSection`) for the new shape.
- Add coverage for: multiple presentations on one input, zero presentations, empty-row drop,
  and SV-derived label fallback.

## Out of scope / follow-ups
- Full multi-presentation editing (add/remove/diff per presentation) in the edit form.
- Persisting license/website/keywords (already an existing follow-up).
