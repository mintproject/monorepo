# Standard Variable Picker — Option C — Phase 1 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three pure, independently-tested foundations for the Option C variable+unit picker — a CSDMS-name grammar parser, a unit symbol→name/dimension dictionary, and a hook that maps each standard variable to the units its presentations use.

**Architecture:** Frontend-only, in `ui-react/`. Two framework-free libs (`lib/`) and one React hook (`hooks/`) that reads the existing `GetVariablePresentations` query from the Apollo cache. No UI in this phase; no schema/codegen change. These compose with PR #40's `standard-variable-taxonomy.ts` and feed the modal picker built in Phase 2.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest 2, @testing-library/react (`renderHook`), @apollo/client 3 `MockedProvider`.

**Design source:** `docs/superpowers/specs/2026-06-09-standard-variable-picker-option-c-design.md`.

---

## Setup (once, before Task 1)

This builds on PR #40 (which adds `standard-variable-taxonomy.ts`, the enhanced combobox, etc.), so branch from the PR branch, not `develop`:

```bash
git fetch origin feat/standard-variable-picker-ux
git worktree add .worktrees/sv-option-c -b feat/sv-picker-option-c origin/feat/standard-variable-picker-ux
cd .worktrees/sv-option-c/ui-react
npm install
```

All `npm test` commands below run **from `ui-react/`**. All `git` commands run **from the repo root** (paths are shown repo-root-relative).

---

## Task 1: CSDMS name grammar parser

Parses the `[context_]object__quantity` grammar into readable parts. `__` separates phenomenon from property; `~` and `_` are word joiners. A label with no `__` is not grammar (routes to the search fallback later, never the guided columns).

**Files:**
- Create: `ui-react/src/lib/standard-variable-grammar.ts`
- Test: `ui-react/src/lib/__tests__/standard-variable-grammar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui-react/src/lib/__tests__/standard-variable-grammar.test.ts
import { describe, expect, it } from 'vitest';

import {
  humanizeStandardVariable,
  parseCsdmsName,
} from '@/lib/standard-variable-grammar';

describe('parseCsdmsName', () => {
  it('splits object__quantity on the double underscore', () => {
    expect(parseCsdmsName('channel_water__volume_flow_rate')).toEqual({
      object: 'channel water',
      quantity: 'volume flow rate',
      isGrammar: true,
    });
  });

  it('treats ~ and _ as word joiners', () => {
    expect(parseCsdmsName('atmosphere_air_water~vapor__relative_saturation')).toEqual({
      object: 'atmosphere air water vapor',
      quantity: 'relative saturation',
      isGrammar: true,
    });
  });

  it('splits on the first __ only', () => {
    const r = parseCsdmsName('a__b__c');
    expect(r.object).toBe('a');
    expect(r.quantity).toBe('b c');
    expect(r.isGrammar).toBe(true);
  });

  it('marks labels without __ as non-grammar and keeps the text as quantity', () => {
    expect(parseCsdmsName('Flame Length')).toEqual({
      object: '',
      quantity: 'Flame Length',
      isGrammar: false,
    });
  });

  it('is null-safe', () => {
    expect(parseCsdmsName('')).toEqual({ object: '', quantity: '', isGrammar: false });
  });
});

describe('humanizeStandardVariable', () => {
  it('sentence-cases each part', () => {
    expect(humanizeStandardVariable('channel_water__volume_flow_rate')).toEqual({
      phenomenon: 'Channel water',
      property: 'Volume flow rate',
    });
  });

  it('leaves the property as-is for non-grammar labels', () => {
    expect(humanizeStandardVariable('Flame Length')).toEqual({
      phenomenon: '',
      property: 'Flame Length',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `ui-react/`): `npm test -- src/lib/__tests__/standard-variable-grammar.test.ts`
Expected: FAIL — cannot resolve module `@/lib/standard-variable-grammar`.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui-react/src/lib/standard-variable-grammar.ts
/**
 * CSDMS / SVO name grammar helpers.
 *
 * Standard-variable labels follow `[context_]object__quantity`: the double
 * underscore separates the phenomenon (object) from the property (quantity);
 * `~` and single `_` join words within a part. A label with no `__` is not
 * grammar — it is a human-named or UUID label that the guided picker routes to
 * its flat "search all" fallback rather than the phenomenon/property columns.
 */

export interface ParsedName {
  /** Phenomenon, space-joined and lower-cased. Empty for non-grammar labels. */
  object: string;
  /** Property, space-joined and lower-cased. The whole text for non-grammar labels. */
  quantity: string;
  /** True only when the label contains `__`. */
  isGrammar: boolean;
}

export interface HumanizedName {
  phenomenon: string;
  property: string;
}

const clean = (s: string): string => s.replace(/[~_]+/g, ' ').replace(/\s+/g, ' ').trim();

const sentence = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Parse a label into its object/quantity parts. Splits on the first `__`. */
export function parseCsdmsName(label: string): ParsedName {
  const trimmed = (label ?? '').trim();
  const idx = trimmed.indexOf('__');
  if (idx === -1) {
    return { object: '', quantity: trimmed, isGrammar: false };
  }
  return {
    object: clean(trimmed.slice(0, idx)),
    quantity: clean(trimmed.slice(idx + 2)),
    isGrammar: true,
  };
}

/** Display-ready, sentence-cased phenomenon + property for a label. */
export function humanizeStandardVariable(label: string): HumanizedName {
  const { object, quantity } = parseCsdmsName(label);
  return { phenomenon: sentence(object), property: sentence(quantity) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `ui-react/`): `npm test -- src/lib/__tests__/standard-variable-grammar.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/standard-variable-grammar.ts ui-react/src/lib/__tests__/standard-variable-grammar.test.ts
