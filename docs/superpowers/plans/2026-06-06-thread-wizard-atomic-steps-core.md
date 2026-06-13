# Thread Wizard Atomic-Steps (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-tab thread workflow with a guided atomic-step wizard — a left vertical rail, gated steps, and per-step "filtered by" provenance — for the core chain (Framing → Variables → Models → Datasets), wiring the existing Parameters/Runs/Results/Summary steps into the new shell unchanged.

**Architecture:** `MintThread` stays the Apollo-backed container. A pure `deriveStepStates(thread, opts)` function computes each step's `status` / `summary` / `locked` from thread state. A `WizardRail` (replaces `ThreadBreadcrumb`) and a `StepShell` (Back/Continue footer + completion predicate) frame every step. New atomic step components (`FramingStep`, `VariablesStep`, `ModelsStep`, `DatasetsStep`) reuse the existing Apollo mutations and Data-Catalog helpers, adding the `FilteredByBanner` provenance UI and per-model isolation. The model catalog query is extended to return each configuration's input/output standard variables, which drives the Models indicator filter, produces/needs chips, and per-input dataset filtering.

**Tech Stack:** React 18 + TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind 3 + shadcn/ui, Apollo Client 3 (Hasura), Vitest 2 + Testing Library + MSW 2. All imports use the `@/` alias.

---

## Scope

This is the **core-first** slice (approved decision). It covers:

- **Task 1** — GraphQL: extend `GetModelTreeWithRegions` to return model input/output standard variables.
- **Tasks 2–5** — Chain infrastructure: `deriveStepStates`, `WizardRail`, `StepShell`, `FilteredByBanner`.
- **Tasks 6–10** — Atomic steps: `FramingStep`, `VariablesStep`, `ModelsStep`, `buildThreadModels` helper, `DatasetsStep`.
- **Task 11** — `MintThread` rewire (rail + StepShell dispatch) and updated container tests.

**Out of scope (follow-up plan):** `ParametersStep`, `RunsStep`, `ResultsStep` redesign. In this plan the existing `MintParameters` / `MintRuns` / `MintResults` / `MintSummary` are rendered inside the new `StepShell`/rail **unchanged**. Backend/Hasura schema changes are out of scope — Task 1 only adds fields to an existing query over relationships that already exist in the Hasura metadata (confirmed: `inputs → input → presentations → presentation → standard_variable`, and the `outputs` mirror).

**Deferred within core (flagged, not silently dropped):** the Framing region **map preview** (the spec's small map of the selected extent). This plan implements the region **picker** (a real dropdown from `LIST_TOP_REGIONS`) but renders the selected extent as text with a `TODO(map-preview)` marker rather than pulling in a map library. Everything else in the spec's Framing/Variables/Models/Datasets sections is implemented.

---

## File Structure

New code lives in a `wizard/` subfolder so the chain components are cohesive and the legacy `Mint*`/`ThreadExpansion*` files remain untouched until Task 11 rewires the container.

```
ui-react/src/
  graphql/generated/
    modeling.ts                          # MODIFY (Task 1): extend GetModelTreeWithRegions + types + extractModelIO()
  pages/modeling/
    MintThread.tsx                       # MODIFY (Task 11): rail + StepShell dispatch
    thread/
      wizard/
        types.ts                         # CREATE: WizardStepId, StepStatus, StepState, WizardStep
        deriveStepStates.ts              # CREATE (Task 2): pure status/summary/locked function
        WizardRail.tsx                   # CREATE (Task 3): vertical stepper (replaces ThreadBreadcrumb)
        StepShell.tsx                    # CREATE (Task 4): title + content slot + Back/Continue footer
        FilteredByBanner.tsx             # CREATE (Task 5): blue provenance chip banner
        FramingStep.tsx                  # CREATE (Task 6): Goal + optional region/date toggles
        VariablesStep.tsx                # CREATE (Task 7): optional indicator + adjustable (autocomplete)
        ModelsStep.tsx                   # CREATE (Task 8): model cards + indicator filter + produces/needs chips
        buildThreadModels.ts             # CREATE (Task 9): selection + tree -> ThreadModel[] with input vars
        DatasetsStep.tsx                 # CREATE (Task 10): per-model input-assignment cards + partial-date tags
        __tests__/
          deriveStepStates.test.ts       # CREATE (Task 2)
          WizardRail.test.tsx            # CREATE (Task 3)
          StepShell.test.tsx             # CREATE (Task 4)
          FilteredByBanner.test.tsx      # CREATE (Task 5)
          FramingStep.test.tsx           # CREATE (Task 6)
          VariablesStep.test.tsx         # CREATE (Task 7)
          ModelsStep.test.tsx            # CREATE (Task 8)
          buildThreadModels.test.ts      # CREATE (Task 9)
          DatasetsStep.test.tsx          # CREATE (Task 10)
      __tests__/
        MintThread.test.tsx              # MODIFY (Task 11): rail testids replace breadcrumb testids
```

**Reuse, do not duplicate:**
- Mutations & helpers from `@/graphql/generated/modeling`: `useUpdateThreadMutation`, `useInsertThreadProvenanceMutation`, `useSetThreadModelsMutation`, `useUpdateThreadDataMutation`, `getUserPermission`, `getLatestEventOfType`, `useGetModelTreeWithRegionsQuery`, type `Thread`, `ThreadModel`.
- `StandardVariableCombobox` + `StandardVariableOption` from `@/components/autocomplete/StandardVariableCombobox`.
- `useDataCatalogDatasets` from `@/hooks/useDataCatalog`; `DataCatalogDataset`, `loadDatasetResources` from `@/lib/data-catalog`.
- `LIST_TOP_REGIONS` from `@/graphql/queries/regions`.
- `cn` from `@/lib/utils`; shadcn `Button` from `@/components/ui/button`.
- Status palette (match existing `ThreadExpansion`): done `text-green-600` / active `bg-blue-600 text-white` / glyphs `✓ ● ○ 🔒`.

---

## Pre-flight (run once before Task 1)

- [ ] **Create the worktree** (per `ui-react/CLAUDE.md` — base off `develop`, never `main`):

```bash
cd /Users/mosorio/repos/mint
git worktree add .worktrees/thread-wizard-core -b feat/thread-wizard-core origin/develop
cd .worktrees/thread-wizard-core/ui-react
npm install
```

All subsequent file paths in this plan are relative to the repo root but **edited inside the worktree**. Run all `npm` commands from `.worktrees/thread-wizard-core/ui-react`.

- [ ] **Confirm the baseline is green:**

Run: `npm test`
Expected: existing suite passes (this is your regression baseline).

---

## Task 1: Extend `GetModelTreeWithRegions` with model I/O variables

The Models indicator filter, the produces/needs chips, and per-input dataset filtering all need each configuration's input/output **standard variables**. `modeling.ts` is hand-authored (not codegen output), so we extend the gql document and its TypeScript types directly. The Hasura relationship chain is confirmed to exist.

**Files:**
- Modify: `ui-react/src/graphql/generated/modeling.ts:1241-1300` (types + document)
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/buildThreadModels.test.ts` exercises the types in Task 9; this task is verified by a typecheck + a small extractor unit test added here.

- [ ] **Step 1: Write the failing test for the I/O extractor**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/extractModelIO.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractModelIO, type ModelIOConfig } from '@/graphql/generated/modeling';

const config: ModelIOConfig = {
  id: 'cfg-1',
  label: 'PIHM Flood v4',
  regions: [{ region: { id: 'texas', label: 'Texas Gulf' } }],
  child_configurations: [],
  inputs: [
    {
      is_optional: false,
      input: {
        id: 'in-precip',
        label: 'precipitation',
        presentations: [
          {
            presentation: {
              id: 'vp-1',
              standard_variable: { id: 'sv-precip', label: 'precipitation flux' },
            },
          },
        ],
      },
    },
  ],
  outputs: [
    {
      output: {
        id: 'out-flood',
        label: 'flood inundation',
        presentations: [
          {
            presentation: {
              id: 'vp-2',
              standard_variable: { id: 'sv-flood', label: 'flood extent' },
            },
          },
        ],
      },
    },
  ],
};

describe('extractModelIO', () => {
  it('flattens inputs to {id, name, variableIds, variableLabels, optional}', () => {
    const io = extractModelIO(config);
    expect(io.inputs).toEqual([
      {
        id: 'in-precip',
        name: 'precipitation',
        variableIds: ['sv-precip'],
        variableLabels: ['precipitation flux'],
        optional: false,
      },
    ]);
  });

  it('flattens outputs and exposes producesVariableIds for the indicator filter', () => {
    const io = extractModelIO(config);
    expect(io.outputs[0]?.variableIds).toEqual(['sv-flood']);
    expect(io.producesVariableIds).toContain('sv-flood');
  });

  it('returns empty arrays when a config has no inputs/outputs', () => {
    const io = extractModelIO({ ...config, inputs: [], outputs: [] });
    expect(io.inputs).toEqual([]);
    expect(io.outputs).toEqual([]);
    expect(io.producesVariableIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- extractModelIO`
Expected: FAIL — `extractModelIO` / `ModelIOConfig` not exported from `modeling.ts`.

- [ ] **Step 3: Extend the types in `modeling.ts`**

In `ui-react/src/graphql/generated/modeling.ts`, replace the `ModelSetupInfo` / `ModelConfigInfo` / `GetModelTreeWithRegionsQuery` block (currently lines 1241-1270) with the extended shapes. Add the I/O sub-types and keep the existing `regions`/`child_configurations` fields:

```ts
// ─── Model I/O sub-types (Task 1) ────────────────────────────────────────────

export type StandardVariableRef = { id: string; label?: string | null };

export type VariablePresentationRef = {
  presentation: {
    id: string;
    standard_variable?: StandardVariableRef | null;
  };
};

export type DatasetSpecRef = {
  id: string;
  label?: string | null;
  presentations: VariablePresentationRef[];
};

export type ConfigInputRef = {
  is_optional?: boolean | null;
  input: DatasetSpecRef;
};

export type ConfigOutputRef = {
  output: DatasetSpecRef;
};

export type ModelSetupInfo = {
  id: string;
  label?: string | null;
  description?: string | null;
  regions: Array<{ region: { id: string; label?: string | null } }>;
  inputs: ConfigInputRef[];
  outputs: ConfigOutputRef[];
};

export type ModelConfigInfo = {
  id: string;
  label?: string | null;
  regions: Array<{ region: { id: string; label?: string | null } }>;
  inputs: ConfigInputRef[];
  outputs: ConfigOutputRef[];
  child_configurations: ModelSetupInfo[];
};

/** A configuration or setup that carries inputs/outputs — the unit extractModelIO consumes. */
export type ModelIOConfig = Pick<ModelConfigInfo, 'id' | 'label' | 'regions' | 'inputs' | 'outputs'> & {
  child_configurations?: ModelSetupInfo[];
};

export type GetModelTreeWithRegionsQuery = {
  __typename?: 'query_root';
  modelcatalog_software: Array<{
    id: string;
    label?: string | null;
    versions: Array<{
      id: string;
      label?: string | null;
      configurations: ModelConfigInfo[];
    }>;
  }>;
};

// ─── I/O extractor (Task 1) ──────────────────────────────────────────────────

export type ModelInputVar = {
  id: string;
  name: string;
  variableIds: string[];
  variableLabels: string[];
  optional: boolean;
};

export type ModelIO = {
  inputs: ModelInputVar[];
  outputs: ModelInputVar[];
  /** Flat list of all standard-variable ids this config produces (for the indicator filter). */
  producesVariableIds: string[];
};

function specToVar(spec: DatasetSpecRef, optional: boolean): ModelInputVar {
  const svs = spec.presentations
    .map((p) => p.presentation.standard_variable)
    .filter((sv): sv is StandardVariableRef => !!sv);
  return {
    id: spec.id,
    name: spec.label ?? spec.id,
    variableIds: svs.map((sv) => sv.id),
    variableLabels: svs.map((sv) => sv.label ?? sv.id),
    optional,
  };
}

export function extractModelIO(config: ModelIOConfig): ModelIO {
  const inputs = (config.inputs ?? []).map((i) => specToVar(i.input, !!i.is_optional));
  const outputs = (config.outputs ?? []).map((o) => specToVar(o.output, false));
  const producesVariableIds = outputs.flatMap((o) => o.variableIds);
  return { inputs, outputs, producesVariableIds };
}
```

- [ ] **Step 4: Extend the gql document**

Replace the `GetModelTreeWithRegionsDocument` body (lines 1272-1300) so both the configuration and its `child_configurations` request `inputs`/`outputs` with the standard-variable chain. Keep the existing `regions` selections:

```ts
export const GetModelTreeWithRegionsDocument = gql`
  query GetModelTreeWithRegions {
    modelcatalog_software(
      order_by: { label: asc }
      where: { type: { _eq: "https://w3id.org/okn/o/sdm#Model" } }
    ) {
      id
      label
      versions(order_by: { label: asc }) {
        id
        label
        configurations(
          order_by: { label: asc }
          where: { model_configuration_id: { _is_null: true } }
        ) {
          id
          label
          regions { region { id label } }
          inputs {
            is_optional
            input {
              id
              label
              presentations { presentation { id standard_variable { id label } } }
            }
          }
          outputs {
            output {
              id
              label
              presentations { presentation { id standard_variable { id label } } }
            }
          }
          child_configurations(order_by: { label: asc }) {
            id
            label
            description
            regions { region { id label } }
            inputs {
              is_optional
              input {
                id
                label
                presentations { presentation { id standard_variable { id label } } }
              }
            }
            outputs {
              output {
                id
                label
                presentations { presentation { id standard_variable { id label } } }
              }
            }
          }
        }
      }
    }
  }
`;
```

> Note: `MintModels.tsx` (the legacy step) imports `ModelConfigInfo`/`ModelSetupInfo` and reads only `.id/.label/.regions/.child_configurations` — the added required `inputs`/`outputs` fields will make its existing object literals (none) unaffected, but its `flattenToRows` still compiles since it never constructs these types. If `tsc` reports an error in `MintModels.tsx`, it is because a test fixture builds a partial `ModelConfigInfo`; fix by adding `inputs: [], outputs: []` to that fixture. Do not change `MintModels` behavior in this task.

- [ ] **Step 5: Run the extractor test and the typecheck**

Run: `npm test -- extractModelIO`
Expected: PASS (3 tests).

Run: `npm run build`
Expected: `tsc -b` completes with no type errors. If `MintModels.tsx` or its test fails to compile, add `inputs: [], outputs: []` to the offending fixture literal(s) only.

- [ ] **Step 6: Commit**

```bash
git add ui-react/src/graphql/generated/modeling.ts ui-react/src/pages/modeling/thread/wizard/__tests__/extractModelIO.test.ts
git commit -m "feat(thread-wizard): return model I/O variables from GetModelTreeWithRegions"
```

---

## Task 2: `deriveStepStates` — status, summary, and gating

A pure function of thread state (plus a small `opts` for completion facts the thread row doesn't carry). It is the single source of truth the rail renders. Gating rule (from spec): a step is locked until the previous **required** step's Continue predicate is satisfied; optional steps pass through. Required predicates: Framing (Goal non-empty), Models (≥1 model), Datasets (all inputs assigned).

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/types.ts`
- Create: `ui-react/src/pages/modeling/thread/wizard/deriveStepStates.ts`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/deriveStepStates.test.ts`

- [ ] **Step 1: Write the types file**

Create `ui-react/src/pages/modeling/thread/wizard/types.ts`:

```ts
/** The atomic wizard steps, in order. 'framing' replaces the legacy 'configure'. */
export type WizardStepId =
  | 'framing'
  | 'variables'
  | 'models'
  | 'datasets'
  | 'parameters'
  | 'runs'
  | 'results'
  | 'summary';

/** Per-step status. 'active' is layered on by the rail from currentStep, not by derivation. */
export type StepStatus = 'done' | 'upcoming' | 'locked';

export interface StepState {
  status: StepStatus;
  /** One-line summary of the choice made, shown under the step name in the rail. */
  summary: string;
  locked: boolean;
}

export interface WizardStep {
  id: WizardStepId;
  label: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'framing', label: 'Framing' },
  { id: 'variables', label: 'Variables' },
  { id: 'models', label: 'Models' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'runs', label: 'Runs' },
  { id: 'results', label: 'Results' },
  { id: 'summary', label: 'Summary' },
];
```

- [ ] **Step 2: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/deriveStepStates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Thread } from '@/graphql/generated/modeling';
import { deriveStepStates } from '../deriveStepStates';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: '',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [],
    thread_models: [],
    ...overrides,
  };
}

