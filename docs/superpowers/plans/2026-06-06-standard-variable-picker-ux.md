# Standard Variable Picker UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 600-item Standard Variable combobox with a domain-grouped, rank-searched, recency-aware picker that demotes cryptic UUID entries — entirely client-side in `ui-react/`.

**Architecture:** Three focused units compose into the existing combobox. A pure taxonomy module parses the SVO `object__quantity` name grammar into domain categories and detects UUID/unnamed labels. A pure search module ranks options with `match-sorter` (label weighted above description) and assembles ordered, demoted display groups. A `localStorage`-backed hook remembers the last 5 picks. `StandardVariableCombobox` wires them together, taking filtering off cmdk (`shouldFilter={false}`, the pattern `PersonCombobox` already uses).

**Tech Stack:** React 18 + TypeScript (strict, `noUncheckedIndexedAccess`), Vite 5, Tailwind + shadcn/ui (`cmdk`, Radix Popover), Vitest 2 + Testing Library, `match-sorter` (new dependency).

**Spec:** `docs/superpowers/specs/2026-06-06-standard-variable-picker-ux-design.md`

**Working directory:** All commands run from `ui-react/` inside the worktree `.worktrees/sv-picker-ux` (branch `feat/standard-variable-picker-ux`). All edits happen in the worktree.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/standard-variable-taxonomy.ts` (create) | Pure: categorize a variable, detect unnamed/UUID labels, fixed category order. No React. |
| `src/lib/__tests__/standard-variable-taxonomy.test.ts` (create) | Unit tests for the taxonomy. |
| `src/lib/standard-variable-search.ts` (create) | Pure: rank options (match-sorter), compute highlight ranges, build ordered display groups with UUID demotion. No React. |
| `src/lib/__tests__/standard-variable-search.test.ts` (create) | Unit tests for ranking + grouping. |
| `src/hooks/useRecentStandardVariables.ts` (create) | `localStorage`-backed recent-picks state (cap 5). |
| `src/hooks/__tests__/useRecentStandardVariables.test.ts` (create) | Unit tests for the hook. |
| `src/components/autocomplete/StandardVariableCombobox.tsx` (modify) | Compose the above; grouped + ranked rendering, demotion, recency, request-new affordance. |
| `src/components/autocomplete/__tests__/StandardVariableCombobox.test.tsx` (create) | Smoke/integration test of the wired component. |
| `package.json` (modify) | Add `match-sorter`. |

`StandardVariableOption` stays exported from `StandardVariableCombobox.tsx` (its current home). The new modules import it as a **type-only** import to avoid a runtime cycle.

---

### Task 1: Add the `match-sorter` dependency

**Files:**
- Modify: `ui-react/package.json` (and `package-lock.json`)

- [ ] **Step 1: Install the dependency**

Run (from `ui-react/`):
```bash
npm install match-sorter@^6.3.4
```
Expected: `package.json` gains `"match-sorter": "^6.3.4"` under `dependencies`; lockfile updates; exit 0.

- [ ] **Step 2: Verify it resolves**

Run:
```bash
node -e "const {matchSorter,rankings}=require('match-sorter'); console.log(typeof matchSorter, rankings.WORD_STARTS_WITH)"
```
Expected: prints `function` and a number (e.g. `5`).

- [ ] **Step 3: Commit**

```bash
git add ui-react/package.json ui-react/package-lock.json
git commit -m "chore(ui-react): add match-sorter dependency"
```

---

### Task 2: SVO taxonomy module

Pure functions that map a label to a domain category and detect unnamed/UUID labels. First-matching-rule-wins, ordered so specific domains beat generic tokens (Fire/Fuel before the soil/moisture overlap; Soil before the hydrology rules so `soil_moisture_content` → Soil).

**Files:**
- Create: `ui-react/src/lib/standard-variable-taxonomy.ts`
- Test: `ui-react/src/lib/__tests__/standard-variable-taxonomy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/lib/__tests__/standard-variable-taxonomy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_ORDER,
  categorizeStandardVariable,
  isUnnamedLabel,
} from '@/lib/standard-variable-taxonomy';