git commit -m "feat(ui-react): add CSDMS standard-variable name grammar parser"
```

---

## Task 2: Unit dictionary (symbol → name + dimension)

`modelcatalog_unit` stores only a cryptic symbol (`m s-1`). This finite client map gives each symbol a human name and a physical dimension (for grouping), plus a pretty-printer for superscripts. Unknown symbols fall back to `{ name: symbol, dimension: 'Other' }` — never hidden.

**Files:**
- Create: `ui-react/src/lib/unit-dictionary.ts`
- Test: `ui-react/src/lib/__tests__/unit-dictionary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui-react/src/lib/__tests__/unit-dictionary.test.ts
import { describe, expect, it } from 'vitest';

import {
  DIMENSION_ORDER,
  prettyUnit,
  unitDimension,
  unitName,
} from '@/lib/unit-dictionary';

describe('unitName / unitDimension', () => {
  it('resolves a known symbol to its name and dimension', () => {
    expect(unitName('degC')).toBe('degrees Celsius');
    expect(unitDimension('degC')).toBe('Temperature');
  });

  it('falls back to the raw symbol and Other for unknowns', () => {
    expect(unitName('zorp/widget')).toBe('zorp/widget');
    expect(unitDimension('zorp/widget')).toBe('Other');
  });
});

describe('prettyUnit', () => {
  it('renders negative exponents as superscripts', () => {
    expect(prettyUnit('m s-1')).toBe('m s⁻¹');
    expect(prettyUnit('mm day-1')).toBe('mm day⁻¹');
  });

  it('renders m3/m2 and m-3 in one symbol', () => {
    expect(prettyUnit('m3 m-3')).toBe('m³ m⁻³');
  });

  it('leaves a plain symbol unchanged', () => {
    expect(prettyUnit('Pa')).toBe('Pa');
  });
});

