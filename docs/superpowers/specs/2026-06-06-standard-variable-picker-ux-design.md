# Standard Variable Picker UX — Design

**Date:** 2026-06-06
**Status:** Approved (brainstorming complete)
**Scope:** `ui-react/` only — frontend, no backend / schema / migration changes
**Branch:** `feat/standard-variable-picker-ux` → PR to `develop`

## Problem

The Register Model wizard asks the user to pick a "Standard Variable" for each
model input/output. There are ~600 standard variables. The current picker
(`ui-react/src/components/autocomplete/StandardVariableCombobox.tsx`) is a flat,
alphabetical `cmdk` combobox. It has five UX failures, three of which are
visible in the field:

1. **Cryptic UUID entries.** A large share of the 600 variables display as raw
   UUIDs (e.g. `06100430-298a-49d7-9834-590783d62379`) because their stored
   `label` is a UUID or empty. Root cause is upstream (`etl/transform.py`
   derives the label from the last URI segment when `rdfs:label` is missing),
   surfaced raw in the UI. The user cannot tell what these are.
2. **No grouping.** One flat alphabetical list of ~600 items. No way to narrow
   to a domain (fire/fuel, hydrology, soil…).
3. **Weak ranking.** cmdk scores `label` and `description` as one blended
   string, so a description hit ranks equal to a label hit; good matches sink.
4. **No recency.** A user configuring many inputs re-finds the same variables
   from scratch every time.
5. **Dead end on "not found."** The empty state offers no next step.

## Key insight — the SVO naming grammar

The human-readable standard-variable names follow the Scientific Variables
Ontology / CSDMS grammar: **`object__quantity`**, where `__` (double
underscore) separates the object/phenomenon from the quantity, and single `_`
separates words within each part. Examples:

- `atmosphere_precipitation__mass_flux` → object `atmosphere_precipitation`, quantity `mass_flux`
- `soil_moisture_content` → object `soil`
- `100hr_dead_moisture` → fire/fuel domain

The **leading object token** is a free, data-driven categorization key. No
manual taxonomy curation and no schema change are required — the grouping is
parsed from the label string the UI already has. A label that has no `_`/`__`
structure (or matches a UUID shape) is exactly how we *detect* the unnamed
rows.

## Decision — client-side parsing, no DB column

Categories are derived client-side from `label`/`description`. We do **not** add
a `category` column to `modelcatalog_standard_variable`. Rationale:

- The grammar lives in the label, so categorization needs no schema change.
- Ships entirely in `ui-react` this session; reversible; tunable in code.
- The durable DB-`category`-column variant (Hasura migration + ETL backfill +
  codegen) is documented below as a **future follow-up**, not built now.

## Design

A single component change plus two small new helpers. Everything operates over
the 600 rows already prefetched into the Apollo cache
(`usePrefetchReferenceDataQuery`, `cache-first`) — all ranking/grouping is
synchronous, no new network calls.

### 1. SVO taxonomy parser — `src/lib/standard-variable-taxonomy.ts`

Pure functions, no React:

- `categorizeStandardVariable(label, description?) → Category` — ordered rule
  list mapping the leading object token / substring signals to a domain
  category. More-specific rules win (Fire/Fuel checks before generic
  `moisture` so `100hr_dead_moisture` lands in Fire, not a moisture catch-all).
- `isUnnamedLabel(label) → boolean` — true for UUID-shaped
  (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) or
  structureless labels (no `_` and no space).
- `CATEGORY_ORDER: Category[]` — fixed display order, `Unnamed / Other` last.

Categories (8 + fallback):

| Category | Leading-token / substring triggers |
|---|---|
| Atmosphere & Climate | `atmosphere`, `air`, `precipitation`, `wind`, `temperature`, `radiation`, `humidity`, `vapor` |
| Hydrology — Surface Water | `surface_water`, `channel`, `stream`, `river`, `runoff`, `discharge`, `flood`, `lake`, `reservoir` |
| Hydrology — Groundwater | `groundwater`, `aquifer`, `water_table`, `recharge`, `head` |
| Soil | `soil`, `sediment`, `infiltration`, `porosity` |
| Fire & Fuel | `fire`, `fuel`, `_dead_`, `_live_`, `moisture`, `NNhr` (e.g. `100hr`), `burn`, `flame`, `combust` |
| Land Cover & Vegetation | `land`, `vegetation`, `canopy`, `crop`, `forest`, `biomass`, `leaf`, `lai`, `ndvi`, `plant` |
| Topography & Surface | `surface`, `elevation`, `slope`, `terrain`, `topograph`, `dem` |
| Energy & Carbon Flux | `energy`, `heat`, `carbon`, `co2`, `flux`, `evapotranspiration`, `latent`, `sensible` |
| Unnamed / Other (fallback) | UUID-shaped or no SVO structure or no token match |