describe('isUnnamedLabel', () => {
  it('flags UUID labels', () => {
    expect(isUnnamedLabel('06100430-298a-49d7-9834-590783d62379')).toBe(true);
  });
  it('flags empty/whitespace labels', () => {
    expect(isUnnamedLabel('')).toBe(true);
    expect(isUnnamedLabel('   ')).toBe(true);
  });
  it('flags single tokens with no structure', () => {
    expect(isUnnamedLabel('Modflow')).toBe(true);
  });
  it('accepts SVO-structured names', () => {
    expect(isUnnamedLabel('soil_moisture_content')).toBe(false);
    expect(isUnnamedLabel('atmosphere_precipitation__mass_flux')).toBe(false);
  });
  it('accepts multi-word phrases', () => {
    expect(isUnnamedLabel('Soil Moisture Content')).toBe(false);
  });
});

describe('categorizeStandardVariable', () => {
  it('routes fuel-moisture variables to Fire & Fuel, not Soil', () => {
    expect(categorizeStandardVariable('100hr_dead_moisture')).toBe('Fire & Fuel');
    expect(categorizeStandardVariable('10hr_dead_moisture')).toBe('Fire & Fuel');
  });
  it('routes soil moisture to Soil', () => {
    expect(categorizeStandardVariable('soil_moisture_content')).toBe('Soil');
  });
  it('routes precipitation flux to Atmosphere & Climate (not Energy via "flux")', () => {
    expect(categorizeStandardVariable('atmosphere_precipitation__mass_flux')).toBe(
      'Atmosphere & Climate',
    );
  });
  it('routes groundwater before generic water', () => {
    expect(categorizeStandardVariable('groundwater__recharge_rate')).toBe(
      'Hydrology — Groundwater',
    );
  });
  it('routes surface-water terms', () => {
    expect(categorizeStandardVariable('channel_stream__discharge')).toBe(
      'Hydrology — Surface Water',
    );
  });
  it('routes vegetation terms', () => {
    expect(categorizeStandardVariable('land_vegetation__leaf_area_index')).toBe(
      'Land Cover & Vegetation',
    );
  });
  it('routes topography terms', () => {
    expect(categorizeStandardVariable('land_surface__elevation')).toBe('Topography & Surface');
  });
  it('routes energy/carbon terms', () => {
    expect(categorizeStandardVariable('land_surface__latent_heat_flux')).toBe(
      'Energy & Carbon Flux',
    );
  });
  it('falls back to Unnamed / Other for UUIDs and unmatched tokens', () => {
    expect(categorizeStandardVariable('06100430-298a-49d7-9834-590783d62379')).toBe(
      'Unnamed / Other',
    );
    expect(categorizeStandardVariable('zzz_unmatched__quantity')).toBe('Unnamed / Other');
  });
});

