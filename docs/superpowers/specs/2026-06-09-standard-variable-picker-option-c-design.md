# Standard Variable Picker — Option C (Unit-aware guided flow) — Design

**Date:** 2026-06-09
**Status:** Approved (brainstorming complete; visual companions reviewed)
**Scope:** `ui-react/` only — frontend, no backend / schema / migration changes
**Branch:** builds on `feat/standard-variable-picker-ux` (PR #40) → PR to `develop`
**Supersedes nothing.** Extends `2026-06-06-standard-variable-picker-ux-design.md`.

## Context

PR #40 made the flat ~600-row picker grouped + rank-searched. Live-data
investigation surfaced three problems that ordering alone does not fix:

1. **Machine syntax, never humanized.** Rows read
   `atmosphere_water__precipitation_leq_volume_flux`. Users must parse the
   CSDMS grammar themselves.
2. **The same concept appears 5–6×.** `pore_water__pressure` (6×),
   `land_surface__elevation` (5×) — distinct SV URIs, identical to the eye,
   `same_as` empty. 599 records / 423 distinct labels / **176 duplicate rows**.
3. **The Unit field is a second, disconnected 90-item hunt.** `modelcatalog_unit`
   stores only `id` + a cryptic `label` (`m s-1`, `day/m^(1/3)`) — no name, no
   dimension. The relationship that would help (`standard_variable →
   variable_presentations → unit`) is fetched nowhere in `ui-react`.

## Key insight — the relationship is the design

Units live on **`variable_presentation`** (`sd:usesUnit`), which links to one
standard variable (`sd:hasStandardVariable`). So a variable already "knows" the
units it has been used with. Live data: **739 presentations, 476 (64%) carry a
unit, 264 labels have a recoverable unit**, and many concepts are used with
**multiple** units (e.g. `land_surface_air__temperature` → K, degC;
`soil_water__volume_fraction` → m³ m⁻³, %; precipitation → mm h⁻¹ / mm day⁻¹ /
m day⁻¹). Surfacing that relationship turns the orphan Unit hunt into a one-tap
choice.

The CSDMS grammar **`[context_]object__quantity`** (where `__` separates
phenomenon from property) is also a free, data-driven navigation: pick a
phenomenon, then its property. 400 strings become two short lists.

## Decision — guided modal that merges the two fields, client-side only

**Option C**: replace the two independent `StandardVariableCombobox` +
`UnitCombobox` fields in an Input/Output row with **one merged "Standard
variable & unit" field** that opens a **modal dialog** running a
`phenomenon → property → unit` flow. The unit step is seeded from the variable's
presentations. A **create gate** handles "not in the catalog."

Locked decisions (see "Open questions" for the two flagged for veto):

- **Container: modal `Dialog`.** Most room for the flow; behaves identically
  regardless of row count or form scroll. (Companion: `integration-options`.)
- **Keep two Zod fields, drive both from one picker.** `standardVariable` and
  `unit` stay separate in `inputRowSchema`; the picker sets both via
  `onChange`. `buildAddInputVariables` and the mutations are **unchanged**.
- **Unit scope: soft-sort, not hard-filter.** Suggested units first, then ALL
  units grouped by physical dimension — everything stays reachable. *(Flagged.)*
- **Collapse duplicates by label into one concept node;** the resolver picks the
  canonical record (most `variable_presentations`; prefer a non-UUID id). The
  guided columns show one node per concept.
- **Non-grammar labels** (the ~50 human-named ones with no `__`, e.g.
  `Flame Length`, `General_Head_Boundary`) live only in the **"search all"
  fallback**, not the guided columns.
- **Client-side only.** No schema/migration/codegen-schema change. Reuse the
  existing `GetVariablePresentations` query for the relationship.

Rationale: ships in `ui-react` on top of PR #40; reversible; the durable
data-hygiene fixes (populate `same_as`, trim dirty descriptions, add a `unit`
dimension column) are **future follow-ups**, not built now.

## Design

### Reused, unchanged
- `lib/standard-variable-taxonomy.ts` — domain category per concept (PR #40).
- `lib/standard-variable-search.ts` — ranking + highlight for "search all".
- `hooks/useRecentStandardVariables.ts` — recency.
- `components/autocomplete/StandardVariableCombobox.tsx` — embedded as the
  **"search all" fallback** inside the modal (its `onRequestNew` prop becomes
  the create gate).
- `schemas/configuration.ts` — `inputRowSchema`, `standardVariableSelectionSchema`,
  `unitSelectionSchema` unchanged.
- `lib/mutation-builder.ts` (`buildAddInputVariables`) and all mutations — unchanged.

### New — pure libs (no React, fully unit-tested)

**1. `src/lib/standard-variable-grammar.ts`**
- `parseCsdmsName(label) → { object, quantity, isGrammar }` — split on `__`;
  `object`/`quantity` cleaned (`~` and `_` → space). `isGrammar=false` when no
  `__` (these route to the fallback, never the guided columns).
- `humanizeStandardVariable(label) → { phenomenon, property }` — Title-cased
  parts for display (`channel_water__volume_flow_rate` →
  `{ phenomenon: "Channel water", property: "Volume flow rate" }`).
- Composes with `categorizeStandardVariable` for the phenomenon→domain map.

**2. `src/lib/unit-dictionary.ts`**
- `UNIT_DICTIONARY: Record<symbol, { name, dimension }>` — finite client map
  (the DB has neither). e.g. `degC → { name: "degrees Celsius", dimension: "Temperature" }`.
- `unitName(symbol)`, `unitDimension(symbol)`, `prettyUnit(symbol)`
  (superscripts), `DIMENSION_ORDER: string[]`.
- Unknown symbols fall back to `{ name: symbol, dimension: "Other" }` — never hidden.

**3. `src/hooks/useVariableUnits.ts`**
- Runs `useGetVariablePresentationsQuery({ fetchPolicy: 'cache-first' })`
  (confirm generated hook exists; query already in `model-catalog.graphql`).
- Builds `Map<standardVariableId, UnitOption[]>` (deduped) **and** a
  `Map<labelKey, canonicalSvId>` for duplicate collapse.
- Exposes `unitsForVariable(svId): UnitOption[]` and
  `canonicalIdForLabel(label): string`.

### New — components

**4. `src/components/autocomplete/StandardVariableUnitPicker.tsx`** — the modal.
- Props: `{ variable: StandardVariableOption | null; unit: UnitOption | null;
  onResolve(variable, unit): void; onRequestCreate?(ctx): void; disabled? }`.
- A compact **trigger** showing the resolved value
  (`Soil water — Volume fraction · m³ m⁻³`) or placeholder.
- shadcn `Dialog` body = **container-agnostic picker** (so it can move to a
  Popover later with one line):
  - `phenomenon` column (domains/objects, with counts) → `property` column.
  - **unit step**: radio cards from `unitsForVariable(canonicalId)` ("Used with
    this variable — one tap"); `Search all 90 ↓` expands to the
    dimension-grouped full list (soft-sort, suggested pinned + tagged).
  - footer: **`Use variable + unit →`** sets both fields via `onResolve`.
  - **search box** at top → `StandardVariableCombobox` "search all" fallback
    (catches non-grammar labels + power-user search).
- **Create gate** (entry point only; form is a separate spec):
  - *quiet* footer affordance while browsing;
  - *primary* CTA only at a search dead-end, **after** "Did you mean…"
    near-misses (find-before-create — the guardrail against the 176 dup rows);
  - fires `onRequestCreate({ query, phenomenon })`; only live for an
    authenticated user.

**5. `src/components/configuration/InputRow.tsx`** — integration (≈ lines 115–149).
- Replace the two `FormField`s (`standardVariable`, `unit`) with **one**
  `FormField`-pair driving `StandardVariableUnitPicker`; `onResolve` calls
  `setValue(p('standardVariable'), sv)` and `setValue(p('unit'), unit)`.
- `isOptional` checkbox and "Variable label overrides" block unchanged.

### Data flow (unchanged at the edges)
`StandardVariableUnitPicker.onResolve` → RHF `standardVariable.id` + `unit.id`
→ `buildAddInputVariables` → `AddConfigurationInput` (`hasStandardVariable`,
`usesUnit`). Edit mode: existing rows already carry both; trigger renders them;
reopening re-resolves from the same data.

## Build order (detailed steps go in the plan)
1. **Phase 1 — pure libs + hook + tests:** `standard-variable-grammar.ts`,
   `unit-dictionary.ts`, `useVariableUnits.ts`. No UI. (Matches PR #40's
   independently-tested-units style.)
2. **Phase 2 — `StandardVariableUnitPicker`** (modal) composing the existing
   combobox as fallback; component tests (browse, search, resolve, units,
   gate states).
3. **Phase 3 — swap into `InputRow.tsx`;** wire create gate `onRequestCreate`
   to a stub handler; verify register + edit flows.
4. **Phase 4 — create form** (the gate's destination) — **separate spec.**

## Out of scope / future follow-ups
- **Create form** behind the gate (separate spec) → insert into
  `modelcatalog_standard_variable` (`id, label, description, same_as`).
- **Data hygiene:** populate `same_as` / merge orphan duplicate records; ETL
  trim of label-repeating, whitespace-prefixed descriptions.
- **Unit dimension in the DB** (a real `dimension`/QUDT column) → enables
  hard dimension-filtering + unit/variable mismatch validation server-side.
- **Move modal → Popover** if quick repeat-entry outweighs focus (one-line
  swap; body is container-agnostic).

## Open questions (flagged for veto before Phase 1)
1. **Unit scope — soft-sort (default) vs hard dimension-filter.** Spec assumes
   soft-sort (nothing hidden) given the client-only, possibly-incomplete
   dimension map. Switch to filtering only once the map is proven complete.
2. **Merged field vs keep Unit visibly separate.** Spec merges them behind one
   trigger. Alternative: keep a separate (but auto-populated + suggestion-driven)
   Unit field for users who think of them as two steps.

## Design sources
Visual companions (in `docs/`): `variable-picker-alternatives.html`,
`variable-picker-integration-options.html`, `variable-picker-create-gate.html`.