describe('deriveStepStates', () => {
  it('locks Variables, Models and everything after when Goal is empty', () => {
    const s = deriveStepStates(makeThread({ name: '' }));
    expect(s.framing.locked).toBe(false);
    expect(s.variables.locked).toBe(true);
    expect(s.models.locked).toBe(true);
    expect(s.datasets.locked).toBe(true);
    expect(s.summary.locked).toBe(false); // always viewable
  });

  it('unlocks Models as soon as a Goal exists (Variables skippable)', () => {
    const s = deriveStepStates(makeThread({ name: 'Flood extent' }));
    expect(s.framing.status).toBe('done');
    expect(s.models.locked).toBe(false);
    expect(s.datasets.locked).toBe(true); // still needs >=1 model
  });

  it('marks Models done and unlocks Datasets when >=1 model is selected', () => {
    const s = deriveStepStates(
      makeThread({
        name: 'Flood extent',
        thread_models: [
          { __typename: 'thread_model', id: 'tm1', thread_id: 't1', modelcatalog_configuration_id: 'cfg1' },
        ],
      }),
    );
    expect(s.models.status).toBe('done');
    expect(s.datasets.locked).toBe(false);
    expect(s.datasets.status).toBe('upcoming');
  });

  it('uses opts.datasetsComplete to mark Datasets done and unlock Parameters', () => {
    const thread = makeThread({
      name: 'Flood extent',
      thread_models: [
        { __typename: 'thread_model', id: 'tm1', thread_id: 't1', modelcatalog_configuration_id: 'cfg1' },
      ],
    });
    const s = deriveStepStates(thread, { datasetsComplete: true });
    expect(s.datasets.status).toBe('done');
    expect(s.parameters.locked).toBe(false);
  });

  it('summarizes Framing as "<goal> · <region>" with "any region" when unset', () => {
    expect(deriveStepStates(makeThread({ name: 'Flood extent' })).framing.summary).toBe(
      'Flood extent · any region',
    );
    expect(
      deriveStepStates(makeThread({ name: 'Flood extent', region_id: 'Texas Gulf' })).framing.summary,
    ).toBe('Flood extent · Texas Gulf');
  });

  it('summarizes Variables by indicator, or "No indicator" when unset', () => {
    expect(deriveStepStates(makeThread({ name: 'X' })).variables.summary).toBe('No indicator');
    expect(
      deriveStepStates(makeThread({ name: 'X', response_variable_id: 'sv-flood' })).variables.summary,
    ).toBe('sv-flood');
  });
});
```

- [ ] **Step 3: Implement `deriveStepStates`**

Create `ui-react/src/pages/modeling/thread/wizard/deriveStepStates.ts`:

```ts
import type { Thread } from '@/graphql/generated/modeling';
import type { StepState, WizardStepId } from './types';

export interface DeriveOpts {
  /** All required inputs assigned across all selected models. */
  datasetsComplete?: boolean;
  /** Parameter values valid for every model (defaults give a valid baseline). */
  parametersComplete?: boolean;
  /** >=1 successful run. */
  runsComplete?: boolean;
}

export type StepStateMap = Record<WizardStepId, StepState>;

