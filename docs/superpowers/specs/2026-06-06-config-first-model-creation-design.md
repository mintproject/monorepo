# Config-first Model Creation — Design

**Date:** 2026-06-06
**Route:** `/models/register`
**Component:** `ui-react/src/components/registration/`
**Status:** Approved (design), pending implementation plan

## Problem

The current `/models/register` flow is a rigid 3-step wizard: **Software → Version → Configuration**. Users must define a Software and a Version before they can get to the part they actually care about — the configuration (parameters, inputs, outputs).

Persona: *Will (TACC)* wants to create a "Modflow configuration for Barton Springs" — define its parameters and I/O directly. Linking that to an existing Modflow model is a **second priority**, not a prerequisite. The forced hierarchy gets in his way.

## Goals

- Make the **configuration the entry point**. Name it, add parameters/inputs/outputs, done.
- Software linkage is **optional and secondary**, grouped with other optional metadata at the bottom.
- No forced step order; a single scrolling form with a single submit.
- Rename the user-facing vocabulary to be friendlier (below). Database entities are unchanged.

## Non-goals

- No `ConfigurationSetup` creation in this flow. Region is stored as metadata only.
- No redesign of the model tree / browse pages (beyond what the relabel implies — see Open Items).
- No change to the inputs/outputs/parameters row editors themselves; they are reused as-is.

## Terminology (UI relabel)

The UI is relabeled; **database entities and table names do not change**.

| User sees | Database entity (`modelcatalog_*`) |
|---|---|
| **Model** | `Configuration` (a.k.a. ModelConfiguration) |
| **Model Family** | `Software` |
| **Version** | `SoftwareVersion` |

Page title becomes **"Create a new model."** The thing being created is a `Configuration`.

## Layout

A single scrolling `Card`, no stepper. Vertical order:

1. **Model name** — required (`Configuration.label`)
2. **Description** — optional textarea
3. **Parameters** — reuses existing `ParameterSection` (name, default, min, max, type, etc.)
4. **Inputs** — reuses `InputOutputSection prefix="inputs"`
5. **Outputs** — reuses `InputOutputSection prefix="outputs"`
6. **`Optional details`** divider + grouped block (all optional):
   - **Model Family** — link an existing family/version, or create a new family inline, or leave blank
   - **Region** — autocomplete; stored as Configuration metadata (existing `regions` relationship)
   - **License**
   - **Website**
   - **Keywords**
7. Single **Create model** button (no Back / Next).

This collapses `SoftwareStep.tsx`, `VersionStep.tsx`, and `ConfigurationStep.tsx` into **one form**, one Zod schema, one submit. The old `StepIndicator` and per-step `trigger()` navigation are removed.

### The Model Family picker (item 6a)

Three states inside the optional block:

- **Pick existing** — search input lists Software + Version pairs:
  `Modflow — 2000`, `Modflow — 2005`, `Modflow — 2013`, `Modflow 6 — 6.4`, …
  Selecting one captures `{ softwareId, versionId }`.
- **Create new** — toggles to a small inline form: **Family name** + **Version**. On submit these create a new `Software` (+ first `SoftwareVersion`) that the model attaches to.
- **Blank (default)** — the model is standalone (no software/version association).

## Data model & backend

- **Remove the FK constraint** that requires `Configuration` to belong to a `SoftwareVersion`/`Software`. A `Configuration` may now exist with a null parent (standalone "Model").
  - Hasura migration to drop the constraint; `hasura metadata reload`.
- **Software link resolution** at submit:
  - *Existing picked* → associate the Configuration with that Software/Version.
  - *New family entered* → create `Software` + first `SoftwareVersion`, then associate.
  - *Blank* → no Software/Version rows created; Configuration is standalone.
- **Region** → stored via the existing `Configuration ↔ region` relationship as metadata. **No `ConfigurationSetup`** is created.

### Decision: link directly to Software, Version optional

Now that the FK is gone, when linking to an **existing** family the model associates with the **Software** directly; the **Version** is captured when the user picks a specific `Modflow — 2013` pair but is **optional**. (Confirmed direction: "link config directly to Software, Version optional.")

## Form schema & submit

A single root schema (extend/replace `configurationFormSchema`):

```
{
  label: string            // required — the Model name
  description?: string
  parameters: ParameterRow[]
  inputs: InputRow[]
  outputs: InputRow[]
  // optional block
  modelFamily?: {
    mode: 'existing' | 'new'
    softwareId?: string    // existing
    versionId?: string     // existing (optional)
    familyName?: string    // new
    versionName?: string   // new
  } | null
  regions: RegionSelection[]
  license?: string
  website?: string
  keywords?: string
}
```

Submit is a single conditional flow (replaces the per-step `trigger()` gating):

1. If `modelFamily.mode === 'new'` → create `Software` (+ first `SoftwareVersion`).
2. Create the `Configuration` (with or without software/version association).
3. Add inputs / outputs / parameters via existing `AddConfigurationInput / Output / Parameter` mutations.
4. Attach region metadata, license, website, keywords.

Validation happens once on submit. Only **Model name** is required.

## Files affected

- `ui-react/src/components/registration/ModelRegistrationWizard.tsx` — rewritten as a single-form `CreateModelForm` (or renamed). Remove `StepIndicator`, step state, per-step `trigger()`.
- `ui-react/src/components/registration/SoftwareStep.tsx`, `VersionStep.tsx` — retired; useful fields fold into the optional block / Model Family picker.
- `ui-react/src/components/registration/ConfigurationStep.tsx` — its body becomes the spine of the single form.
- `ui-react/src/schemas/registration.ts` — replace step schemas with the single root schema; keep `SOFTWARE_TYPE_*` constants.
- New: a **Model Family picker** component (autocomplete over Software+Version, with create-new toggle) under `registration/` or `autocomplete/`.
- `ui-react/src/graphql/` — query for Software+Version pairs (the picker list); mutation(s) for standalone Configuration create + new-family create. Run `npm run codegen`.
- `graphql_engine/` — migration to drop the FK constraint; metadata reload.
- Route `/models/register` is kept; the page label changes to "Create a new model."

## Testing

Rewrite `ModelRegistrationWizard.test.tsx` (rename as appropriate):

- Standalone create — name + a parameter, no family → Configuration created, no Software/Version.
- Create with **existing** family — picks `Modflow — 2013` → Configuration associated with that Software/Version.
- Create with **new** family — name + version → Software + Version created and associated.
- Region stored as metadata (not a Setup).
- Validation — Model name required; everything else optional.
- Inputs/outputs/parameters still create their rows.

MSW handlers updated for the new picker query and the new create mutations.

## Open items (flag during planning, out of scope here)

- Browse/tree pages still say "Software / Configuration." A broader relabel to "Model Family / Model" across the app is implied by this change but is **not** part of this spec — track separately.
- Exact Hasura mutation shape for "create standalone Configuration" depends on current generated operations; confirm during planning whether `RegisterModel` is split or a new mutation is added.