The exact trigger lists are tuned during implementation against the real data;
the table is the starting point.

### 2. Recently-used hook — `src/hooks/useRecentStandardVariables.ts`

`localStorage`-backed, capped at 5, most-recent-first. Exposes the current
recent list and a `recordUse(option)` callback the combobox calls on selection.
Stores minimal `{ id, label, description }` so a recent item renders even if not
re-fetched. Key namespaced, e.g. `mint.recentStandardVariables`.

### 3. Combobox changes — `StandardVariableCombobox.tsx`

- Take filtering off cmdk: set `shouldFilter={false}` (the existing
  `PersonCombobox.tsx` already does this) and control the search input.
- **Ranked search** with `match-sorter` (~7KB, zero deps; new dependency):
  `keys` weighting `label` above `description`; match-sorter's built-in tiers
  give prefix > word-start > contains. Highlight the matched substring in the
  label via a case-insensitive `indexOf`.
- **Grouping:** when the query is empty (or short), render results grouped by
  category using cmdk `CommandGroup` headings in `CATEGORY_ORDER`, with a count
  badge per group. "★ Recently used" group first. When actively searching,
  results stay grouped by category but ordered by match score; recent matches
  still surface in their own group on top.
- **UUID demotion:** rows where `isUnnamedLabel(label)` render the
  `description` as the primary line and the UUID muted/secondary, and are
  bucketed into "Unnamed / Other" (sorted last). They remain selectable.
- **Meta line:** "Showing N of 600 · best matches first".
- **Empty/dead-end footer:** "+ Request a new standard variable". For this
  iteration it is a lightweight affordance — an `onRequestNew?` callback prop
  (default: no-op / nothing rendered if not provided). Full inline-create is
  explicitly **out of scope** (the "C" direction, not selected).

### Component boundaries

- `standard-variable-taxonomy.ts` — pure, framework-free, independently
  testable. Knows nothing about React or cmdk.
- `useRecentStandardVariables.ts` — owns persistence only. No ranking logic.
- `StandardVariableCombobox.tsx` — composition + rendering. Consumes the two
  helpers; no taxonomy or storage logic inline.

This keeps the picker's three responsibilities — categorize, remember, render —
in separate, swappable units.

## Out of scope (explicitly not built)

- DB `category` column / Hasura migration / ETL backfill (future follow-up).
- Semantic / AI "describe your variable" match (direction C).
- Two-pane faceted browser, usage counts (direction D).
- Inline create of a new standard variable + variable presentation (direction C);
  the footer is a stub affordance only.
- Fixing the upstream UUID labels in ETL (separate data-quality effort).

## Testing

- **Unit (Vitest)** — `standard-variable-taxonomy.test.ts`: every category's
  representative triggers, the Fire-before-moisture precedence, UUID detection
  (positive + negative), structureless-label fallback, and `CATEGORY_ORDER`
  placement of `Unnamed / Other` last.
- **Unit** — ranking helper: label beats description, prefix beats mid-word
  substring, highlight offsets.
- **Hook** — `useRecentStandardVariables`: cap at 5, dedupe, most-recent-first,
  survives reload (localStorage), tolerates malformed stored JSON.
- **Component** — `StandardVariableCombobox`: groups render in order with
  counts; UUID row demotes (description shown as primary); recent group pins on
  top; selecting records recency; typing re-ranks; existing selection/clear
  behavior preserved.

## Future follow-up (documented, not built)

Promote `category` to a queryable column on `modelcatalog_standard_variable`
(Hasura migration + heuristic backfill mirroring the parser, ETL
`derive_category` step, codegen in `ui-react` and `model-catalog-api`) once the
taxonomy stabilizes — making the grouping reusable by the REST API, the legacy
`ui/`, and reporting. Keep the rule set in one canonical place to avoid drift.
Separately, an ETL label-rescue using the existing `same_as` SVO links would fix
the UUID labels at the source rather than hiding them.