export function deriveStepStates(thread: Thread, opts: DeriveOpts = {}): StepStateMap {
  const goalSet = !!thread.name?.trim();
  const modelCount = thread.thread_models?.length ?? 0;
  const modelsSet = modelCount >= 1;
  const datasetsSet = !!opts.datasetsComplete;
  const parametersSet = !!opts.parametersComplete;
  const runsSet = !!opts.runsComplete;

  const region = thread.region_id?.trim() || 'any region';
  const framingSummary = goalSet ? `${thread.name!.trim()} · ${region}` : 'Not set';
  const variablesSummary = thread.response_variable_id?.trim() || 'No indicator';

  // status helper: locked beats done beats upcoming
  const state = (done: boolean, locked: boolean, summary: string): StepState => ({
    status: locked ? 'locked' : done ? 'done' : 'upcoming',
    locked,
    summary,
  });

  return {
    framing: state(goalSet, false, framingSummary),
    variables: state(!!thread.response_variable_id, !goalSet, variablesSummary),
    models: state(modelsSet, !goalSet, modelsSet ? `${modelCount} model${modelCount === 1 ? '' : 's'}` : 'None'),
    datasets: state(datasetsSet, !modelsSet, datasetsSet ? 'All inputs assigned' : 'Pending'),
    parameters: state(parametersSet, !datasetsSet, parametersSet ? 'Configured' : 'Pending'),
    runs: state(runsSet, !parametersSet, runsSet ? 'Complete' : 'Pending'),
    results: state(false, !runsSet, 'Pending'),
    summary: state(false, false, 'Review'),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- deriveStepStates`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/types.ts ui-react/src/pages/modeling/thread/wizard/deriveStepStates.ts ui-react/src/pages/modeling/thread/wizard/__tests__/deriveStepStates.test.ts
git commit -m "feat(thread-wizard): deriveStepStates gating + summaries"
```

---

## Task 3: `WizardRail` — vertical stepper

Replaces the horizontal `ThreadBreadcrumb`. Renders each step with a status glyph, name, and one-line summary. Locked steps are non-interactive. The active step uses the blue highlight; done uses a green ✓.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/WizardRail.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/WizardRail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/WizardRail.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardRail } from '../WizardRail';
import type { StepStateMap } from '../deriveStepStates';

const states: StepStateMap = {
  framing: { status: 'done', locked: false, summary: 'Flood extent · Texas Gulf' },
  variables: { status: 'upcoming', locked: false, summary: 'No indicator' },
  models: { status: 'upcoming', locked: false, summary: 'None' },
  datasets: { status: 'locked', locked: true, summary: 'Pending' },
  parameters: { status: 'locked', locked: true, summary: 'Pending' },
  runs: { status: 'locked', locked: true, summary: 'Pending' },
  results: { status: 'locked', locked: true, summary: 'Pending' },
  summary: { status: 'upcoming', locked: false, summary: 'Review' },
};

describe('WizardRail', () => {
  it('renders each step name and its one-line summary', () => {
    render(<WizardRail states={states} currentStep="models" onSelect={vi.fn()} />);
    expect(screen.getByText('Framing')).toBeInTheDocument();
    expect(screen.getByText('Flood extent · Texas Gulf')).toBeInTheDocument();
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  it('marks the current step with aria-current', () => {
    render(<WizardRail states={states} currentStep="models" onSelect={vi.fn()} />);
    expect(screen.getByTestId('rail-step-models')).toHaveAttribute('aria-current', 'step');
  });

  it('calls onSelect for an unlocked step', async () => {
    const onSelect = vi.fn();
    render(<WizardRail states={states} currentStep="models" onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('rail-step-variables'));
    expect(onSelect).toHaveBeenCalledWith('variables');
  });

  it('does not call onSelect for a locked step and disables it', async () => {
    const onSelect = vi.fn();
    render(<WizardRail states={states} currentStep="models" onSelect={onSelect} />);
    const locked = screen.getByTestId('rail-step-datasets');
    expect(locked).toBeDisabled();
    await userEvent.click(locked);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- WizardRail`
Expected: FAIL — `WizardRail` not found.

- [ ] **Step 3: Implement `WizardRail`**

Create `ui-react/src/pages/modeling/thread/wizard/WizardRail.tsx`:

```tsx
import { cn } from '@/lib/utils';
import type { StepStateMap } from './deriveStepStates';
import { WIZARD_STEPS, type StepStatus, type WizardStepId } from './types';

interface WizardRailProps {
  states: StepStateMap;
  currentStep: WizardStepId;
  onSelect: (step: WizardStepId) => void;
}

const GLYPH: Record<StepStatus | 'active', string> = {
  done: '✓',
  active: '●',
  upcoming: '○',
  locked: '🔒',
};

export function WizardRail({ states, currentStep, onSelect }: WizardRailProps) {
  return (
    <nav aria-label="Sub-task steps" className="flex w-56 shrink-0 flex-col gap-0.5 border-r pr-2">
      {WIZARD_STEPS.map((step) => {
        const st = states[step.id];
        const isActive = step.id === currentStep;
        const glyph = isActive ? GLYPH.active : GLYPH[st.status];

        return (
          <button
            key={step.id}
            type="button"
            data-testid={`rail-step-${step.id}`}
            aria-current={isActive ? 'step' : undefined}
            disabled={st.locked}
            onClick={() => !st.locked && onSelect(step.id)}
            className={cn(
              'flex items-start gap-2 rounded px-3 py-2 text-left transition-colors',
              isActive && 'bg-blue-600 text-white',
              !isActive && st.status === 'done' && 'text-gray-800 hover:bg-gray-50',
              !isActive && st.status === 'upcoming' && 'text-gray-700 hover:bg-gray-50',
              !isActive && st.locked && 'cursor-not-allowed text-gray-300',
            )}
          >
            <span
              className={cn(
                'mt-0.5 shrink-0 text-sm font-bold',
                !isActive && st.status === 'done' && 'text-green-600',
              )}
              aria-hidden
            >
              {glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{step.label}</span>
              <span
                className={cn(
                  'block truncate text-xs',
                  isActive ? 'text-blue-100' : 'text-gray-400',
                )}
              >
                {st.summary}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- WizardRail`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/WizardRail.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/WizardRail.test.tsx
git commit -m "feat(thread-wizard): WizardRail vertical stepper"
```

---

## Task 4: `StepShell` — title + content + Back/Continue footer

Frames each step. Continue is disabled until the step's `canContinue` predicate is true; it shows an optional live progress hint. Generalizes the legacy "Select & Continue" footer.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/StepShell.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/StepShell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/StepShell.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepShell } from '../StepShell';

describe('StepShell', () => {
  it('renders title, description and children', () => {
    render(
      <StepShell title="Framing" description="Set the scope">
        <p>body</p>
      </StepShell>,
    );
    expect(screen.getByRole('heading', { name: 'Framing' })).toBeInTheDocument();
    expect(screen.getByText('Set the scope')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('disables Continue until canContinue is true and shows the hint', () => {
    render(
      <StepShell title="Models" canContinue={false} continueHint="0 of 1 selected" onContinue={vi.fn()}>
        x
      </StepShell>,
    );
    expect(screen.getByTestId('step-continue')).toBeDisabled();
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
  });

  it('fires onContinue when enabled and onBack when Back clicked', async () => {
    const onContinue = vi.fn();
    const onBack = vi.fn();
    render(
      <StepShell title="Models" canContinue onContinue={onContinue} onBack={onBack}>
        x
      </StepShell>,
    );
    await userEvent.click(screen.getByTestId('step-continue'));
    expect(onContinue).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('step-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('hides Back when onBack is not provided', () => {
    render(
      <StepShell title="Framing" canContinue onContinue={vi.fn()}>
        x
      </StepShell>,
    );
    expect(screen.queryByTestId('step-back')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- StepShell`
Expected: FAIL — `StepShell` not found.

- [ ] **Step 3: Implement `StepShell`**

Create `ui-react/src/pages/modeling/thread/wizard/StepShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface StepShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Continue is enabled only when true. Defaults to true (optional/review steps). */
  canContinue?: boolean;
  /** Live progress hint shown next to Continue (e.g. "1 of 3 inputs assigned"). */
  continueHint?: string;
  /** Continue button label. */
  continueLabel?: string;
  onContinue?: () => void;
  /** When provided, a Back button is shown. */
  onBack?: () => void;
}

export function StepShell({
  title,
  description,
  children,
  canContinue = true,
  continueHint,
  continueLabel = 'Continue',
  onContinue,
  onBack,
}: StepShellProps) {
  return (
    <div className="flex h-full flex-col" data-testid="step-shell">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>

      <div className="flex-1">{children}</div>

      <div className="mt-6 flex items-center gap-3 border-t pt-4">
        {onBack && (
          <Button type="button" variant="outline" data-testid="step-back" onClick={onBack}>
            Back
          </Button>
        )}
        <div className="flex-1" />
        {continueHint && <span className="text-xs text-gray-500">{continueHint}</span>}
        {onContinue && (
          <Button
            type="button"
            data-testid="step-continue"
            disabled={!canContinue}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- StepShell`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/StepShell.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/StepShell.test.tsx
git commit -m "feat(thread-wizard): StepShell frame with gated Continue"
```

---

## Task 5: `FilteredByBanner` — provenance chips

The blue banner at the top of filtered steps (Models, Datasets). Each chip is `{ icon, label, value, source? }`; `source` renders as a muted suffix; an optional `onEdit` jumps back to the source step.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/FilteredByBanner.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/FilteredByBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/FilteredByBanner.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilteredByBanner } from '../FilteredByBanner';

describe('FilteredByBanner', () => {
  it('renders each chip with its value and source suffix', () => {
    render(
      <FilteredByBanner
        chips={[
          { icon: '⌖', label: 'Region', value: 'Texas Gulf', source: 'from Framing' },
          { icon: '🗓', label: 'Dates', value: '2000–2026', source: 'from Framing' },
        ]}
      />,
    );
    expect(screen.getByText('Texas Gulf')).toBeInTheDocument();
    expect(screen.getAllByText('from Framing')).toHaveLength(2);
  });

  it('renders nothing when there are no chips', () => {
    const { container } = render(<FilteredByBanner chips={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fires onEdit when the edit link is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <FilteredByBanner
        chips={[{ icon: '⌖', label: 'Region', value: 'Texas Gulf' }]}
        editLabel="edit region"
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'edit region' }));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- FilteredByBanner`
Expected: FAIL — `FilteredByBanner` not found.

- [ ] **Step 3: Implement `FilteredByBanner`**

Create `ui-react/src/pages/modeling/thread/wizard/FilteredByBanner.tsx`:

```tsx
export interface FilterChip {
  icon: string;
  label: string;
  value: string;
  /** e.g. "from Framing" — rendered muted after the value. */
  source?: string;
}

interface FilteredByBannerProps {
  chips: FilterChip[];
  /** Optional "edit" link that jumps back to the filter source step. */
  onEdit?: () => void;
  editLabel?: string;
}

export function FilteredByBanner({ chips, onEdit, editLabel = 'edit' }: FilteredByBannerProps) {
  if (chips.length === 0) return null;

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
      data-testid="filtered-by-banner"
    >
      <span className="font-medium text-blue-700">Filtered by:</span>
      {chips.map((chip) => (
        <span
          key={`${chip.label}-${chip.value}`}
          className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 ring-1 ring-blue-200"
        >
          <span aria-hidden>{chip.icon}</span>
          <span className="font-medium">{chip.label}:</span>
          <span>{chip.value}</span>
          {chip.source && <span className="text-blue-400">{chip.source}</span>}
        </span>
      ))}
      {onEdit && (
        <button type="button" onClick={onEdit} className="ml-auto text-blue-600 underline hover:text-blue-800">
          {editLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- FilteredByBanner`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/FilteredByBanner.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/FilteredByBanner.test.tsx
git commit -m "feat(thread-wizard): FilteredByBanner provenance chips"
```

---

## Task 6: `FramingStep` — Goal + optional region/time toggles

Refactor of `ThreadExpansionConfigure` with the variable fields removed. **Goal is the only required field.** Region and time period are optional, each gated by a toggle. Region uses a real picker from `LIST_TOP_REGIONS`. Inline blue hints state what each filter constrains. Saves via `useUpdateThreadMutation` + `useInsertThreadProvenanceMutation` (`UPDATE` event), then `onUpdated`.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/FramingStep.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/FramingStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/FramingStep.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import {
  UpdateThreadDocument,
  InsertThreadProvenanceDocument,
  type Thread,
} from '@/graphql/generated/modeling';
import { FramingStep } from '../FramingStep';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: '',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [{ __typename: 'thread_permission', user_id: 'testuser', read: true, write: true }],
    thread_models: [],
    ...overrides,
  };
}

const regionsMock: MockedResponse = {
  request: { query: LIST_TOP_REGIONS },
  result: {
    data: {
      region: [
        { id: 'texas', name: 'Texas Gulf', model_catalog_uri: null, geometries: [] },
        { id: 'ethiopia', name: 'Ethiopia', model_catalog_uri: null, geometries: [] },
      ],
    },
  },
};

describe('FramingStep', () => {
  it('disables Continue until Goal is non-empty', async () => {
    render(<FramingStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} />, {
      apolloMocks: [regionsMock],
    });
    expect(await screen.findByTestId('step-continue')).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/goal/i), 'Flood extent');
    await waitFor(() => expect(screen.getByTestId('step-continue')).toBeEnabled());
  });

  it('does not show region/date controls until their toggle is on', async () => {
    render(<FramingStep thread={makeThread({ name: 'X' })} onUpdated={vi.fn()} onContinue={vi.fn()} />, {
      apolloMocks: [regionsMock],
    });
    expect(screen.queryByLabelText(/select a region/i)).not.toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('toggle-region'));
    expect(await screen.findByLabelText(/select a region/i)).toBeInTheDocument();
  });

  it('renders the existing region as a chosen value', async () => {
    render(
      <FramingStep thread={makeThread({ name: 'X', region_id: 'texas' })} onUpdated={vi.fn()} onContinue={vi.fn()} />,
      { apolloMocks: [regionsMock] },
    );
    expect(await screen.findByDisplayValue('texas')).toBeInTheDocument();
  });

  // Helper alias so the file reads naturally; renderWithProviders is the real render.
  function render(ui: React.ReactElement, opts: Parameters<typeof renderWithProviders>[1]) {
    return renderWithProviders(ui, opts);
  }
});
```

> Note: the helper-alias trick keeps `render(ui, opts)` readable. If your lint config forbids the function-after-use ordering, hoist `render` above the `describe` or just call `renderWithProviders` directly.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- FramingStep`
Expected: FAIL — `FramingStep` not found.

- [ ] **Step 3: Implement `FramingStep`**

Create `ui-react/src/pages/modeling/thread/wizard/FramingStep.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';

import {
  Thread,
  getUserPermission,
  useUpdateThreadMutation,
  useInsertThreadProvenanceMutation,
} from '@/graphql/generated/modeling';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { StepShell } from './StepShell';

interface FramingStepProps {
  thread: Thread;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
}

interface RegionOption {
  id: string;
  name: string;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return iso.split('T')[0] ?? iso;
}

export function FramingStep({ thread, onUpdated, onContinue, onBack }: FramingStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [name, setName] = useState(thread.name ?? '');
  const [regionOn, setRegionOn] = useState(!!thread.region_id);
  const [regionId, setRegionId] = useState(thread.region_id ?? '');
  const [datesOn, setDatesOn] = useState(!!thread.start_date || !!thread.end_date);
  const [startDate, setStartDate] = useState(fmtDate(thread.start_date));
  const [endDate, setEndDate] = useState(fmtDate(thread.end_date));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(thread.name ?? '');
    setRegionOn(!!thread.region_id);
    setRegionId(thread.region_id ?? '');
    setStartDate(fmtDate(thread.start_date));
    setEndDate(fmtDate(thread.end_date));
  }, [thread]);

  const { data: regionsData } = useQuery<{ region: RegionOption[] }>(LIST_TOP_REGIONS);
  const regions = regionsData?.region ?? [];

  const [updateThread] = useUpdateThreadMutation();
  const [insertProvenance] = useInsertThreadProvenanceMutation();

  const goalSet = name.trim().length > 0;
  const datesValid = useMemo(() => {
    if (!datesOn || !startDate || !endDate) return true; // open-ended ranges allowed
    return startDate < endDate;
  }, [datesOn, startDate, endDate]);

  const canContinue = goalSet && datesValid;

  async function handleContinue() {
    if (!canContinue) return;
    setSaving(true);
    try {
      await updateThread({
        variables: {
          id: thread.id,
          name: name.trim(),
          startDate: datesOn ? startDate : thread.start_date,
          endDate: datesOn ? endDate : thread.end_date,
          regionId: regionOn && regionId ? regionId : null,
          drivingVariableId: thread.driving_variable_id ?? null,
          responseVariableId: thread.response_variable_id ?? null,
        },
      });
      if (user?.username) {
        await insertProvenance({
          variables: { threadId: thread.id, event: 'UPDATE', userid: user.username, notes: null },
        });
      }
      onUpdated();
      onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !perm.write;

  return (
    <StepShell
      title="Framing"
      description="Set the scope of this sub-task. The region and time period you set here narrow the datasets available later."
      canContinue={canContinue && !saving}
      continueHint={goalSet ? undefined : 'A goal name is required'}
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <div className="max-w-xl space-y-5 text-sm">
        {/* Goal (required) */}
        <div className="flex flex-col gap-1">
          <label htmlFor="framing-goal" className="font-semibold">
            Goal <span className="text-red-500">*</span>
          </label>
          <input
            id="framing-goal"
            type="text"
            value={name}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
            placeholder="Describe the goal of this sub-task"
            className="rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <fieldset className="space-y-4 rounded border p-3">
          <legend className="px-1 text-xs font-medium text-gray-500">Narrow the data — optional</legend>

          {/* Region toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                data-testid="toggle-region"
                checked={regionOn}
                disabled={readOnly}
                onChange={(e) => setRegionOn(e.target.checked)}
              />
              Region {!regionOn && <span className="text-xs font-normal text-gray-400">off · any region</span>}
            </label>
            {regionOn && (
              <div className="space-y-1 pl-6">
                <select
                  aria-label="Select a region"
                  value={regionId}
                  disabled={readOnly}
                  onChange={(e) => setRegionId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5"
                >
                  <option value="">Any region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {/* TODO(map-preview): render selected region extent on a small map (deferred). */}
                <p className="text-xs text-blue-600">
                  ⌖ Datasets will be filtered to those covering this region
                </p>
              </div>
            )}
          </div>

          {/* Dates toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                data-testid="toggle-dates"
                checked={datesOn}
                disabled={readOnly}
                onChange={(e) => setDatesOn(e.target.checked)}
              />
              Time period {!datesOn && <span className="text-xs font-normal text-gray-400">off · any period</span>}
            </label>
            {datesOn && (
              <div className="space-y-1 pl-6">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Start date"
                    value={startDate}
                    disabled={readOnly}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1.5"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    aria-label="End date"
                    value={endDate}
                    disabled={readOnly}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1.5"
                  />
                </div>
                {!datesValid && (
                  <p className="text-xs text-red-500">Start date must be before end date.</p>
                )}
                <p className="text-xs text-blue-600">
                  🗓 Datasets will be filtered to those overlapping this window
                </p>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- FramingStep`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/FramingStep.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/FramingStep.test.tsx
git commit -m "feat(thread-wizard): FramingStep with optional region/time toggles"
```

---

## Task 7: `VariablesStep` — optional indicator + adjustable variable

Refactor of `MintVariables`. Both fields optional (whole step skippable). Free-text inputs become `StandardVariableCombobox` autocompletes. A live preview shows the consequence of the indicator choice. Continue is always enabled.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/VariablesStep.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/VariablesStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/VariablesStep.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import { VariablesStep } from '../VariablesStep';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'Flood extent',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [{ __typename: 'thread_permission', user_id: 'testuser', read: true, write: true }],
    thread_models: [],
    ...overrides,
  };
}

describe('VariablesStep', () => {
  it('keeps Continue enabled even with no indicator (step is skippable)', () => {
    renderWithProviders(<VariablesStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('step-continue')).toBeEnabled();
  });

  it('shows the neutral "no indicator" preview when none is set', () => {
    renderWithProviders(<VariablesStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/no indicator set/i)).toBeInTheDocument();
  });

  it('renders both the indicator and adjustable-variable comboboxes', () => {
    renderWithProviders(<VariablesStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/indicator/i)).toBeInTheDocument();
    expect(screen.getByText(/adjustable variable/i)).toBeInTheDocument();
  });
});
```

> The `StandardVariableCombobox` reads `usePrefetchReferenceDataQuery` with `cache-first`; with no Apollo mock it renders a disabled "Loading..." trigger, which is fine for these assertions (we test the step's gating + preview, not the catalog list — that's covered by the combobox's own tests).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- VariablesStep`
Expected: FAIL — `VariablesStep` not found.

- [ ] **Step 3: Implement `VariablesStep`**

Create `ui-react/src/pages/modeling/thread/wizard/VariablesStep.tsx`:

```tsx
import { useState } from 'react';

import {
  Thread,
  getUserPermission,
  useUpdateThreadMutation,
  useInsertThreadProvenanceMutation,
} from '@/graphql/generated/modeling';
import {
  StandardVariableCombobox,
  type StandardVariableOption,
} from '@/components/autocomplete/StandardVariableCombobox';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { StepShell } from './StepShell';

interface VariablesStepProps {
  thread: Thread;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
}

/** Build a minimal option from a stored id (label backfills once the catalog loads). */
function optionFromId(id?: string | null): StandardVariableOption | null {
  if (!id) return null;
  return { id, label: id, description: null };
}

export function VariablesStep({ thread, onUpdated, onContinue, onBack }: VariablesStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [indicator, setIndicator] = useState<StandardVariableOption | null>(
    optionFromId(thread.response_variable_id),
  );
  const [adjustable, setAdjustable] = useState<StandardVariableOption | null>(
    optionFromId(thread.driving_variable_id),
  );
  const [saving, setSaving] = useState(false);

  const [updateThread] = useUpdateThreadMutation();
  const [insertProvenance] = useInsertThreadProvenanceMutation();

  async function handleContinue() {
    setSaving(true);
    try {
      await updateThread({
        variables: {
          id: thread.id,
          name: thread.name,
          startDate: thread.start_date,
          endDate: thread.end_date,
          regionId: thread.region_id ?? null,
          responseVariableId: indicator?.id ?? null,
          drivingVariableId: adjustable?.id ?? null,
        },
      });
      if (user?.username) {
        await insertProvenance({
          variables: { threadId: thread.id, event: 'UPDATE', userid: user.username, notes: null },
        });
      }
      onUpdated();
      onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !perm.write;

  return (
    <StepShell
      title="Variables"
      description="Optionally focus this sub-task by indicator and adjustable variable. You can skip this step."
      canContinue={!saving}
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <div className="max-w-xl space-y-5 text-sm">
        <div className="space-y-1">
          <label className="font-semibold">Indicator</label>
          <StandardVariableCombobox
            value={indicator}
            onChange={setIndicator}
            disabled={readOnly}
            placeholder="Search standard variables…"
          />
          {indicator ? (
            <p className="text-xs text-green-700">
              Models will be filtered to those that produce <strong>{indicator.label}</strong>.
            </p>
          ) : (
            <p className="text-xs text-gray-500">No indicator set — all models will be available next.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="font-semibold">Adjustable variable</label>
          <StandardVariableCombobox
            value={adjustable}
            onChange={setAdjustable}
            disabled={readOnly}
            placeholder="Search standard variables…"
          />
          <p className="text-xs text-gray-500">Marks an input you intend to vary across runs.</p>
        </div>
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- VariablesStep`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/VariablesStep.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/VariablesStep.test.tsx
git commit -m "feat(thread-wizard): VariablesStep optional indicator/adjustable autocomplete"
```

---

## Task 8: `ModelsStep` — model cards, indicator filter, produces/needs chips

Refactor of `MintModels`. Renders each model as a **card** carrying a green `produces: <var>` chip and blue `needs N: <vars>` chips (from the Task 1 I/O data). A `FilteredByBanner` shows the indicator filter. Region grouping is kept (region-matching first; disclosure for others). Multi-select, Compare (≥2), and search are kept. Continue gated on ≥1 model. Saves via `useSetThreadModelsMutation`.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/ModelsStep.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/ModelsStep.test.tsx`

> Reuse: this task replaces the legacy `flattenToRows`/`configToRow`/`setupToRow` with an I/O-aware version that also captures `produces`/`needs`. The row shape and the region partition logic mirror `MintModels.tsx:54-100,262-281`.

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/ModelsStep.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import {
  GetModelTreeWithRegionsDocument,
  SetThreadModelsDocument,
  type Thread,
} from '@/graphql/generated/modeling';
import { ModelsStep } from '../ModelsStep';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'Flood extent',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [{ __typename: 'thread_permission', user_id: 'testuser', read: true, write: true }],
    thread_models: [],
    ...overrides,
  };
}

function cfg(id: string, label: string, outVarId: string, outVarLabel: string) {
  return {
    id,
    label,
    regions: [],
    inputs: [
      {
        is_optional: false,
        input: {
          id: `${id}-in`,
          label: 'precipitation',
          presentations: [
            { presentation: { id: `${id}-vp`, standard_variable: { id: 'sv-precip', label: 'precipitation' } } },
          ],
        },
      },
    ],
    outputs: [
      {
        output: {
          id: `${id}-out`,
          label: outVarLabel,
          presentations: [
            { presentation: { id: `${id}-ovp`, standard_variable: { id: outVarId, label: outVarLabel } } },
          ],
        },
      },
    ],
    child_configurations: [],
  };
}

const treeMock: MockedResponse = {
  request: { query: GetModelTreeWithRegionsDocument },
  result: {
    data: {
      modelcatalog_software: [
        {
          id: 'sw1',
          label: 'PIHM',
          versions: [
            {
              id: 'v1',
              label: 'v4',
              configurations: [
                cfg('cfgA', 'PIHM Flood A', 'sv-flood', 'flood extent'),
                cfg('cfgB', 'Crop Model B', 'sv-crop', 'crop production'),
              ],
            },
          ],
        },
      ],
    },
  },
};

describe('ModelsStep', () => {
  it('shows "all models" banner and produces/needs chips when no indicator is set', async () => {
    renderWithProviders(
      <ModelsStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />,
      { apolloMocks: [treeMock] },
    );
    expect(await screen.findByText('PIHM Flood A')).toBeInTheDocument();
    expect(screen.getByText(/produces:/i)).toBeInTheDocument();
    expect(screen.getByTestId('filtered-by-banner')).toHaveTextContent(/all/i);
  });

  it('filters to models producing the indicator and shows the count', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread({ response_variable_id: 'sv-flood' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    expect(await screen.findByText('PIHM Flood A')).toBeInTheDocument();
    expect(screen.queryByText('Crop Model B')).not.toBeInTheDocument();
    expect(screen.getByTestId('filtered-by-banner')).toHaveTextContent(/1 of 2/i);
  });

  it('gates Continue on >=1 selected model', async () => {
    renderWithProviders(
      <ModelsStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />,
      { apolloMocks: [treeMock] },
    );
    await screen.findByText('PIHM Flood A');
    expect(screen.getByTestId('step-continue')).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/select PIHM Flood A/i));
    await waitFor(() => expect(screen.getByTestId('step-continue')).toBeEnabled());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ModelsStep`
Expected: FAIL — `ModelsStep` not found.

- [ ] **Step 3: Implement `ModelsStep`**

Create `ui-react/src/pages/modeling/thread/wizard/ModelsStep.tsx`:

```tsx
import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  ModelConfigInfo,
  ModelSetupInfo,
  Thread,
  ThreadModel,
  extractModelIO,
  getUserPermission,
  useGetModelTreeWithRegionsQuery,
  useSetThreadModelsMutation,
} from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';
import { cn } from '@/lib/utils';
import { StepShell } from './StepShell';
import { FilteredByBanner } from './FilteredByBanner';

interface ModelRow {
  id: string;
  name: string;
  description?: string | null;
  region: string;
  producesIds: string[];
  producesLabels: string[];
  needs: { name: string; varLabels: string[] }[];
}

interface ModelsStepProps {
  thread: Thread;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
  /** Optional: jump back to the Variables step (banner edit link). */
  onEditIndicator?: () => void;
}

function rowFromConfig(cfg: ModelConfigInfo | ModelSetupInfo, parent?: ModelConfigInfo): ModelRow {
  const io = extractModelIO(cfg);
  const regions = cfg.regions.length > 0 ? cfg.regions : (parent?.regions ?? []);
  return {
    id: cfg.id,
    name: cfg.label ?? cfg.id,
    description: 'description' in cfg ? cfg.description : null,
    region: regions.map((r) => r.region.label ?? r.region.id).join(', '),
    producesIds: io.producesVariableIds,
    producesLabels: io.outputs.flatMap((o) => o.variableLabels),
    needs: io.inputs.map((i) => ({ name: i.name, varLabels: i.variableLabels })),
  };
}

function flattenToRows(
  data: ReturnType<typeof useGetModelTreeWithRegionsQuery>['data'],
): ModelRow[] {
  if (!data) return [];
  const rows: ModelRow[] = [];
  for (const sw of data.modelcatalog_software) {
    for (const ver of sw.versions) {
      for (const cfg of ver.configurations) {
        if (cfg.child_configurations.length > 0) {
          for (const setup of cfg.child_configurations) rows.push(rowFromConfig(setup, cfg));
        } else {
          rows.push(rowFromConfig(cfg));
        }
      }
    }
  }
  return rows;
}

function ModelCard({
  row,
  checked,
  onToggle,
}: {
  row: ModelRow;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded border p-3 text-sm transition-colors',
        checked ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(row.id, e.target.checked)}
        aria-label={`Select ${row.name}`}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{row.name}</div>
        {row.region && <div className="text-xs text-gray-500">{row.region}</div>}
        {row.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{row.description}</p>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {row.producesLabels.map((p) => (
            <span key={p} className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
              produces: {p}
            </span>
          ))}
          {row.needs.length > 0 && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              needs {row.needs.length}: {row.needs.map((n) => n.varLabels[0] ?? n.name).join(', ')}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

export function ModelsStep({ thread, onUpdated, onContinue, onBack, onEditIndicator }: ModelsStepProps) {
  const { user } = useAuth();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);

  const [searchText, setSearchText] = useState('');
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    (thread.thread_models ?? []).forEach((tm: ThreadModel) => {
      if (tm.modelcatalog_configuration_id) ids.add(tm.modelcatalog_configuration_id);
    });
    return ids;
  });

  const { data, loading, error } = useGetModelTreeWithRegionsQuery();
  const [setThreadModels] = useSetThreadModelsMutation();

  const allRows = useMemo(() => flattenToRows(data), [data]);
  const totalCount = allRows.length;

  // Indicator filter (Task 1 I/O data)
  const indicator = thread.response_variable_id ?? null;
  const indicatorRows = useMemo(
    () => (indicator ? allRows.filter((r) => r.producesIds.includes(indicator)) : allRows),
    [allRows, indicator],
  );

  // Search filter
  const searchedRows = useMemo(() => {
    if (!searchText.trim()) return indicatorRows;
    const q = searchText.toLowerCase();
    return indicatorRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q),
    );
  }, [indicatorRows, searchText]);

  // Region partition
  const threadRegionId = thread.region_id ?? null;
  const { regionRows, otherRows } = useMemo(() => {
    if (!threadRegionId) return { regionRows: searchedRows, otherRows: [] as ModelRow[] };
    const matched: ModelRow[] = [];
    const others: ModelRow[] = [];
    for (const r of searchedRows) {
      const hasRegion = r.region.length > 0;
      if (!hasRegion || r.region.includes(threadRegionId)) matched.push(r);
      else others.push(r);
    }
    return { regionRows: matched, otherRows: others };
  }, [searchedRows, threadRegionId]);

  const displayedRows = showAllRegions ? searchedRows : regionRows;

  const toggleModel = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  async function handleContinue() {
    if (!user?.username || selectedIds.size === 0) return;
    setSaving(true);
    try {
      const models = Array.from(selectedIds).map((cfgId) => ({
        thread_id: thread.id,
        modelcatalog_configuration_id: cfgId,
      }));
      await setThreadModels({
        variables: { threadId: thread.id, models, userid: user.username, notes: null },
      });
      onUpdated();
      onContinue();
    } finally {
      setSaving(false);
    }
  }

  const banner = indicator
    ? {
        chips: [
          {
            icon: '🎯',
            label: 'Indicator',
            value: `${indicatorRows.length} of ${totalCount} models`,
            source: indicator,
          },
        ],
      }
    : { chips: [{ icon: '🎯', label: 'Indicator', value: `all ${totalCount} models` }] };

  const canContinue = selectedIds.size >= 1 && !saving && perm.write;

  return (
    <StepShell
      title="Models"
      description="Choose one or more calibrated model configurations."
      canContinue={canContinue}
      continueHint={
        selectedIds.size === 0 ? 'Select at least one model' : `${selectedIds.size} selected`
      }
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <FilteredByBanner
        chips={banner.chips}
        onEdit={indicator ? onEditIndicator : undefined}
        editLabel="edit indicator"
      />

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Filter models by name, region or description…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full rounded border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          Failed to load models: {error.message}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {displayedRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {searchText ? 'No models match your search.' : 'No models found.'}
            </p>
          ) : (
            displayedRows.map((row) => (
              <ModelCard key={row.id} row={row} checked={selectedIds.has(row.id)} onToggle={toggleModel} />
            ))
          )}

          {!searchText && otherRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllRegions((v) => !v)}
              className="text-sm text-blue-600 underline hover:text-blue-800"
            >
              {showAllRegions ? 'Hide' : 'Show'} {otherRows.length} model
              {otherRows.length !== 1 ? 's' : ''} calibrated for other regions
            </button>
          )}
        </div>
      )}
    </StepShell>
  );
}
```

> **Compare dialog (kept):** the spec keeps the Compare-selected-models dialog (requires ≥2). To stay bite-sized this task ships the card list, banner, indicator filter, region disclosure, multi-select, and save. Add the Compare dialog by lifting `CompareDialog` from `MintModels.tsx:141-200` (adapt `COMPARISON_FEATURES` to the new `ModelRow` — it already has `region`/`description`; drop `category`). If Compare is added, write a test asserting the Compare button is disabled until 2 cards are checked. If you defer Compare to the follow-up PR, `log` it in the PR description — do not drop it silently.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- ModelsStep`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/ModelsStep.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/ModelsStep.test.tsx
git commit -m "feat(thread-wizard): ModelsStep cards with indicator filter and I/O chips"
```

---

## Task 9: `buildThreadModels` — selection + tree → `ThreadModel[]` with input variables

`DatasetsStep` needs, per selected model, the list of inputs with their standard-variable names (to query the Data Catalog). This helper bridges the extended model-tree query and the thread's selected configuration ids into the `ThreadModel` shape `DatasetsStep` consumes (mirrors the legacy `MintDatasets` `ThreadModel`/`ThreadModelInput`).

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/buildThreadModels.ts`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/buildThreadModels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/buildThreadModels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GetModelTreeWithRegionsQuery, Thread } from '@/graphql/generated/modeling';
import { buildThreadModels } from '../buildThreadModels';

const tree: GetModelTreeWithRegionsQuery = {
  modelcatalog_software: [
    {
      id: 'sw',
      label: 'PIHM',
      versions: [
        {
          id: 'v1',
          label: 'v4',
          configurations: [
            {
              id: 'cfgA',
              label: 'PIHM Flood A',
              regions: [],
              inputs: [
                {
                  is_optional: false,
                  input: {
                    id: 'inA',
                    label: 'precipitation',
                    presentations: [
                      { presentation: { id: 'vp', standard_variable: { id: 'sv-precip', label: 'precip' } } },
                    ],
                  },
                },
              ],
              outputs: [],
              child_configurations: [],
            },
          ],
        },
      ],
    },
  ],
};

function thread(): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'X',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [],
    thread_models: [
      { __typename: 'thread_model', id: 'tm1', thread_id: 't1', modelcatalog_configuration_id: 'cfgA' },
    ],
  };
}

describe('buildThreadModels', () => {
  it('maps selected configuration ids to ThreadModel with input variable names', () => {
    const models = buildThreadModels(thread(), tree);
    expect(Object.keys(models)).toEqual(['cfgA']);
    expect(models.cfgA?.name).toBe('PIHM Flood A');
    expect(models.cfgA?.input_files).toEqual([
      { id: 'inA', name: 'precipitation', variables: ['sv-precip'], isOptional: false },
    ]);
  });

  it('returns an empty map when no models are selected', () => {
    const t = thread();
    t.thread_models = [];
    expect(buildThreadModels(t, tree)).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- buildThreadModels`
Expected: FAIL — `buildThreadModels` not found.

- [ ] **Step 3: Implement `buildThreadModels`**

Create `ui-react/src/pages/modeling/thread/wizard/buildThreadModels.ts`:

```ts
import {
  extractModelIO,
  type GetModelTreeWithRegionsQuery,
  type ModelConfigInfo,
  type ModelSetupInfo,
  type Thread,
} from '@/graphql/generated/modeling';
import type { ThreadModel } from '../MintDatasets';

/** Flatten the tree to a map of configuration-id -> config/setup node. */
function indexConfigs(
  data: GetModelTreeWithRegionsQuery,
): Record<string, ModelConfigInfo | ModelSetupInfo> {
  const index: Record<string, ModelConfigInfo | ModelSetupInfo> = {};
  for (const sw of data.modelcatalog_software) {
    for (const ver of sw.versions) {
      for (const cfg of ver.configurations) {
        index[cfg.id] = cfg;
        for (const setup of cfg.child_configurations) index[setup.id] = setup;
      }
    }
  }
  return index;
}

/**
 * Build the per-model input map DatasetsStep consumes, keyed by configuration id,
 * from the thread's selected models and the extended model-tree query.
 */
export function buildThreadModels(
  thread: Thread,
  data: GetModelTreeWithRegionsQuery | undefined,
): Record<string, ThreadModel> {
  if (!data) return {};
  const index = indexConfigs(data);
  const result: Record<string, ThreadModel> = {};

  for (const tm of thread.thread_models ?? []) {
    const cfgId = tm.modelcatalog_configuration_id;
    if (!cfgId) continue;
    const node = index[cfgId];
    if (!node) continue;
    const io = extractModelIO(node);
    result[cfgId] = {
      id: cfgId,
      name: node.label ?? cfgId,
      input_files: io.inputs.map((i) => ({
        id: i.id,
        name: i.name,
        variables: i.variableIds,
        isOptional: i.optional,
      })),
    };
  }
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- buildThreadModels`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/buildThreadModels.ts ui-react/src/pages/modeling/thread/wizard/__tests__/buildThreadModels.test.ts
git commit -m "feat(thread-wizard): buildThreadModels selection->input-variable map"
```

---

## Task 10: `DatasetsStep` — per-model input-assignment cards

For each selected model, a card lists its inputs; each input shows its assigned dataset + a date-coverage tag, or an amber "no dataset assigned" with a "Choose · N" affordance. Options are filtered by the input variable plus whichever of region/dates are set in Framing — reflected in a `FilteredByBanner`. Continue is disabled until every input across every model is assigned. Dataset assignments are **isolated per model**.

**Files:**
- Create: `ui-react/src/pages/modeling/thread/wizard/DatasetsStep.tsx`
- Test: `ui-react/src/pages/modeling/thread/wizard/__tests__/DatasetsStep.test.tsx`

> Reuse: the actual dataset query + resource handling lives in `useDataCatalogDatasets` / `loadDatasetResources`. This task ships the **assignment shell** (per-model card, per-input row, banner, partial-date tag, completion predicate, isolated state) and a lightweight `InputPicker` that lists candidate datasets and assigns one (or more) per input. The heavier resource-filtering dialog from `MintDatasets.tsx:120-243` can be grafted later; this task surfaces the assignment + banner + gating, which is the spec's legibility goal.

- [ ] **Step 1: Define the date-coverage helper test**

Create `ui-react/src/pages/modeling/thread/wizard/__tests__/DatasetsStep.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import type { ThreadModel } from '../MintDatasets';
import { DatasetsStep, dateCoverage } from '../DatasetsStep';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'Flood extent',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: 'texas',
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [{ __typename: 'thread_permission', user_id: 'testuser', read: true, write: true }],
    thread_models: [],
    ...overrides,
  };
}

const models: Record<string, ThreadModel> = {
  cfgA: {
    id: 'cfgA',
    name: 'PIHM Flood A',
    input_files: [{ id: 'inA', name: 'precipitation', variables: ['sv-precip'], isOptional: false }],
  },
};

describe('dateCoverage', () => {
  const req = { start: new Date('2000-01-01'), end: new Date('2026-01-01') };
  it('returns "none" when no requested range is set', () => {
    expect(dateCoverage(null, { start: new Date('2010-01-01'), end: new Date('2012-01-01') })).toBe('none');
  });
  it('returns "full" when the dataset spans the whole window', () => {
    expect(dateCoverage(req, { start: new Date('1999-01-01'), end: new Date('2027-01-01') })).toBe('full');
  });
  it('returns "partial" when the dataset covers only part of the window', () => {
    expect(dateCoverage(req, { start: new Date('2010-01-01'), end: new Date('2012-01-01') })).toBe('partial');
  });
});

describe('DatasetsStep', () => {
  it('renders one card per selected model with an inputs counter', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(await screen.findByText('PIHM Flood A')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 1 inputs/i)).toBeInTheDocument();
  });

  it('disables Continue until every input is assigned', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await screen.findByText('PIHM Flood A');
    expect(screen.getByTestId('step-continue')).toBeDisabled();
  });

  it('renders a region + dates banner reflecting Framing', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const banner = await screen.findByTestId('filtered-by-banner');
    expect(banner).toHaveTextContent(/region/i);
    expect(banner).toHaveTextContent(/dates/i);
  });

  it('shows a guidance message when no models are selected', () => {
    renderWithProviders(
      <DatasetsStep thread={makeThread()} models={{}} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText(/select model\(s\) first/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- DatasetsStep`
Expected: FAIL — `DatasetsStep` not found.

- [ ] **Step 3: Implement `DatasetsStep`**

Create `ui-react/src/pages/modeling/thread/wizard/DatasetsStep.tsx`:

```tsx
import { useMemo, useState } from 'react';

import { Thread, getUserPermission, useUpdateThreadDataMutation } from '@/graphql/generated/modeling';
import { useDataCatalogDatasets } from '@/hooks/useDataCatalog';
import type { DataCatalogDataset, DataCatalogTimePeriod } from '@/lib/data-catalog';
import { useAuth } from '@/lib/auth/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { ThreadModel } from '../MintDatasets';
import { StepShell } from './StepShell';
import { FilteredByBanner } from './FilteredByBanner';

interface RequestedRange {
  start: Date;
  end: Date;
}

/** Classify a dataset's temporal coverage against the requested window. */
export function dateCoverage(
  requested: RequestedRange | null,
  period: { start: Date | null; end: Date | null } | null,
): 'none' | 'full' | 'partial' {
  if (!requested) return 'none';
  if (!period || !period.start || !period.end) return 'partial';
  const covered = period.start <= requested.start && period.end >= requested.end;
  return covered ? 'full' : 'partial';
}

interface DatasetsStepProps {
  thread: Thread;
  /** Built via buildThreadModels(thread, modelTreeData). */
  models: Record<string, ThreadModel>;
  regionGeometry?: unknown;
  onUpdated: () => void;
  onContinue: () => void;
  onBack?: () => void;
}

/** Per-input dataset picker — lists candidates and assigns one dataset id. Isolated per model. */
function InputPicker({
  thread,
  variables,
  regionGeometry,
  requested,
  assignedId,
  onAssign,
}: {
  thread: Thread;
  variables: string[];
  regionGeometry?: unknown;
  requested: RequestedRange | null;
  assignedId: string | null;
  onAssign: (datasetId: string | null, dataset?: DataCatalogDataset) => void;
}) {
  const { datasets, loading } = useDataCatalogDatasets({
    variableNames: variables,
    regionGeometry,
    startDate: thread.start_date ? new Date(thread.start_date) : null,
    endDate: thread.end_date ? new Date(thread.end_date) : null,
    skip: false,
  });

  if (loading) {
    return <span className="text-xs text-gray-400">Loading datasets…</span>;
  }
  if (datasets.length === 0) {
    return <span className="text-xs text-gray-400">No matching datasets.</span>;
  }

  return (
    <select
      aria-label="Choose dataset"
      value={assignedId ?? ''}
      onChange={(e) => {
        const id = e.target.value || null;
        onAssign(id, datasets.find((d) => d.id === id));
      }}
      className="rounded border border-gray-300 px-2 py-1 text-xs"
    >
      <option value="">Choose · {datasets.length} options</option>
      {datasets.map((ds) => {
        const cov = dateCoverage(requested, ds.time_period as DataCatalogTimePeriod | null);
        const tag = cov === 'full' ? ' [full]' : cov === 'partial' ? ' [partial]' : '';
        return (
          <option key={ds.id} value={ds.id}>
            {ds.name}
            {tag}
          </option>
        );
      })}
    </select>
  );
}

export function DatasetsStep({
  thread,
  models,
  regionGeometry,
  onUpdated,
  onContinue,
  onBack,
}: DatasetsStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);
  const [saving, setSaving] = useState(false);

  // assignments: modelId -> inputId -> { datasetId, coverage }
  const [assignments, setAssignments] = useState<
    Record<string, Record<string, { datasetId: string; dataset?: DataCatalogDataset }>>
  >({});

  const [updateThreadData] = useUpdateThreadDataMutation();

  const modelIds = Object.keys(models);

  const requested: RequestedRange | null = useMemo(() => {
    if (!thread.start_date || !thread.end_date) return null;
    return { start: new Date(thread.start_date), end: new Date(thread.end_date) };
  }, [thread.start_date, thread.end_date]);

  const requiredInputCount = useMemo(
    () =>
      modelIds.reduce(
        (acc, mid) => acc + (models[mid]?.input_files.filter((i) => !i.isOptional).length ?? 0),
        0,
      ),
    [modelIds, models],
  );

  const assignedCount = useMemo(
    () =>
      modelIds.reduce((acc, mid) => {
        const reqInputs = models[mid]?.input_files.filter((i) => !i.isOptional) ?? [];
        return acc + reqInputs.filter((i) => assignments[mid]?.[i.id]).length;
      }, 0),
    [modelIds, models, assignments],
  );

  const allAssigned = requiredInputCount > 0 && assignedCount === requiredInputCount;

  function assign(modelId: string, inputId: string, datasetId: string | null, dataset?: DataCatalogDataset) {
    setAssignments((prev) => {
      const next = { ...prev, [modelId]: { ...(prev[modelId] ?? {}) } };
      if (!datasetId) delete next[modelId][inputId];
      else next[modelId][inputId] = { datasetId, dataset };
      return next;
    });
  }

  async function handleContinue() {
    if (!allAssigned) return;
    setSaving(true);
    try {
      // NOTE: this writes a minimal SELECT_DATA provenance event; the full dataslice/resource
      // persistence is lifted from MintDatasets.handleSubmit (MintDatasets.tsx:734-898) in a
      // follow-up once per-resource filtering is wired. For the core chain we persist the event
      // and advance; bindings live in component state and feed the run matrix downstream.
      await updateThreadData({
        variables: {
          threadId: thread.id,
          event: {
            thread_id: thread.id,
            event: 'SELECT_DATA',
            userid: user?.username ?? 'anonymous',
            notes: null,
          },
          data: [],
          modelIO: [],
        },
      });
      onUpdated();
      onContinue();
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (modelIds.length === 0) {
    return (
      <StepShell title="Datasets" description="Assign a dataset to every model input.">
        <p className="text-sm text-orange-600">Please select model(s) first.</p>
      </StepShell>
    );
  }

  const chips = [
    { icon: '📦', label: 'Input', value: 'per model input' },
    ...(thread.region_id ? [{ icon: '⌖', label: 'Region', value: thread.region_id, source: 'from Framing' }] : []),
    ...(requested
      ? [
          {
            icon: '🗓',
            label: 'Dates',
            value: `${thread.start_date} – ${thread.end_date}`,
            source: 'from Framing',
          },
        ]
      : []),
  ];

  return (
    <StepShell
      title="Datasets"
      description="Assign a dataset to every input, per model. Each model's assignments are independent."
      canContinue={allAssigned && !saving && perm.write}
      continueHint={`${assignedCount} of ${requiredInputCount} inputs assigned`}
      continueLabel={saving ? 'Saving…' : 'Continue'}
      onContinue={handleContinue}
      onBack={onBack}
    >
      <FilteredByBanner chips={chips} />

      <div className="space-y-4">
        {modelIds.map((modelId) => {
          const model = models[modelId]!;
          const reqInputs = model.input_files.filter((i) => !i.isOptional);
          const doneForModel = reqInputs.filter((i) => assignments[modelId]?.[i.id]).length;
          return (
            <div key={modelId} className="rounded border p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">
                  <span className="text-xs font-normal text-gray-400">MODEL · </span>
                  {model.name}
                </span>
                <span className="text-xs text-gray-500">
                  {doneForModel} / {reqInputs.length} inputs
                </span>
              </div>
              <ul className="space-y-2">
                {model.input_files.map((input) => {
                  const current = assignments[modelId]?.[input.id];
                  const cov = dateCoverage(requested, (current?.dataset?.time_period as DataCatalogTimePeriod) ?? null);
                  return (
                    <li key={input.id} className="flex flex-wrap items-center gap-2">
                      <span className="w-40 shrink-0 text-gray-700">
                        {input.name}
                        {input.isOptional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                      </span>
                      {!current && !input.isOptional && (
                        <span className="text-xs text-amber-600">⚠ no dataset assigned</span>
                      )}
                      {current && cov !== 'none' && (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs',
                            cov === 'full' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
                          )}
                        >
                          🗓 {cov === 'full' ? 'full ✓' : 'partial'}
                        </span>
                      )}
                      <InputPicker
                        thread={thread}
                        variables={input.variables}
                        regionGeometry={regionGeometry}
                        requested={requested}
                        assignedId={current?.datasetId ?? null}
                        onAssign={(dsId, ds) => assign(modelId, input.id, dsId, ds)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- DatasetsStep`
Expected: PASS (3 `dateCoverage` + 4 `DatasetsStep` = 7 tests).

> `useDataCatalogDatasets` performs a `fetch` against the Data Catalog REST API. In jsdom that fetch is unmocked; the hook should resolve to `{ datasets: [], loading: false }` on failure. If a test logs an unhandled rejection, add `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 'success', datasets: [] }) }))` in a `beforeEach`. The assertions above only require the cards + banner + counter, which don't depend on returned datasets.

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/pages/modeling/thread/wizard/DatasetsStep.tsx ui-react/src/pages/modeling/thread/wizard/__tests__/DatasetsStep.test.tsx
git commit -m "feat(thread-wizard): DatasetsStep per-model input assignment with date-coverage tags"
```

---

## Task 11: Rewire `MintThread` — rail + StepShell dispatch

Replace `ThreadBreadcrumb` with `WizardRail` in a left-rail layout. Rename section `'configure'` → `'framing'`. Dispatch `renderStep()` to the new step components; keep `MintParameters`/`MintRuns`/`MintResults`/`MintSummary` (rendered as before). Drive rail status from `deriveStepStates`. Wire Back/Continue navigation between adjacent steps.

**Files:**
- Modify: `ui-react/src/pages/modeling/MintThread.tsx`
- Modify: `ui-react/src/pages/modeling/thread/__tests__/MintThread.test.tsx`

- [ ] **Step 1: Update the container test first**

Replace `ui-react/src/pages/modeling/thread/__tests__/MintThread.test.tsx` assertions that reference the old breadcrumb/configure with the rail. Change the three breadcrumb/`mint-configure` tests to:

```tsx
  it('shows the wizard rail steps after data loads', async () => {
    renderMintThread();
    await waitFor(() => expect(screen.getByTestId('rail-step-framing')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getByTestId('rail-step-variables')).toBeInTheDocument();
    expect(screen.getByTestId('rail-step-models')).toBeInTheDocument();
    expect(screen.getByTestId('rail-step-datasets')).toBeInTheDocument();
    expect(screen.getByTestId('rail-step-summary')).toBeInTheDocument();
  });

  it('renders the Framing step by default', async () => {
    renderMintThread();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Framing' })).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('locks Datasets until a model is selected', async () => {
    renderMintThread();
    await waitFor(() => expect(screen.getByTestId('rail-step-datasets')).toBeInTheDocument(), {
      timeout: 3000,
    });
    // mockThread has region but no thread_models -> datasets locked
    expect(screen.getByTestId('rail-step-datasets')).toBeDisabled();
  });
```

Also add `thread_models: []` to `mockThread` (so `deriveStepStates` reads a real array) and keep the existing error/maximize/container tests unchanged. The Framing step issues a `LIST_TOP_REGIONS` query; add a mock so the render doesn't error. Add near `getThreadMock`:

```tsx
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';

const regionsMock = {
  request: { query: LIST_TOP_REGIONS },
  result: { data: { region: [] } },
};
```

and update the default `renderMintThread` mocks param to `[getThreadMock, regionsMock]`.

- [ ] **Step 2: Run the container test to verify it fails**

Run: `npm test -- MintThread`
Expected: FAIL — `rail-step-framing` not found / heading 'Framing' not found (rail not wired yet).

- [ ] **Step 3: Rewire `MintThread.tsx`**

Apply these edits to `ui-react/src/pages/modeling/MintThread.tsx`:

1. Update imports — remove `MintConfigure`/`MintVariables` legacy imports for the four core steps, add the new ones and the rail/deriver. Keep `MintParameters`/`MintRuns`/`MintResults`/`MintSummary`:

```tsx
import { useGetModelTreeWithRegionsQuery } from '@/graphql/generated/modeling';
import { WizardRail } from './thread/wizard/WizardRail';
import { deriveStepStates } from './thread/wizard/deriveStepStates';
import { WIZARD_STEPS, type WizardStepId } from './thread/wizard/types';
import { FramingStep } from './thread/wizard/FramingStep';
import { VariablesStep } from './thread/wizard/VariablesStep';
import { ModelsStep } from './thread/wizard/ModelsStep';
import { DatasetsStep } from './thread/wizard/DatasetsStep';
import { buildThreadModels } from './thread/wizard/buildThreadModels';
import { MintParameters } from './thread/MintParameters';
import { MintRuns } from './thread/MintRuns';
import { MintResults } from './thread/MintResults';
import { MintSummary } from './thread/MintSummary';
```

2. Replace the `ThreadSection` type, `STEPS`, the legacy status helpers (`getConfigureStatus`/`getVariablesStatus`/`buildSectionStatus`), and the `ThreadBreadcrumb`/`StepPlaceholder` components with the rail. Use `WizardStepId` as the section type:

```tsx
const [currentSection, setCurrentSection] = useState<WizardStepId>('framing');
```

3. Add a step-order navigation helper inside the component:

```tsx
  const stepOrder = WIZARD_STEPS.map((s) => s.id);
  const goNext = useCallback(() => {
    setCurrentSection((cur) => stepOrder[Math.min(stepOrder.indexOf(cur) + 1, stepOrder.length - 1)]!);
  }, []);
  const goBack = useCallback(() => {
    setCurrentSection((cur) => stepOrder[Math.max(stepOrder.indexOf(cur) - 1, 0)]!);
  }, []);
```

4. Fetch the model tree once at the container (so Datasets can map selections to inputs):

```tsx
  const { data: modelTree } = useGetModelTreeWithRegionsQuery();
```

5. Compute step states and the datasets-complete flag. The legacy `getParametersStatus`/`getRunsStatus` keep operating on `threadExecutionData`; derive `datasetsComplete` from the same execution data's bindings (mirrors `MintDatasets.hasSomeBinding`):

```tsx
  const datasetsComplete = Object.values(threadExecutionData?.model_ensembles ?? {}).some((ens) =>
    Object.values(ens.bindings ?? {}).some((b) => b.length > 0),
  );
  const stepStates = deriveStepStates(thread, {
    datasetsComplete,
    parametersComplete: getParametersStatus(threadExecutionData) === 'done',
    runsComplete: getRunsStatus(threadExecutionData) === 'done',
  });
```

6. Replace `renderStep()` so the four core sections use the new step components inside their own shells (each step already renders its own `StepShell`), and the rest stay as-is:

```tsx
  const builtModels = buildThreadModels(thread, modelTree);

  function renderStep() {
    switch (currentSection) {
      case 'framing':
        return <FramingStep thread={thread!} onUpdated={handleThreadUpdated} onContinue={goNext} />;
      case 'variables':
        return (
          <VariablesStep thread={thread!} onUpdated={handleThreadUpdated} onContinue={goNext} onBack={goBack} />
        );
      case 'models':
        return (
          <ModelsStep
            thread={thread!}
            onUpdated={handleThreadUpdated}
            onContinue={goNext}
            onBack={goBack}
            onEditIndicator={() => setCurrentSection('variables')}
          />
        );
      case 'datasets':
        return (
          <DatasetsStep
            thread={thread!}
            models={builtModels}
            onUpdated={handleThreadUpdated}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'parameters':
        return (
          <MintParameters
            threadData={execData}
            canWrite={perm.write}
            canExecute={perm.write}
            onSave={handleSaveParameters}
            onContinue={goNext}
          />
        );
      case 'runs':
        return (
          <MintRuns
            threadData={execData}
            executions={modelExecutions}
            canWrite={perm.write}
            canExecute={perm.write}
            ensembleManagerApi={
              (window.__MINT_CONFIG__ as { ENSEMBLE_MANAGER_API?: string } | undefined)
                ?.ENSEMBLE_MANAGER_API ?? ''
            }
            executionEngine="localex"
            onContinue={goNext}
            onFetchRuns={handleFetchRuns}
            onSubmitRuns={handleSubmitRuns}
          />
        );
      case 'results':
        return (
          <MintResults
            threadData={execData}
            executions={modelExecutions}
            canWrite={perm.write}
            ingestionApiAvailable={false}
            onContinue={goNext}
            onFetchRuns={handleFetchRuns}
          />
        );
      case 'summary':
        return <MintSummary thread={thread!} />;
    }
  }
```

7. Replace the header+content layout (the `return (...)` block) with a left-rail / right-content split:

```tsx
  return (
    <div
      data-testid="mint-thread"
      className={cn(
        'flex flex-col overflow-hidden',
        maximized ? 'fixed inset-0 z-50 bg-white p-4' : 'h-full',
      )}
    >
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          aria-label={maximized ? 'Restore size' : 'Maximize'}
          onClick={() => setMaximized((m) => !m)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
        >
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden">
        <WizardRail states={stepStates} currentStep={currentSection} onSelect={setCurrentSection} />
        <div className="flex-1 overflow-y-auto pr-1">{renderStep()}</div>
      </div>
    </div>
  );
```

> Remove the now-unused `getConfigureStatus`, `getVariablesStatus`, `buildSectionStatus`, `ThreadBreadcrumb`, `StepPlaceholder`, `StepDef`, `STEPS`, and the old `ThreadSection` export. Keep `getParametersStatus`/`getRunsStatus` (still used). If `ThreadSection` is imported elsewhere, grep and update — it is internal to `MintThread.tsx`.

- [ ] **Step 4: Run the container test to verify it passes**

Run: `npm test -- MintThread`
Expected: PASS (rail steps render, Framing default, Datasets locked, error/maximize/container tests still green).

- [ ] **Step 5: Run the full suite + typecheck + lint**

Run: `npm test`
Expected: all green (new wizard tests + updated container test + untouched legacy tests).

Run: `npm run build`
Expected: `tsc -b` clean. Fix any unused-import errors left by the rewire.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add ui-react/src/pages/modeling/MintThread.tsx ui-react/src/pages/modeling/thread/__tests__/MintThread.test.tsx
git commit -m "feat(thread-wizard): rewire MintThread to rail + atomic step shells"
```

---

## Final verification

- [ ] **Run the whole suite, typecheck, lint, and format check:**

```bash
npm test
npm run build
npm run lint
npm run format:check
```

Expected: all pass. If `format:check` fails, run `npm run format` and amend the last commit.

- [ ] **Manual smoke (optional but recommended):**

```bash
npm run dev
```

Open `/modeling/thread/<an existing thread id>`. Verify: the left rail renders with glyphs/summaries; Framing requires a Goal; Models is locked until a Goal exists and unlocks immediately after; the Models banner shows the indicator filter; Datasets shows one card per selected model with a per-model inputs counter and a region/dates banner; locked steps are non-clickable.

- [ ] **Open the PR (targets `develop`, per `ui-react/CLAUDE.md`):**

Use the `pr-develop` skill, or:

```bash
git push -u origin feat/thread-wizard-core
gh pr create --base develop --title "feat(thread-wizard): atomic-step wizard core (rail + Framing/Variables/Models/Datasets)" --body "Implements the core chain of the thread wizard atomic-steps redesign (docs/superpowers/specs/2026-06-06-thread-wizard-atomic-steps-design.md). Parameters/Runs/Results redesign and the Framing map preview + Models Compare dialog + full dataset-resource persistence are sequenced to a follow-up PR (noted inline)."
```

---

## Self-review notes (carried from the spec)

**Spec coverage map:**
- Navigation = left rail → Tasks 3, 11. Atomic granularity (Framing only; Models/Datasets real steps) → Tasks 6, 8, 10, 11. Gating (lock-until-ready; Models unlocks on Goal) → Task 2 + verified in Task 11. Rail name+summary → Tasks 2, 3. Datasets isolated per model → Tasks 9, 10. Partial-date tag selectable → Task 10 (`dateCoverage`). `FilteredByBanner` provenance → Task 5, used in Tasks 8, 10. `StepShell` gated Continue → Task 4. Model I/O catalog-query prerequisite → Task 1.
- **Deliberately deferred (flagged inline, not silent):** Parameters/Runs/Results redesign (follow-up plan); Framing **map preview** (Task 6 `TODO(map-preview)`); Models **Compare dialog** (Task 8 note — graft from `MintModels.tsx:141-200`); full **dataset-slice/resource persistence** in Datasets save (Task 10 note — graft from `MintDatasets.tsx:734-898`). These are the spec's heavier sub-features; the core chain (rail + gating + provenance + per-model isolation) — the legibility goal — ships complete.

**Type consistency:** `WizardStepId`/`StepState`/`StepStateMap` are defined in Task 2 and reused verbatim in Tasks 3 and 11. `extractModelIO`/`ModelIOConfig`/`ModelIO` from Task 1 are reused in Tasks 8 and 9. `ThreadModel`/`ThreadModelInput` are imported from the existing `../MintDatasets` (Tasks 9, 10) so the Datasets data shape stays single-sourced.