describe('DIMENSION_ORDER', () => {
  it('lists Temperature before Other and ends with Other', () => {
    expect(DIMENSION_ORDER.indexOf('Temperature')).toBeLessThan(DIMENSION_ORDER.indexOf('Other'));
    expect(DIMENSION_ORDER[DIMENSION_ORDER.length - 1]).toBe('Other');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `ui-react/`): `npm test -- src/lib/__tests__/unit-dictionary.test.ts`
Expected: FAIL — cannot resolve module `@/lib/unit-dictionary`.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui-react/src/lib/unit-dictionary.ts
/**
 * Unit dictionary.
 *
 * `modelcatalog_unit` stores only `id` + a cryptic `label` (the symbol, e.g.
 * `m s-1`, `day/m^(1/3)`) — no human name and no physical dimension. This
 * finite, client-side map supplies both so the picker can show readable unit
 * names and group the full list by dimension. Entries are drawn from the units
 * actually present in the live catalog; extend as new symbols appear. Unknown
 * symbols are never hidden — they fall back to `{ name: symbol, dimension:
 * 'Other' }`.
 */

export type UnitDimension =
  | 'Temperature'
  | 'Length'
  | 'Speed'
  | 'Depth rate'
  | 'Volume flow'
  | 'Fraction'
  | 'Pressure'
  | 'Area'
  | 'Areal mass'
  | 'Mass'
  | 'Concentration'
  | 'Energy flux'
  | 'Roughness'
  | 'Time'
  | 'Date'
  | 'Code'
  | 'Other';

/** Fixed display order for dimension groups; `Other` is always last. */
export const DIMENSION_ORDER: UnitDimension[] = [
  'Temperature',
  'Length',
  'Speed',
  'Depth rate',
  'Volume flow',
  'Fraction',
  'Pressure',
  'Area',
  'Areal mass',
  'Mass',
  'Concentration',
  'Energy flux',
  'Roughness',
  'Time',
  'Date',
  'Code',
  'Other',
];

interface UnitMeta {
  name: string;
  dimension: UnitDimension;
}

export const UNIT_DICTIONARY: Record<string, UnitMeta> = {
  K: { name: 'kelvin', dimension: 'Temperature' },
  degC: { name: 'degrees Celsius', dimension: 'Temperature' },
  'degC/day': { name: '°C per day', dimension: 'Temperature' },
  m: { name: 'metres', dimension: 'Length' },
  cm: { name: 'centimetres', dimension: 'Length' },
  mm: { name: 'millimetres', dimension: 'Length' },
  foot: { name: 'feet', dimension: 'Length' },
  'm s-1': { name: 'metres per second', dimension: 'Speed' },
  'ft/min': { name: 'feet per minute', dimension: 'Speed' },
  'm day-1': { name: 'metres per day', dimension: 'Depth rate' },
  'm d-1': { name: 'metres per day', dimension: 'Depth rate' },
  'mm day-1': { name: 'millimetres per day', dimension: 'Depth rate' },
  'mm h-1': { name: 'millimetres per hour', dimension: 'Depth rate' },
  'cm h-1': { name: 'centimetres per hour', dimension: 'Depth rate' },
  'm3 s-1': { name: 'cubic metres per second', dimension: 'Volume flow' },
  'm^3/s': { name: 'cubic metres per second', dimension: 'Volume flow' },
  'm3 day-1': { name: 'cubic metres per day', dimension: 'Volume flow' },
  'm3 m-3': { name: 'volume water per volume soil', dimension: 'Fraction' },
  'cm3 cm-3': { name: 'volume per volume', dimension: 'Fraction' },
  '%': { name: 'percent', dimension: 'Fraction' },
  'g/100g': { name: 'grams per 100 g', dimension: 'Fraction' },
  'kg kg-1': { name: 'kg per kg', dimension: 'Fraction' },
  'm m-1': { name: 'metres per metre', dimension: 'Fraction' },
  Pa: { name: 'pascals', dimension: 'Pressure' },
  ha: { name: 'hectares', dimension: 'Area' },
  '1000ha': { name: 'thousand hectares', dimension: 'Area' },
  km2: { name: 'square kilometres', dimension: 'Area' },
  'm^2': { name: 'square metres', dimension: 'Area' },
  'kg ha-1': { name: 'kg per hectare', dimension: 'Areal mass' },
  't/ha': { name: 'tonnes per hectare', dimension: 'Areal mass' },
  'Mg ha-1': { name: 'megagrams per hectare', dimension: 'Areal mass' },
  kg: { name: 'kilograms', dimension: 'Mass' },
  Mg: { name: 'megagrams', dimension: 'Mass' },
  'metric ton': { name: 'metric tons', dimension: 'Mass' },
  ppm: { name: 'parts per million', dimension: 'Concentration' },
  'mg/L': { name: 'milligrams per litre', dimension: 'Concentration' },
  'g kg-1': { name: 'grams per kilogram', dimension: 'Concentration' },
  'g cm-3': { name: 'grams per cubic centimetre', dimension: 'Concentration' },
  'W m-2': { name: 'watts per square metre', dimension: 'Energy flux' },
  'MJ m-2 day-1': { name: 'MJ per m² per day', dimension: 'Energy flux' },
  'MJ m-2 d-1': { name: 'MJ per m² per day', dimension: 'Energy flux' },
  'MJ/m2': { name: 'MJ per square metre', dimension: 'Energy flux' },
  'day/m^(1/3)': { name: 'Manning roughness', dimension: 'Roughness' },
  'm-1/3 s': { name: 'Manning roughness', dimension: 'Roughness' },
  day: { name: 'days', dimension: 'Time' },
  h: { name: 'hours', dimension: 'Time' },
  year: { name: 'years', dimension: 'Time' },
  seconds: { name: 'seconds', dimension: 'Time' },
  date: { name: 'calendar date', dimension: 'Date' },
  YYYY: { name: 'year (YYYY)', dimension: 'Date' },
  code: { name: 'category code', dimension: 'Code' },
};

/** Friendly name for a unit symbol; the raw symbol if unknown. */
export function unitName(symbol: string): string {
  return UNIT_DICTIONARY[symbol]?.name ?? symbol;
}

/** Physical dimension for a unit symbol; `Other` if unknown. */
export function unitDimension(symbol: string): UnitDimension {
  return UNIT_DICTIONARY[symbol]?.dimension ?? 'Other';
}

/** Render a unit symbol with proper superscripts (e.g. `m s-1` → `m s⁻¹`). */
export function prettyUnit(symbol: string): string {
  return symbol
    .replace(/(\S)-1\b/g, '$1⁻¹')
    .replace(/(\S)-2\b/g, '$1⁻²')
    .replace(/(\S)-3\b/g, '$1⁻³')
    .replace(/\bm3\b/g, 'm³')
    .replace(/\bm2\b/g, 'm²')
    .replace(/\bcm3\b/g, 'cm³');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `ui-react/`): `npm test -- src/lib/__tests__/unit-dictionary.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/unit-dictionary.ts ui-react/src/lib/__tests__/unit-dictionary.test.ts
git commit -m "feat(ui-react): add unit symbol-to-name/dimension dictionary"
```

---

## Task 3: `useVariableUnits` hook

Reads the existing `GetVariablePresentations` query (cache-first) and builds two maps: each standard variable's distinct units, and — for each label shared by several SV records — the canonical record (most presentations; non-UUID id wins ties). This is what lets the picker suggest units and collapse the duplicate concept rows.

**Files:**
- Create: `ui-react/src/hooks/useVariableUnits.ts`
- Test: `ui-react/src/hooks/__tests__/useVariableUnits.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// ui-react/src/hooks/__tests__/useVariableUnits.test.tsx
import { MockedProvider } from '@apollo/client/testing';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { GetVariablePresentationsDocument } from '@/graphql/generated/graphql';
import { useVariableUnits } from '@/hooks/useVariableUnits';

const pres = (
  id: string,
  svId: string,
  label: string,
  unit: { id: string; label: string } | null,
) => ({
  id,
  label: `${id}-presentation`,
  has_long_name: null,
  has_short_name: null,
  standard_variable: { id: svId, label, description: null },
  unit,
});

const mocks = [
  {
    request: { query: GetVariablePresentationsDocument },
    result: {
      data: {
        modelcatalog_variable_presentation: [
          // canonical record: 2 presentations, non-UUID id, unit m
          pres('p1', 'sv-canon', 'land_surface__elevation', { id: 'u-m', label: 'm' }),
          pres('p2', 'sv-canon', 'land_surface__elevation', { id: 'u-m', label: 'm' }),
          // duplicate sibling: UUID id, 1 presentation, no unit
          pres('p3', '06100430-298a-49d7-9834-590783d62379', 'land_surface__elevation', null),
          // a different variable used with two units
          pres('p4', 'sv-soil', 'soil_water__volume_fraction', { id: 'u-vf', label: 'm3 m-3' }),
          pres('p5', 'sv-soil', 'soil_water__volume_fraction', { id: 'u-pct', label: '%' }),
        ],
      },
    },
  },
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    {children}
  </MockedProvider>
);

describe('useVariableUnits', () => {
  it('returns the distinct units used with a variable', async () => {
    const { result } = renderHook(() => useVariableUnits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unitsForVariable('sv-canon')).toEqual([{ id: 'u-m', label: 'm' }]);
    expect(result.current.unitsForVariable('sv-soil')).toEqual([
      { id: 'u-vf', label: 'm3 m-3' },
      { id: 'u-pct', label: '%' },
    ]);
  });

  it('picks the canonical record for a label shared by several SV ids', async () => {
    const { result } = renderHook(() => useVariableUnits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canonicalIdForLabel('land_surface__elevation')).toBe('sv-canon');
  });

  it('returns an empty array for an unknown variable', async () => {
    const { result } = renderHook(() => useVariableUnits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unitsForVariable('nope')).toEqual([]);
    expect(result.current.canonicalIdForLabel('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `ui-react/`): `npm test -- src/hooks/__tests__/useVariableUnits.test.tsx`
Expected: FAIL — cannot resolve module `@/hooks/useVariableUnits`.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui-react/src/hooks/useVariableUnits.ts
/**
 * useVariableUnits
 *
 * Surfaces the standard_variable → variable_presentations → unit relationship
 * that the flat reference-data query throws away. Reads the existing
 * GetVariablePresentations query (cache-first) and derives:
 *  - the distinct units each standard variable has been used with, and
 *  - for each human label shared by several SV records (the duplicate-row
 *    problem), the single canonical record to resolve to (most presentations;
 *    a non-UUID id wins ties).
 * Pure derivation in a useMemo — no extra network call.
 */

import { useMemo } from 'react';

import { useGetVariablePresentationsQuery } from '@/graphql/generated/graphql';
import { isUnnamedLabel } from '@/lib/standard-variable-taxonomy';

export interface UnitOption {
  id: string;
  label: string;
}

export interface VariableUnits {
  loading: boolean;
  /** Distinct units used with the given standard-variable id (may be empty). */
  unitsForVariable: (standardVariableId: string) => UnitOption[];
  /** Canonical SV id for a label shared by duplicate records, or undefined. */
  canonicalIdForLabel: (label: string) => string | undefined;
}

export function useVariableUnits(): VariableUnits {
  const { data, loading } = useGetVariablePresentationsQuery({ fetchPolicy: 'cache-first' });

  const { unitsBySv, canonicalByLabel } = useMemo(() => {
    const unitsBySv = new Map<string, UnitOption[]>();
    const presCount = new Map<string, number>();
    const labelToIds = new Map<string, Set<string>>();

    const presentations = data?.modelcatalog_variable_presentation ?? [];
    for (const p of presentations) {
      const sv = p.standard_variable;
      if (!sv) continue;

      presCount.set(sv.id, (presCount.get(sv.id) ?? 0) + 1);

      if (sv.label) {
        const ids = labelToIds.get(sv.label) ?? new Set<string>();
        ids.add(sv.id);
        labelToIds.set(sv.label, ids);
      }

      const unit = p.unit;
      if (unit && unit.id) {
        const arr = unitsBySv.get(sv.id) ?? [];
        if (!arr.some((u) => u.id === unit.id)) {
          arr.push({ id: unit.id, label: unit.label ?? '' });
          unitsBySv.set(sv.id, arr);
        }
      }
    }

    const canonicalByLabel = new Map<string, string>();
    for (const [label, ids] of labelToIds) {
      let best: string | undefined;
      let bestScore = -1;
      for (const id of ids) {
        const count = presCount.get(id) ?? 0;
        const lastSegment = id.split('/').pop() ?? id;
        // weight presentation count, break ties toward a human (non-UUID) id
        const score = count * 2 + (isUnnamedLabel(lastSegment) ? 0 : 1);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best) canonicalByLabel.set(label, best);
    }

    return { unitsBySv, canonicalByLabel };
  }, [data]);

  return {
    loading,
    unitsForVariable: (standardVariableId) => unitsBySv.get(standardVariableId) ?? [],
    canonicalIdForLabel: (label) => canonicalByLabel.get(label),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `ui-react/`): `npm test -- src/hooks/__tests__/useVariableUnits.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/hooks/useVariableUnits.ts ui-react/src/hooks/__tests__/useVariableUnits.test.tsx
git commit -m "feat(ui-react): add useVariableUnits hook (variable to presentation units)"
```

---

## Final verification (after all tasks)

- [ ] **Run the full suite, type-check, lint, format**

Run (from `ui-react/`):
```bash
npm test
npm run build
npm run lint
npm run format:check
```
Expected: all green. `npm test` shows the new grammar (7), unit-dictionary (5), and hook (3) tests passing alongside the existing suite. `npm run build` (tsc -b + vite) clean.

- [ ] **Confirm nothing else changed**

Run: `git status` — only the six new files (three sources, three tests) are added; no edits to existing files in this phase.

---

## Phase 1 → Phase 2 handoff

When green, Phase 2 (separate plan) builds `StandardVariableUnitPicker.tsx` (the modal) on these three foundations + PR #40's `standard-variable-search` / `-taxonomy`, then Phase 3 swaps it into `InputRow.tsx`. The create-gate form is Phase 4 (separate spec).