describe('CATEGORY_ORDER', () => {
  it('lists Unnamed / Other last', () => {
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('Unnamed / Other');
  });
  it('has no duplicates', () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- standard-variable-taxonomy
```
Expected: FAIL — cannot resolve `@/lib/standard-variable-taxonomy`.

- [ ] **Step 3: Write minimal implementation**

Create `ui-react/src/lib/standard-variable-taxonomy.ts`:
```ts
/**
 * Standard Variable taxonomy.
 *
 * Pure, framework-free helpers that derive a domain category from a standard
 * variable's SVO/CSDMS name grammar (`object__quantity`) and detect
 * "unnamed" labels (raw UUIDs or structureless strings) so the UI can demote
 * them. First-matching rule wins; rules are ordered so specific domains beat
 * cross-cutting tokens (e.g. Fire & Fuel before the soil/moisture overlap,
 * Soil before the hydrology rules).
 */

export type StandardVariableCategory =
  | 'Atmosphere & Climate'
  | 'Hydrology — Surface Water'
  | 'Hydrology — Groundwater'
  | 'Soil'
  | 'Fire & Fuel'
  | 'Land Cover & Vegetation'
  | 'Topography & Surface'
  | 'Energy & Carbon Flux'
  | 'Unnamed / Other';

/** Fixed display order for category groups; "Unnamed / Other" is always last. */
export const CATEGORY_ORDER: StandardVariableCategory[] = [
  'Atmosphere & Climate',
  'Hydrology — Surface Water',
  'Hydrology — Groundwater',
  'Soil',
  'Fire & Fuel',
  'Land Cover & Vegetation',
  'Topography & Surface',
  'Energy & Carbon Flux',
  'Unnamed / Other',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for UUID-shaped, empty, or structureless (single-token) labels. */
export function isUnnamedLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed === '') return true;
  if (UUID_RE.test(trimmed)) return true;
  // A real SVO name has underscores; a human phrase has spaces. Neither => junk.
  if (!trimmed.includes('_') && !trimmed.includes(' ')) return true;
  return false;
}

interface CategoryRule {
  category: StandardVariableCategory;
  test: RegExp;
}

// Ordered: first match wins. Specific domains first; cross-cutting tokens
// (bare "moisture", "flux", "water") are deliberately omitted as triggers.
const RULES: CategoryRule[] = [
  { category: 'Fire & Fuel', test: /fire|fuel|_dead_|_live_|burn|flame|combust|\d+\s*hr_/i },
  { category: 'Soil', test: /soil|sediment|infiltration|porosity/i },
  { category: 'Hydrology — Groundwater', test: /groundwater|aquifer|water_table|recharge/i },
  {
    category: 'Hydrology — Surface Water',
    test: /surface_water|channel|stream|river|runoff|discharge|flood|lake|reservoir/i,
  },
  {
    category: 'Land Cover & Vegetation',
    test: /vegetation|canopy|crop|forest|biomass|\bleaf|\blai\b|ndvi|\bland/i,
  },
  { category: 'Topography & Surface', test: /elevation|slope|terrain|topograph|\bdem\b/i },
  {
    category: 'Energy & Carbon Flux',
    test: /energy|\bheat|carbon|\bco2\b|evapotranspiration|latent|sensible/i,
  },
  {
    category: 'Atmosphere & Climate',
    test: /atmosphere|\bair|precipitation|wind|temperature|radiation|humidity|vapor/i,
  },
];

/** Map a standard variable to a domain category. */
export function categorizeStandardVariable(
  label: string,
  description?: string | null,
): StandardVariableCategory {
  if (isUnnamedLabel(label)) return 'Unnamed / Other';
  const haystack = `${label} ${description ?? ''}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return rule.category;
  }
  return 'Unnamed / Other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- standard-variable-taxonomy
```
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/standard-variable-taxonomy.ts ui-react/src/lib/__tests__/standard-variable-taxonomy.test.ts
git commit -m "feat(ui-react): SVO standard-variable taxonomy"
```

---

### Task 3: Search + grouping module

Pure ranking and group assembly. `match-sorter` ranks options (label weighted above description; description only on word-start to kill noise). `buildStandardVariableGroups` produces ordered, demoted groups plus match/total counts. UUID rows get `displayLabel = description ?? label` and land in "Unnamed / Other".

**Files:**
- Create: `ui-react/src/lib/standard-variable-search.ts`
- Test: `ui-react/src/lib/__tests__/standard-variable-search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/lib/__tests__/standard-variable-search.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import {
  RECENT_GROUP_KEY,
  buildStandardVariableGroups,
  highlightRanges,
  rankStandardVariables,
} from '@/lib/standard-variable-search';

const OPTIONS: StandardVariableOption[] = [
  { id: 'sv-air', label: 'air__temperature', description: 'Near-surface air temperature' },
  { id: 'sv-soil-t', label: 'soil_temperature', description: null },
  { id: 'sv-soil-m', label: 'soil_moisture_content', description: 'Volumetric soil moisture' },
  { id: 'sv-fuel', label: '100hr_dead_moisture', description: '100 Hr Dead Fuel Moisture' },
  {
    id: 'sv-uuid',
    label: '06100430-298a-49d7-9834-590783d62379',
    description: 'Near-surface moisture index',
  },
  { id: 'sv-desc-only', label: 'precipitation_rate', description: 'temperature-adjusted rate' },
];

describe('rankStandardVariables', () => {
  it('returns all options unfiltered for an empty query', () => {
    expect(rankStandardVariables(OPTIONS, '')).toHaveLength(OPTIONS.length);
  });
  it('ranks label matches above description-only matches', () => {
    const ranked = rankStandardVariables(OPTIONS, 'temperature');
    const ids = ranked.map((o) => o.id);
    // air__temperature (label) ranks before precipitation_rate (description only)
    expect(ids.indexOf('sv-air')).toBeLessThan(ids.indexOf('sv-desc-only'));
  });
  it('excludes non-matches', () => {
    const ranked = rankStandardVariables(OPTIONS, 'soil');
    expect(ranked.every((o) => o.id !== 'sv-air')).toBe(true);
  });
});

describe('highlightRanges', () => {
  it('returns the matched range (case-insensitive)', () => {
    expect(highlightRanges('air__Temperature', 'temp')).toEqual([[5, 9]]);
  });
  it('returns empty for no match or empty query', () => {
    expect(highlightRanges('air__temperature', 'xyz')).toEqual([]);
    expect(highlightRanges('air__temperature', '')).toEqual([]);
  });
});

describe('buildStandardVariableGroups', () => {
  it('groups by category in canonical order with Unnamed last', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, [], '');
    const keys = groups.map((g) => g.key);
    expect(keys).toContain('Soil');
    expect(keys).toContain('Unnamed / Other');
    expect(keys.indexOf('Unnamed / Other')).toBe(keys.length - 1);
    // Atmosphere precedes Soil per CATEGORY_ORDER
    expect(keys.indexOf('Atmosphere & Climate')).toBeLessThan(keys.indexOf('Soil'));
  });
  it('demotes UUID rows: displayLabel uses description, flagged unnamed', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, [], '');
    const unnamed = groups.find((g) => g.key === 'Unnamed / Other');
    const row = unnamed?.options.find((o) => o.id === 'sv-uuid');
    expect(row?.isUnnamed).toBe(true);
    expect(row?.displayLabel).toBe('Near-surface moisture index');
  });
  it('pins a Recently used group first when recent ids match', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, ['sv-soil-m'], '');
    expect(groups[0]?.key).toBe(RECENT_GROUP_KEY);
    expect(groups[0]?.options[0]?.id).toBe('sv-soil-m');
  });
  it('omits the Recently used group when no recent id survives the filter', () => {
    const { groups } = buildStandardVariableGroups(OPTIONS, ['sv-air'], 'soil');
    expect(groups.every((g) => g.key !== RECENT_GROUP_KEY)).toBe(true);
  });
  it('reports match and total counts (matchCount excludes recent duplication)', () => {
    const res = buildStandardVariableGroups(OPTIONS, ['sv-soil-m'], '');
    expect(res.total).toBe(OPTIONS.length);
    expect(res.matchCount).toBe(OPTIONS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- standard-variable-search
```
Expected: FAIL — cannot resolve `@/lib/standard-variable-search`.

- [ ] **Step 3: Write minimal implementation**

Create `ui-react/src/lib/standard-variable-search.ts`:
```ts
/**
 * Standard Variable search + grouping.
 *
 * Pure helpers (no React) that rank options with match-sorter (label weighted
 * above description), compute highlight ranges, and assemble ordered display
 * groups with UUID demotion. Operates over the already-prefetched option list.
 */
import { matchSorter, rankings } from 'match-sorter';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import {
  CATEGORY_ORDER,
  categorizeStandardVariable,
  isUnnamedLabel,
  type StandardVariableCategory,
} from '@/lib/standard-variable-taxonomy';

/** Group heading used for the recently-used pins. */
export const RECENT_GROUP_KEY = 'Recently used';

export interface DisplayStandardVariable extends StandardVariableOption {
  category: StandardVariableCategory;
  isUnnamed: boolean;
  /** Description when the label is an unnamed/UUID row, else the label. */
  displayLabel: string;
}

export interface StandardVariableGroup {
  /** Category name, or RECENT_GROUP_KEY for the pinned recent group. */
  key: string;
  options: DisplayStandardVariable[];
}

export interface StandardVariableGroupResult {
  groups: StandardVariableGroup[];
  /** Distinct options matching the query (recent pins are not double-counted). */
  matchCount: number;
  /** Total options before filtering. */
  total: number;
}

/** Rank options by query. Empty query returns the input order unchanged. */
export function rankStandardVariables(
  options: StandardVariableOption[],
  query: string,
): StandardVariableOption[] {
  const q = query.trim();
  if (q === '') return options;
  return matchSorter(options, q, {
    keys: [
      { key: 'label' },
      // Description matches only when a word starts with the query — avoids
      // noisy mid-word description hits outranking nothing useful.
      { key: (o: StandardVariableOption) => o.description ?? '', threshold: rankings.WORD_STARTS_WITH },
    ],
    threshold: rankings.CONTAINS,
  });
}

/** Single case-insensitive highlight range for `text`, or [] if none. */
export function highlightRanges(text: string, query: string): Array<[number, number]> {
  const q = query.trim();
  if (q === '') return [];
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return [];
  return [[idx, idx + q.length]];
}

function toDisplay(option: StandardVariableOption): DisplayStandardVariable {
  const isUnnamed = isUnnamedLabel(option.label);
  const category = categorizeStandardVariable(option.label, option.description);
  const displayLabel = isUnnamed && option.description ? option.description : option.label;
  return { ...option, category, isUnnamed, displayLabel };
}

/** Rank, group by category (canonical order), demote UUIDs, pin recents. */
export function buildStandardVariableGroups(
  options: StandardVariableOption[],
  recentIds: string[],
  query: string,
): StandardVariableGroupResult {
  const ranked = rankStandardVariables(options, query).map(toDisplay);
  const byId = new Map(ranked.map((o) => [o.id, o] as const));

  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((o): o is DisplayStandardVariable => o !== undefined);

  const buckets = new Map<StandardVariableCategory, DisplayStandardVariable[]>();
  for (const o of ranked) {
    const arr = buckets.get(o.category);
    if (arr) arr.push(o);
    else buckets.set(o.category, [o]);
  }

  const groups: StandardVariableGroup[] = [];
  if (recent.length > 0) groups.push({ key: RECENT_GROUP_KEY, options: recent });
  for (const cat of CATEGORY_ORDER) {
    const arr = buckets.get(cat);
    if (arr && arr.length > 0) groups.push({ key: cat, options: arr });
  }

  return { groups, matchCount: ranked.length, total: options.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- standard-variable-search
```
Expected: PASS.

> Note: `match-sorter` v6 accepts a function key `(item) => string`; we use it for `description` to coalesce `null`. If a test reveals the description weighting is too strict, adjust the per-key `threshold` — do not remove the label/description split.

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/standard-variable-search.ts ui-react/src/lib/__tests__/standard-variable-search.test.ts
git commit -m "feat(ui-react): ranked search + grouping for standard variables"
```

---

### Task 4: Recently-used hook

`localStorage`-backed, capped at 5, most-recent-first, dedupes by id, tolerant of malformed stored JSON.

**Files:**
- Create: `ui-react/src/hooks/useRecentStandardVariables.ts`
- Test: `ui-react/src/hooks/__tests__/useRecentStandardVariables.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/hooks/__tests__/useRecentStandardVariables.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import {
  RECENT_STORAGE_KEY,
  useRecentStandardVariables,
} from '@/hooks/useRecentStandardVariables';

const opt = (id: string): StandardVariableOption => ({ id, label: `${id}_label`, description: null });

afterEach(() => {
  localStorage.clear();
});

describe('useRecentStandardVariables', () => {
  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    expect(result.current.recent).toEqual([]);
  });

  it('records a use, most-recent-first, and persists', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    act(() => result.current.recordUse(opt('a')));
    act(() => result.current.recordUse(opt('b')));
    expect(result.current.recent.map((o) => o.id)).toEqual(['b', 'a']);
    expect(localStorage.getItem(RECENT_STORAGE_KEY)).toContain('"b"');
  });

  it('dedupes by id, moving the re-used item to the front', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    act(() => result.current.recordUse(opt('a')));
    act(() => result.current.recordUse(opt('b')));
    act(() => result.current.recordUse(opt('a')));
    expect(result.current.recent.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('caps at 5 entries', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    act(() => {
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => result.current.recordUse(opt(id)));
    });
    expect(result.current.recent).toHaveLength(5);
    expect(result.current.recent.map((o) => o.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('hydrates from existing storage', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify([opt('x')]));
    const { result } = renderHook(() => useRecentStandardVariables());
    expect(result.current.recent.map((o) => o.id)).toEqual(['x']);
  });

  it('ignores malformed stored JSON', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useRecentStandardVariables());
    expect(result.current.recent).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- useRecentStandardVariables
```
Expected: FAIL — cannot resolve `@/hooks/useRecentStandardVariables`.

- [ ] **Step 3: Write minimal implementation**

Create `ui-react/src/hooks/useRecentStandardVariables.ts`:
```ts
/**
 * useRecentStandardVariables
 *
 * Remembers the last few standard variables the user picked, in a
 * localStorage-backed list (most-recent-first, capped, deduped by id).
 * Purely client-side; owns persistence only — no ranking logic.
 */
import * as React from 'react';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';

export const RECENT_STORAGE_KEY = 'mint.recentStandardVariables';
const MAX_RECENT = 5;

function readStored(): StandardVariableOption[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is StandardVariableOption =>
        typeof o === 'object' &&
        o !== null &&
        typeof (o as { id?: unknown }).id === 'string' &&
        typeof (o as { label?: unknown }).label === 'string',
    );
  } catch {
    return [];
  }
}

export function useRecentStandardVariables() {
  const [recent, setRecent] = React.useState<StandardVariableOption[]>(() => readStored());

  const recordUse = React.useCallback((option: StandardVariableOption) => {
    setRecent((prev) => {
      const next = [option, ...prev.filter((o) => o.id !== option.id)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / serialization errors */
      }
      return next;
    });
  }, []);

  return { recent, recordUse };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- useRecentStandardVariables
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/hooks/useRecentStandardVariables.ts ui-react/src/hooks/__tests__/useRecentStandardVariables.test.ts
git commit -m "feat(ui-react): useRecentStandardVariables hook"
```

---

### Task 5: Rewire `StandardVariableCombobox`

Compose the taxonomy, search, and recency units. Take filtering off cmdk (`shouldFilter={false}`), control the search input, render ordered category groups with counts, demote UUID rows, pin recents, show a "Showing N of M" meta line, highlight matches, and add an optional "request new variable" affordance. Preserve the existing select/deselect/clear behavior and the `StandardVariableOption` export.

**Files:**
- Modify: `ui-react/src/components/autocomplete/StandardVariableCombobox.tsx`
- Test: `ui-react/src/components/autocomplete/__tests__/StandardVariableCombobox.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/components/autocomplete/__tests__/StandardVariableCombobox.test.tsx`:
```tsx
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  StandardVariableCombobox,
  type StandardVariableOption,
} from '@/components/autocomplete/StandardVariableCombobox';
import { PrefetchReferenceDataDocument } from '@/graphql/generated/graphql';
import { makeQueryMock } from '@/test/utils/apollo-mocks';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';

const prefetchMock = makeQueryMock(
  PrefetchReferenceDataDocument,
  {},
  {
    modelcatalog_standard_variable: [
      { id: 'sv-soil', label: 'soil_moisture_content', description: 'Volumetric soil moisture' },
      { id: 'sv-air', label: 'air__temperature', description: 'Near-surface air temperature' },
      {
        id: 'sv-uuid',
        label: '06100430-298a-49d7-9834-590783d62379',
        description: 'Near-surface moisture index',
      },
    ],
    modelcatalog_unit: [],
  },
);

afterEach(() => {
  localStorage.clear();
});

function renderCombobox(value: StandardVariableOption | null = null) {
  const onChange = vi.fn();
  renderWithProviders(<StandardVariableCombobox value={value} onChange={onChange} />, {
    apolloMocks: [prefetchMock],
  });
  return { onChange };
}

describe('StandardVariableCombobox', () => {
  it('shows the selected label on the trigger', async () => {
    renderCombobox({ id: 'sv-soil', label: 'soil_moisture_content', description: null });
    expect(await screen.findByText('soil_moisture_content')).toBeInTheDocument();
  });

  it('opens and renders category group headings', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await waitFor(() =>
      expect(screen.getByRole('combobox')).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Soil')).toBeInTheDocument();
    expect(screen.getByText('Atmosphere & Climate')).toBeInTheDocument();
    expect(screen.getByText('Unnamed / Other')).toBeInTheDocument();
  });

  it('demotes a UUID row by showing its description as the name', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Near-surface moisture index')).toBeInTheDocument();
  });

  it('records the selection and reports it via onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCombobox();
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('soil_moisture_content'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sv-soil', label: 'soil_moisture_content' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- StandardVariableCombobox
```
Expected: FAIL — assertions on group headings (`Soil`, `Unnamed / Other`) and the demoted description fail against the current flat component.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `ui-react/src/components/autocomplete/StandardVariableCombobox.tsx` with:
```tsx
/**
 * StandardVariableCombobox
 *
 * Domain-grouped, rank-searched picker for Standard Variables. Data is
 * prefetched from the Apollo cache (cache-first) — all grouping/ranking is
 * synchronous and client-side. Filtering is taken off cmdk (shouldFilter
 * false); ranking + grouping come from lib/standard-variable-search, category
 * assignment from lib/standard-variable-taxonomy, recency from
 * hooks/useRecentStandardVariables. UUID/unnamed rows are demoted into an
 * "Unnamed / Other" group with their description shown as the name.
 */

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { usePrefetchReferenceDataQuery } from '@/graphql/generated/graphql';
import { useRecentStandardVariables } from '@/hooks/useRecentStandardVariables';
import {
  RECENT_GROUP_KEY,
  buildStandardVariableGroups,
  highlightRanges,
} from '@/lib/standard-variable-search';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface StandardVariableOption {
  id: string;
  label: string;
  description: string | null;
}

export interface StandardVariableComboboxProps {
  /** Currently selected standard variable, or null if none selected. */
  value: StandardVariableOption | null;
  /** Called when selection changes. Receives null when cleared. */
  onChange: (sv: StandardVariableOption | null) => void;
  /** Optional placeholder text for the trigger button. */
  placeholder?: string;
  /** Disables the combobox. */
  disabled?: boolean;
  /** Additional className for the trigger button. */
  className?: string;
  /** When provided, renders a "request a new standard variable" footer action. */
  onRequestNew?: () => void;
}

/** Render text with the matched query substring highlighted. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  const range = ranges[0];
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 text-inherit">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export function StandardVariableCombobox({
  value,
  onChange,
  placeholder = 'Search standard variables...',
  disabled = false,
  className,
  onRequestNew,
}: StandardVariableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Reads from Apollo cache — cache-first means no network call if already fetched
  const { data, loading } = usePrefetchReferenceDataQuery({ fetchPolicy: 'cache-first' });

  const options: StandardVariableOption[] = React.useMemo(() => {
    if (!data?.modelcatalog_standard_variable) return [];
    return data.modelcatalog_standard_variable.map((sv) => ({
      id: sv.id,
      label: sv.label ?? '',
      description: sv.description ?? null,
    }));
  }, [data]);

  const { recent, recordUse } = useRecentStandardVariables();

  const recentIds = React.useMemo(() => recent.map((r) => r.id), [recent]);

  const result = React.useMemo(
    () => buildStandardVariableGroups(options, recentIds, search),
    [options, recentIds, search],
  );

  const handleSelect = React.useCallback(
    (selectedId: string) => {
      if (value?.id === selectedId) {
        onChange(null);
      } else {
        const found = options.find((o) => o.id === selectedId) ?? null;
        onChange(found);
        if (found) recordUse(found);
      }
      setOpen(false);
      setSearch('');
    },
    [value, options, onChange, recordUse],
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch('');
  }, []);

  const triggerLabel = value?.label ?? placeholder;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select standard variable"
          disabled={disabled || loading}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {loading ? 'Loading...' : triggerLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {result.groups.length === 0 ? (
              <CommandEmpty>No matching standard variables.</CommandEmpty>
            ) : (
              <>
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                  Showing {result.matchCount} of {result.total}
                </div>
                {result.groups.map((group) => (
                  <CommandGroup
                    key={group.key}
                    heading={
                      <span className="flex items-center justify-between">
                        <span>{group.key}</span>
                        {group.key !== RECENT_GROUP_KEY && (
                          <span className="rounded-full bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">
                            {group.options.length}
                          </span>
                        )}
                      </span>
                    }
                  >
                    {group.options.map((opt) => (
                      <CommandItem key={opt.id} value={opt.id} onSelect={() => handleSelect(opt.id)}>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            value?.id === opt.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span
                            className={cn(
                              'truncate font-medium',
                              opt.isUnnamed && 'text-muted-foreground',
                            )}
                          >
                            <Highlighted text={opt.displayLabel} query={search} />
                          </span>
                          {opt.isUnnamed
                            ? opt.label !== opt.displayLabel && (
                                <span className="truncate font-mono text-[10px] text-muted-foreground/60">
                                  {opt.label}
                                </span>
                              )
                            : opt.description && (
                                <span className="line-clamp-1 text-xs text-muted-foreground">
                                  {opt.description}
                                </span>
                              )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
            {onRequestNew && (
              <div className="border-t p-1">
                <button
                  type="button"
                  onClick={() => {
                    onRequestNew();
                    setOpen(false);
                  }}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
                >
                  + Request a new standard variable
                </button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run:
```bash
npm test -- StandardVariableCombobox
```
Expected: PASS. If the `not.toBeDisabled()` wait times out, the mocked query variables are wrong — confirm `PrefetchReferenceData` takes no variables and the mock uses `{}`.

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/components/autocomplete/StandardVariableCombobox.tsx ui-react/src/components/autocomplete/__tests__/StandardVariableCombobox.test.tsx
git commit -m "feat(ui-react): grouped, ranked standard variable picker"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run (from `ui-react/`):
```bash
npm test
```
Expected: all tests pass, including the four new files.

- [ ] **Step 2: Typecheck + lint + format**

Run:
```bash
npm run build && npm run lint && npm run format:check
```
Expected: `tsc -b` clean (no type errors — watch for `noUncheckedIndexedAccess` on tuple/array access), ESLint clean, Prettier clean. If `format:check` fails, run `npm run format` and re-commit.

- [ ] **Step 3: Manual smoke in the browser**

Run:
```bash
npm run dev
```
Then in the app, open Register Model → add an input → open the Standard Variable picker and confirm:
- Variables appear grouped by domain with count badges; "Unnamed / Other" is last.
- UUID entries show a description (or "Unnamed variable" area) rather than a raw UUID as the primary line.
- Typing `temp` re-ranks with label matches first and highlights the match.
- Selecting a variable, reopening the picker, shows it under "★/Recently used" at the top.

(If the local Hasura at `http://graphql.mint.local` is unreachable, the list will be empty — that is an environment issue, not a code defect; the automated tests cover the logic with mocked data.)

- [ ] **Step 4: Final commit if formatting changed**

```bash
git add -A
git commit -m "chore(ui-react): format standard variable picker" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- SVO grammar parser + categories + UUID detection → Task 2. ✓
- UUID demotion (description-as-label, Unnamed/Other bucket, still selectable) → Task 3 (`toDisplay`) + Task 5 render. ✓
- Ranked search (label over description, prefix/word-start) via match-sorter → Tasks 1, 3. ✓
- Recently-used localStorage pins → Task 4 + Task 5 wiring. ✓
- "Showing N of M" meta + highlight → Task 3 (`highlightRanges`, counts) + Task 5. ✓
- Request-new footer as optional stub (`onRequestNew`, default omitted) → Task 5. ✓
- Component boundaries (taxonomy / search / recency / component) → file structure. ✓
- Testing (unit per module + hook + component smoke) → Tasks 2–5. ✓
- Out of scope (DB column, AI, two-pane, inline create) → not present. ✓

**Type consistency:** `StandardVariableOption` defined in `StandardVariableCombobox.tsx`, imported type-only by the search module and the hook (no runtime cycle). `StandardVariableCategory` / `CATEGORY_ORDER` from taxonomy used by search. `buildStandardVariableGroups`/`rankStandardVariables`/`highlightRanges`/`RECENT_GROUP_KEY` names match across Task 3 and Task 5. `RECENT_STORAGE_KEY`/`recordUse`/`recent` match across Task 4 and its test and Task 5.

**Placeholder scan:** No TBD/TODO; every code step shows complete content; commands have expected output.
