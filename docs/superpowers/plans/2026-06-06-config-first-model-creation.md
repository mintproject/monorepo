# Config-first Model Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rigid 3-step Software→Version→Configuration wizard at `/models/register` with a single-page, config-first "Create a new model" form where software linking and region are optional.

**Architecture:** One React Hook Form + one Zod schema + one submit. The configuration (UI: "Model") is the entry point with its parameters/inputs/outputs front-and-center; an "Optional details" block holds a Model Family picker (link existing Software+Version pair, create a new family inline, or leave blank for a standalone config), region, license, website, keywords. Backend drops the Configuration→SoftwareVersion FK so a standalone config can have a null `software_version_id`.

**Tech Stack:** React 18 + TypeScript (strict), React Hook Form + Zod, shadcn/ui (cmdk + Radix Popover comboboxes), Apollo Client 3 against Hasura, GraphQL Code Generator, Vitest + Testing Library + MSW. All UI work is inside `ui-react/`.

**Terminology (UI label → DB entity):** Model → `Configuration`, Model Family → `Software`, Version → `SoftwareVersion`. DB tables/columns unchanged.

**Environment prerequisites (flag before starting):**
- New GraphQL operations require `npm run codegen` against a running Hasura (`HASURA_ENDPOINT` + `HASURA_ADMIN_SECRET`). Codegen here uses `typescript-operations`, so generated types only cover declared operations.
- The FK-drop migration (Task 9) requires the Hasura CLI and a reachable database.

**Spec:** `docs/superpowers/specs/2026-06-06-config-first-model-creation-design.md`

**Working directory for all commands below:** `ui-react/` (except Task 9, which is `graphql_engine/`).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/schemas/registration.ts` | Single `createModelSchema` + model-family discriminated union; retire step schemas | Modify |
| `src/lib/create-model.ts` | Pure builders: family-create vars, configuration-create vars, submit-plan resolution | Create |
| `src/graphql/queries/model-catalog.graphql` | `GetModelFamilies` query (picker source) | Modify |
| `src/graphql/mutations/model-catalog.graphql` | `CreateConfiguration`, `CreateModelFamily` mutations | Modify |
| `src/components/registration/ModelFamilyPicker.tsx` | Optional Software+Version picker with existing/new/none modes | Create |
| `src/components/registration/OptionalDetailsSection.tsx` | Collapsible "Optional details" block (family, region, license, website, keywords) | Create |
| `src/components/registration/CreateModelForm.tsx` | The single-page form (replaces ModelRegistrationWizard) | Create |
| `src/components/registration/ModelRegistrationWizard.tsx` | Old wizard | Delete |
| `src/components/registration/SoftwareStep.tsx`, `VersionStep.tsx`, `ConfigurationStep.tsx` | Old steps | Delete |
| `src/pages/RegisterPage.tsx` | Render `CreateModelForm`, update page label | Modify |
| `src/components/registration/__tests__/*` | New tests for picker, builders, form | Create/Modify |
| `graphql_engine/migrations/...` | Drop Configuration→SoftwareVersion FK | Create |

> **Scope note (out of this plan, flag at end):** standalone configs (null `software_version_id`) will NOT appear in `GetModelTree` (it queries `modelcatalog_software`). A standalone-config listing and the app-wide relabel are tracked separately. License/website/keywords are kept as form fields but are **not persisted** (matches current `RegisterModel` behavior, which already drops them) — persistence is a flagged follow-up.

---

## Task 1: Unified `createModelSchema`

**Files:**
- Modify: `src/schemas/registration.ts`
- Test: `src/schemas/__tests__/registration.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/schemas/__tests__/registration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createModelSchema,
  emptyCreateModel,
  SOFTWARE_TYPE_MODEL,
} from '@/schemas/registration';

describe('createModelSchema', () => {
  it('accepts a minimal standalone model (name only)', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'Modflow · Barton Springs',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.modelFamily.mode).toBe('none');
    }
  });

  it('rejects a model with no name', () => {
    const parsed = createModelSchema.safeParse({ ...emptyCreateModel(), label: '' });
    expect(parsed.success).toBe(false);
  });

  it('requires a versionId when linking an existing family', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: { mode: 'existing', softwareId: 's1', softwareLabel: 'Modflow' },
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts an existing family with a version pair', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: {
        mode: 'existing',
        softwareId: 's1',
        softwareLabel: 'Modflow',
        versionId: 'v2013',
        versionLabel: '2013',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('requires a family name when creating a new family', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: { mode: 'new', familyName: '' },
    });
    expect(parsed.success).toBe(false);
  });

  it('keeps SOFTWARE_TYPE_MODEL exported', () => {
    expect(SOFTWARE_TYPE_MODEL).toBe('https://w3id.org/okn/o/sdm#Model');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/schemas/__tests__/registration.test.ts`
Expected: FAIL — `createModelSchema` / `emptyCreateModel` not exported.

- [ ] **Step 3: Implement the schema**

Replace the contents of `src/schemas/registration.ts` with:

```ts
/**
 * Zod validation schema for the config-first "Create a new model" form.
 *
 * UI terminology: Model = Configuration, Model Family = Software, Version = SoftwareVersion.
 * The configuration row editors (inputs/outputs/parameters) reuse schemas from ./configuration.ts.
 */
import { z } from 'zod';
import {
  inputRowSchema,
  parameterRowSchema,
  regionSelectionSchema,
} from '@/schemas/configuration';

// ─── Software type constants ──────────────────────────────────────────────────

export const SOFTWARE_TYPE_MODEL = 'https://w3id.org/okn/o/sdm#Model';
export const SOFTWARE_TYPE_EMULATOR = 'https://w3id.org/okn/o/sdm#Emulator';

// ─── Optional Model Family link ───────────────────────────────────────────────
// `none`     → standalone configuration (software_version_id = null)
// `existing` → link to a chosen Software+Version pair (versionId required — the
//              picker always lists pairs, and Configuration links via software_version_id)
// `new`      → create a Software + one SoftwareVersion, then link

export const modelFamilyLinkSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({
    mode: z.literal('existing'),
    softwareId: z.string().min(1),
    softwareLabel: z.string(),
    versionId: z.string().min(1, 'Choose a version'),
    versionLabel: z.string().optional(),
  }),
  z.object({
    mode: z.literal('new'),
    familyName: z.string().min(1, 'Family name is required'),
    versionName: z.string().optional(),
  }),
]);

export type ModelFamilyLink = z.infer<typeof modelFamilyLinkSchema>;

// ─── Root form schema ─────────────────────────────────────────────────────────

export const createModelSchema = z.object({
  label: z.string().min(1, 'Model name is required'),
  description: z.string().optional(),
  inputs: z.array(inputRowSchema),
  outputs: z.array(inputRowSchema),
  parameters: z.array(parameterRowSchema),
  regions: z.array(regionSelectionSchema),
  license: z.string().optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  keywords: z.string().optional(),
  modelFamily: modelFamilyLinkSchema,
});

export type CreateModelSchema = z.infer<typeof createModelSchema>;

export function emptyCreateModel(): CreateModelSchema {
  return {
    label: '',
    description: '',
    inputs: [],
    outputs: [],
    parameters: [],
    regions: [],
    license: '',
    website: '',
    keywords: '',
    modelFamily: { mode: 'none' },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/schemas/__tests__/registration.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/schemas/registration.ts src/schemas/__tests__/registration.test.ts
git commit -m "feat(registration): unified createModelSchema for config-first form"
```

---

## Task 2: Pure submit builders (`create-model.ts`)

**Files:**
- Create: `src/lib/create-model.ts`
- Test: `src/lib/__tests__/create-model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/create-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCreateModelFamilyVariables,
  resolveSubmitPlan,
} from '@/lib/create-model';
import { SOFTWARE_TYPE_MODEL } from '@/schemas/registration';
import { emptyCreateModel } from '@/schemas/registration';

describe('buildCreateModelFamilyVariables', () => {
  it('generates ids and defaults the version label to the family name', () => {
    const vars = buildCreateModelFamilyVariables('PIHM', '');
    expect(vars.softwareLabel).toBe('PIHM');
    expect(vars.softwareType).toBe(SOFTWARE_TYPE_MODEL);
    expect(vars.versionLabel).toBe('PIHM'); // falls back to family name when blank
    expect(vars.softwareId).toMatch(/^https?:\/\//);
    expect(vars.versionId).toMatch(/^https?:\/\//);
    expect(vars.versionId).not.toBe(vars.softwareId);
  });

  it('uses the supplied version label when present', () => {
    const vars = buildCreateModelFamilyVariables('PIHM', '2024.1');
    expect(vars.versionLabel).toBe('2024.1');
  });
});

describe('resolveSubmitPlan', () => {
  it('standalone: no family create, null software_version_id', () => {
    const plan = resolveSubmitPlan({ ...emptyCreateModel(), label: 'M' });
    expect(plan.createFamily).toBeNull();
    expect(plan.softwareVersionId).toBeNull();
  });

  it('existing: links to the chosen version, no family create', () => {
    const plan = resolveSubmitPlan({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: {
        mode: 'existing',
        softwareId: 's1',
        softwareLabel: 'Modflow',
        versionId: 'v2013',
        versionLabel: '2013',
      },
    });
    expect(plan.createFamily).toBeNull();
    expect(plan.softwareVersionId).toBe('v2013');
  });

  it('new: schedules a family create and links to its new version', () => {
    const plan = resolveSubmitPlan({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: { mode: 'new', familyName: 'PIHM', versionName: '2024.1' },
    });
    expect(plan.createFamily).not.toBeNull();
    expect(plan.softwareVersionId).toBe(plan.createFamily!.versionId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/create-model.test.ts`
Expected: FAIL — module `@/lib/create-model` not found.

- [ ] **Step 3: Implement the builders**

Create `src/lib/create-model.ts`:

```ts
/**
 * Pure helpers that turn config-first form data into the create steps:
 *   1. optionally create a Model Family (Software + first Version)
 *   2. create the Configuration with a possibly-null software_version_id
 *
 * Network orchestration lives in CreateModelForm; these are pure + unit-tested.
 */
import { generateMintUri } from './uri';
import { SOFTWARE_TYPE_MODEL, type CreateModelSchema } from '@/schemas/registration';

export interface CreateModelFamilyVariables {
  softwareId: string;
  softwareLabel: string;
  softwareType: string;
  versionId: string;
  versionLabel: string;
}

/**
 * Build variables to create a new Software + one SoftwareVersion.
 * A version row is always created so the Configuration has something to link to;
 * its label falls back to the family name when the user left the version blank.
 */
export function buildCreateModelFamilyVariables(
  familyName: string,
  versionName: string | undefined,
): CreateModelFamilyVariables {
  return {
    softwareId: generateMintUri(),
    softwareLabel: familyName,
    softwareType: SOFTWARE_TYPE_MODEL,
    versionId: generateMintUri(),
    versionLabel: versionName?.trim() ? versionName.trim() : familyName,
  };
}

export interface SubmitPlan {
  /** Present only when a new Model Family must be created first. */
  createFamily: CreateModelFamilyVariables | null;
  /** The configuration's parent version id, or null for a standalone config. */
  softwareVersionId: string | null;
}

/**
 * Decide what the submit flow must do based on the chosen Model Family link.
 */
export function resolveSubmitPlan(data: CreateModelSchema): SubmitPlan {
  const family = data.modelFamily;

  if (family.mode === 'existing') {
    return { createFamily: null, softwareVersionId: family.versionId };
  }

  if (family.mode === 'new') {
    const createFamily = buildCreateModelFamilyVariables(
      family.familyName,
      family.versionName,
    );
    return { createFamily, softwareVersionId: createFamily.versionId };
  }

  // mode === 'none' → standalone
  return { createFamily: null, softwareVersionId: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/create-model.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/create-model.ts src/lib/__tests__/create-model.test.ts
git commit -m "feat(registration): pure submit-plan builders for config-first create"
```

---

## Task 3: GraphQL operations + codegen

**Files:**
- Modify: `src/graphql/queries/model-catalog.graphql`
- Modify: `src/graphql/mutations/model-catalog.graphql`
- Regenerate: `src/graphql/generated/graphql.ts`

> Requires a running Hasura (`HASURA_ENDPOINT`, `HASURA_ADMIN_SECRET`). If unavailable, complete the `.graphql` edits, then run codegen when access is restored — later tasks import the generated hooks.

- [ ] **Step 1: Add the `GetModelFamilies` query**

Append to `src/graphql/queries/model-catalog.graphql`:

```graphql
query GetModelFamilies {
  modelcatalog_software(
    order_by: { label: asc }
    where: { type: { _eq: "https://w3id.org/okn/o/sdm#Model" } }
  ) {
    id
    label
    versions(order_by: { label: asc }) {
      id
      label
      version_id
    }
  }
}
```

- [ ] **Step 2: Add the create mutations**

Append to `src/graphql/mutations/model-catalog.graphql`:

```graphql
mutation CreateModelFamily(
  $softwareId: String!
  $softwareLabel: String!
  $softwareType: String!
  $versionId: String!
  $versionLabel: String!
) {
  insert_modelcatalog_software_one(
    object: {
      id: $softwareId
      label: $softwareLabel
      type: $softwareType
      versions: { data: [{ id: $versionId, label: $versionLabel }] }
    }
  ) {
    id
    label
    versions {
      id
      label
    }
  }
}

mutation CreateConfiguration(
  $id: String!
  $label: String!
  $description: String
  $softwareVersionId: String
) {
  insert_modelcatalog_configuration_one(
    object: {
      id: $id
      label: $label
      description: $description
      software_version_id: $softwareVersionId
    }
  ) {
    id
    label
    software_version_id
  }
}
```

- [ ] **Step 3: Regenerate types**

Run: `npm run codegen`
Expected: `src/graphql/generated/graphql.ts` updated; new exports `useGetModelFamiliesQuery`, `GetModelFamiliesDocument`, `useCreateModelFamilyMutation`, `useCreateConfigurationMutation`, `CreateConfigurationMutationVariables`, etc.

- [ ] **Step 4: Verify build/typecheck picks up the new hooks**

Run: `npx tsc -b --noEmit`
Expected: PASS (no references to the new hooks yet, so this just confirms the generated file is valid).

- [ ] **Step 5: Commit**

```bash
git add src/graphql/queries/model-catalog.graphql src/graphql/mutations/model-catalog.graphql src/graphql/generated/graphql.ts
git commit -m "feat(registration): GetModelFamilies query + CreateModelFamily/CreateConfiguration mutations"
```

---

## Task 4: `ModelFamilyPicker` component

**Files:**
- Create: `src/components/registration/ModelFamilyPicker.tsx`
- Test: `src/components/registration/__tests__/ModelFamilyPicker.test.tsx`

The picker is a controlled component over a `ModelFamilyLink` value. It has three visual states: a combobox listing `Software — Version` pairs (existing), an inline name+version form (new), and a default "not linked" state. It exposes a small toggle to switch between picking existing and creating new.

- [ ] **Step 1: Write the failing test**

Create `src/components/registration/__tests__/ModelFamilyPicker.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GetModelFamiliesDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { ModelFamilyPicker } from '@/components/registration/ModelFamilyPicker';
import type { ModelFamilyLink } from '@/schemas/registration';

const familiesMock = {
  request: { query: GetModelFamiliesDocument },
  result: {
    data: {
      modelcatalog_software: [
        {
          id: 's-modflow',
          label: 'Modflow',
          versions: [
            { id: 'v-2000', label: '2000', version_id: '2000' },
            { id: 'v-2013', label: '2013', version_id: '2013' },
          ],
        },
      ],
    },
  },
};

function setup(value: ModelFamilyLink = { mode: 'none' }) {
  const onChange = vi.fn();
  renderWithProviders(<ModelFamilyPicker value={value} onChange={onChange} />, {
    apolloMocks: [familiesMock],
  });
  return { onChange };
}

describe('ModelFamilyPicker', () => {
  it('starts unlinked and shows the link control', () => {
    setup();
    expect(screen.getByRole('button', { name: /link a model family/i })).toBeInTheDocument();
  });

  it('lists Software — Version pairs and emits an existing selection', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole('button', { name: /link a model family/i }));
    await user.click(screen.getByRole('combobox', { name: /model family/i }));

    await waitFor(() => expect(screen.getByText('Modflow — 2013')).toBeInTheDocument());
    await user.click(screen.getByText('Modflow — 2013'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'existing',
        softwareId: 's-modflow',
        versionId: 'v-2013',
        versionLabel: '2013',
      }),
    );
  });

  it('switches to create-new mode and emits a new family link', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole('button', { name: /link a model family/i }));
    await user.click(screen.getByRole('button', { name: /create a new family/i }));

    await user.type(screen.getByLabelText(/family name/i), 'PIHM');
    await user.type(screen.getByLabelText(/^version$/i), '2024.1');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'new', familyName: 'PIHM', versionName: '2024.1' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/registration/__tests__/ModelFamilyPicker.test.tsx`
Expected: FAIL — `ModelFamilyPicker` not found.

- [ ] **Step 3: Implement the picker**

Create `src/components/registration/ModelFamilyPicker.tsx`:

```tsx
/**
 * ModelFamilyPicker — optional, controlled selector for a Model Family.
 *
 * Modes:
 *   none     → not linked (standalone configuration)
 *   existing → a chosen Software + Version pair (listed "Modflow — 2013")
 *   new      → an inline name + version form (creates Software + first Version on submit)
 *
 * Data: GetModelFamilies (Software with versions). Reuses the cmdk + Popover combobox pattern.
 */
import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import { useGetModelFamiliesQuery } from '@/graphql/generated/graphql';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ModelFamilyLink } from '@/schemas/registration';

interface PairOption {
  softwareId: string;
  softwareLabel: string;
  versionId: string;
  versionLabel: string;
  display: string;
}

export interface ModelFamilyPickerProps {
  value: ModelFamilyLink;
  onChange: (value: ModelFamilyLink) => void;
}

export function ModelFamilyPicker({ value, onChange }: ModelFamilyPickerProps) {
  const [open, setOpen] = React.useState(false);
  const { data, loading } = useGetModelFamiliesQuery({ fetchPolicy: 'cache-first' });

  const pairs: PairOption[] = React.useMemo(() => {
    const software = data?.modelcatalog_software ?? [];
    return software.flatMap((s) =>
      (s.versions ?? []).map((v) => ({
        softwareId: s.id,
        softwareLabel: s.label ?? '',
        versionId: v.id,
        versionLabel: v.label ?? '',
        display: `${s.label ?? ''} — ${v.label ?? ''}`,
      })),
    );
  }, [data]);

  // ── none: show the entry control ──────────────────────────────────────────
  if (value.mode === 'none') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Link a model family
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ mode: 'new', familyName: '', versionName: '' })}
        >
          Create a new family
        </Button>
        {/* The existing-mode popover is anchored here so "Link a model family" opens it */}
        <ExistingPopover
          open={open}
          setOpen={setOpen}
          loading={loading}
          pairs={pairs}
          selectedVersionId={undefined}
          onPick={(p) =>
            onChange({
              mode: 'existing',
              softwareId: p.softwareId,
              softwareLabel: p.softwareLabel,
              versionId: p.versionId,
              versionLabel: p.versionLabel,
            })
          }
        />
      </div>
    );
  }

  // ── existing: show selection + change/clear ───────────────────────────────
  if (value.mode === 'existing') {
    return (
      <div className="flex items-center gap-2">
        <ExistingPopover
          open={open}
          setOpen={setOpen}
          loading={loading}
          pairs={pairs}
          selectedVersionId={value.versionId}
          triggerLabel={`${value.softwareLabel} — ${value.versionLabel ?? ''}`}
          onPick={(p) =>
            onChange({
              mode: 'existing',
              softwareId: p.softwareId,
              softwareLabel: p.softwareLabel,
              versionId: p.versionId,
              versionLabel: p.versionLabel,
            })
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear model family"
          onClick={() => onChange({ mode: 'none' })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── new: inline name + version ────────────────────────────────────────────
  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="family-name">Family name</Label>
          <Input
            id="family-name"
            placeholder="e.g. PIHM"
            value={value.familyName}
            onChange={(e) => onChange({ ...value, familyName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="family-version">Version</Label>
          <Input
            id="family-version"
            placeholder="e.g. 2024.1"
            value={value.versionName ?? ''}
            onChange={(e) => onChange({ ...value, versionName: e.target.value })}
          />
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange({ mode: 'none' })}
      >
        Back to picking an existing family
      </Button>
    </div>
  );
}

interface ExistingPopoverProps {
  open: boolean;
  setOpen: (o: boolean) => void;
  loading: boolean;
  pairs: PairOption[];
  selectedVersionId: string | undefined;
  triggerLabel?: string;
  onPick: (p: PairOption) => void;
}

function ExistingPopover({
  open,
  setOpen,
  loading,
  pairs,
  selectedVersionId,
  triggerLabel,
  onPick,
}: ExistingPopoverProps) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerLabel ? (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Model family"
            aria-expanded={open}
            className="justify-between font-normal"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        ) : (
          // Hidden anchor used in `none` mode; the visible trigger is the
          // "Link a model family" button which toggles `open`.
          <button
            type="button"
            aria-label="Model family"
            role="combobox"
            aria-expanded={open}
            className="sr-only"
          />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search families and versions..." />
          <CommandList>
            <CommandEmpty>{loading ? 'Loading...' : 'No model families.'}</CommandEmpty>
            <CommandGroup>
              {pairs.map((p) => (
                <CommandItem
                  key={p.versionId}
                  value={p.display}
                  onSelect={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      selectedVersionId === p.versionId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span>{p.display}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/registration/__tests__/ModelFamilyPicker.test.tsx`
Expected: PASS (3 tests). If the `none`-mode combobox role query is flaky because of the `sr-only` anchor, adjust the test to open via the "Link a model family" button (already clicked) — the popover is wired to the same `open` state.

- [ ] **Step 5: Commit**

```bash
git add src/components/registration/ModelFamilyPicker.tsx src/components/registration/__tests__/ModelFamilyPicker.test.tsx
git commit -m "feat(registration): ModelFamilyPicker (existing/new/none) for optional software link"
```

---

## Task 5: `OptionalDetailsSection` component

**Files:**
- Create: `src/components/registration/OptionalDetailsSection.tsx`
- Test: `src/components/registration/__tests__/OptionalDetailsSection.test.tsx`

This groups all optional fields under one "Optional details" block: the `ModelFamilyPicker` (bound to the `modelFamily` form field), region selection (reuse the existing regions pattern from `ConfigurationStep`/`RegionCombobox` if present, otherwise a simple multi-select list), license, website, keywords. It reads/writes through `useFormContext<CreateModelSchema>()`.

- [ ] **Step 1: Write the failing test**

Create `src/components/registration/__tests__/OptionalDetailsSection.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';

import { GetModelFamiliesDocument, GetRegionsDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { Form } from '@/components/ui/form';
import { OptionalDetailsSection } from '@/components/registration/OptionalDetailsSection';
import { emptyCreateModel, type CreateModelSchema } from '@/schemas/registration';

const familiesMock = {
  request: { query: GetModelFamiliesDocument },
  result: { data: { modelcatalog_software: [] } },
};
const regionsMock = {
  request: { query: GetRegionsDocument },
  result: { data: { modelcatalog_region: [] } },
};

function Harness() {
  const form = useForm<CreateModelSchema>({ defaultValues: emptyCreateModel() });
  return (
    <FormProvider {...form}>
      <Form {...form}>
        <OptionalDetailsSection />
      </Form>
    </FormProvider>
  );
}

describe('OptionalDetailsSection', () => {
  it('renders the optional block heading and metadata fields', () => {
    renderWithProviders(<Harness />, { apolloMocks: [familiesMock, regionsMock] });

    expect(screen.getByText(/optional details/i)).toBeInTheDocument();
    expect(screen.getByText(/model family/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/license/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/registration/__tests__/OptionalDetailsSection.test.tsx`
Expected: FAIL — `OptionalDetailsSection` not found.

- [ ] **Step 3: Inspect the existing region UI before implementing**

Run: `grep -n "regions" src/components/registration/ConfigurationStep.tsx src/components/configuration/*.tsx`
Expected: shows how regions are currently rendered. If a `RegionCombobox`/multi-select exists, reuse it in Step 4. If regions are not yet rendered anywhere, use the minimal `GetRegions`-backed checklist shown in Step 4.

- [ ] **Step 4: Implement the section**

Create `src/components/registration/OptionalDetailsSection.tsx`:

```tsx
/**
 * OptionalDetailsSection — the single "Optional details" block at the bottom of
 * the Create-a-model form: Model Family link, Region(s), License, Website, Keywords.
 * Everything here is optional. Bound to CreateModelSchema via form context.
 */
import { Controller, useFormContext } from 'react-hook-form';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useGetRegionsQuery } from '@/graphql/generated/graphql';
import { ModelFamilyPicker } from './ModelFamilyPicker';
import type { CreateModelSchema } from '@/schemas/registration';

export function OptionalDetailsSection() {
  const { control, watch, setValue } = useFormContext<CreateModelSchema>();
  const { data: regionData } = useGetRegionsQuery({ fetchPolicy: 'cache-first' });
  const regions = regionData?.modelcatalog_region ?? [];
  const selectedRegions = watch('regions');

  const toggleRegion = (id: string, label: string) => {
    const exists = selectedRegions.some((r) => r.id === id);
    setValue(
      'regions',
      exists
        ? selectedRegions.filter((r) => r.id !== id)
        : [...selectedRegions, { id, label }],
      { shouldDirty: true },
    );
  };

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Optional details</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          all optional
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Skip any of these — you can fill them in later from the model page.
      </p>

      {/* Model Family */}
      <div className="space-y-2">
        <Label>Model Family</Label>
        <Controller
          control={control}
          name="modelFamily"
          render={({ field }) => (
            <ModelFamilyPicker value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <Separator className="my-4" />

      {/* Regions */}
      <div className="space-y-2">
        <Label>Region</Label>
        {regions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No regions available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => {
              const active = selectedRegions.some((s) => s.id === r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRegion(r.id, r.label ?? '')}
                  className={[
                    'rounded-full border px-3 py-1 text-xs',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted text-muted-foreground',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* License / Website / Keywords */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="license"
          render={({ field }) => (
            <FormItem>
              <FormLabel>License</FormLabel>
              <FormControl>
                <Input placeholder="e.g. MIT, Apache 2.0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://example.com/model" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="keywords"
        render={({ field }) => (
          <FormItem className="mt-4">
            <FormLabel>Keywords</FormLabel>
            <FormControl>
              <Input placeholder="e.g. groundwater, karst (comma-separated)" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
```

> If Step 3 revealed an existing region combobox component, replace the inline region chips with it and adjust the test's region assertion accordingly. The chip approach above is the minimal, dependency-free fallback.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/registration/__tests__/OptionalDetailsSection.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/components/registration/OptionalDetailsSection.tsx src/components/registration/__tests__/OptionalDetailsSection.test.tsx
git commit -m "feat(registration): OptionalDetailsSection grouping optional model fields"
```

---

## Task 6: `CreateModelForm` (the single-page form)

**Files:**
- Create: `src/components/registration/CreateModelForm.tsx`
- Test: `src/components/registration/__tests__/CreateModelForm.test.tsx`

Single `Card`: name → description → Parameters (`ParameterSection`) → Inputs (`InputOutputSection prefix="inputs"`) → Outputs (`InputOutputSection prefix="outputs"`) → `OptionalDetailsSection` → one "Create model" button. Submit runs: optional `CreateModelFamily`, then `CreateConfiguration`, then the existing `AddConfigurationInput/Output/Parameter` calls, then `AddConfigurationRegion` per region. Navigates to `/models/configure/:id` on success.

- [ ] **Step 1: Write the failing test (standalone happy path)**

Create `src/components/registration/__tests__/CreateModelForm.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  PrefetchReferenceDataDocument,
  GetRegionsDocument,
  GetModelFamiliesDocument,
  CreateConfigurationDocument,
} from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { CreateModelForm } from '@/components/registration/CreateModelForm';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

const refData = {
  request: { query: PrefetchReferenceDataDocument },
  result: { data: { modelcatalog_standard_variable: [], modelcatalog_unit: [] } },
};
const regions = {
  request: { query: GetRegionsDocument },
  result: { data: { modelcatalog_region: [] } },
};
const families = {
  request: { query: GetModelFamiliesDocument },
  result: { data: { modelcatalog_software: [] } },
};

describe('CreateModelForm', () => {
  it('renders a single form with no stepper', () => {
    renderWithProviders(<CreateModelForm />, { apolloMocks: [refData, regions, families] });
    expect(screen.queryByRole('navigation', { name: /registration steps/i })).toBeNull();
    expect(screen.getByRole('heading', { name: /create a new model/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create model/i })).toBeInTheDocument();
  });

  it('blocks submit when the model name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateModelForm />, { apolloMocks: [refData, regions, families] });
    await user.click(screen.getByRole('button', { name: /create model/i }));
    expect(await screen.findByText(/model name is required/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('creates a standalone configuration and navigates on success', async () => {
    const user = userEvent.setup();
    const createConfig = {
      request: {
        query: CreateConfigurationDocument,
        variables: {
          id: expect.any(String),
          label: 'Modflow · Barton Springs',
          description: '',
          softwareVersionId: null,
        },
      },
      // variableMatcher avoids asserting the generated id; see note below.
      result: {
        data: {
          insert_modelcatalog_configuration_one: {
            id: 'cfg-1',
            label: 'Modflow · Barton Springs',
            software_version_id: null,
          },
        },
      },
    };

    renderWithProviders(<CreateModelForm />, {
      apolloMocks: [refData, regions, families, createConfig],
    });

    await user.type(screen.getByLabelText(/model name/i), 'Modflow · Barton Springs');
    await user.click(screen.getByRole('button', { name: /create model/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('/models/configure/')));
  });
});
```

> **Note on the generated id:** `CreateConfiguration` uses a `generateMintUri()` id, so the request variables can't be matched exactly. Use Apollo MockedProvider's `variableMatcher` (a function returning `true`) on the `createConfig` mock instead of literal `variables`, OR assert only on `navigateMock`. Apply whichever the repo's `apollo-mocks.ts` helper supports; if it doesn't expose `variableMatcher`, keep the third test asserting navigation only and drop the `variables` block.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/registration/__tests__/CreateModelForm.test.tsx`
Expected: FAIL — `CreateModelForm` not found.

- [ ] **Step 3: Implement the form**

Create `src/components/registration/CreateModelForm.tsx`:

```tsx
/**
 * CreateModelForm — config-first single-page model creation (replaces the
 * 3-step ModelRegistrationWizard). UI terms: Model = Configuration,
 * Model Family = Software, Version = SoftwareVersion.
 *
 * Submit order:
 *   1. (optional) CreateModelFamily → Software + first SoftwareVersion
 *   2. CreateConfiguration with software_version_id (null when standalone)
 *   3. AddConfigurationInput / Output / Parameter for each row
 *   4. AddConfigurationRegion for each selected region
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreateConfigurationMutation,
  useCreateModelFamilyMutation,
  useAddConfigurationInputMutation,
  useAddConfigurationOutputMutation,
  useAddConfigurationParameterMutation,
  useAddConfigurationRegionMutation,
} from '@/graphql/generated/graphql';
import { InputOutputSection } from '@/components/configuration/InputOutputSection';
import { ParameterSection } from '@/components/configuration/ParameterSection';
import {
  buildAddInputVariables,
  buildAddOutputVariables,
  buildAddParameterVariables,
  assignPositions,
} from '@/lib/mutation-builder';
import { resolveSubmitPlan } from '@/lib/create-model';
import { generateMintUri } from '@/lib/uri';
import {
  createModelSchema,
  emptyCreateModel,
  type CreateModelSchema,
} from '@/schemas/registration';
import { OptionalDetailsSection } from './OptionalDetailsSection';

export function CreateModelForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<CreateModelSchema>({
    resolver: zodResolver(createModelSchema),
    defaultValues: emptyCreateModel(),
  });

  const [createModelFamily] = useCreateModelFamilyMutation();
  const [createConfiguration, { loading: creating }] = useCreateConfigurationMutation();
  const [addInput] = useAddConfigurationInputMutation();
  const [addOutput] = useAddConfigurationOutputMutation();
  const [addParameter] = useAddConfigurationParameterMutation();
  const [addRegion] = useAddConfigurationRegionMutation();

  const onSubmit = async (data: CreateModelSchema) => {
    setSubmitError(null);
    const configurationId = generateMintUri();
    const plan = resolveSubmitPlan(data);

    try {
      // 1. Optional: create a new Model Family (Software + first Version)
      if (plan.createFamily) {
        await createModelFamily({ variables: plan.createFamily });
      }

      // 2. Create the configuration (standalone when softwareVersionId is null)
      await createConfiguration({
        variables: {
          id: configurationId,
          label: data.label,
          description: data.description || null,
          softwareVersionId: plan.softwareVersionId,
        },
      });

      // 3. Inputs / outputs / parameters
      await Promise.all(
        assignPositions(data.inputs).map((row) =>
          addInput({ variables: buildAddInputVariables(configurationId, row) }),
        ),
      );
      await Promise.all(
        assignPositions(data.outputs).map((row) =>
          addOutput({ variables: buildAddOutputVariables(configurationId, row) }),
        ),
      );
      await Promise.all(
        assignPositions(data.parameters).map((row) =>
          addParameter({ variables: buildAddParameterVariables(configurationId, row) }),
        ),
      );

      // 4. Regions (metadata)
      await Promise.all(
        data.regions.map((r) =>
          addRegion({ variables: { configurationId, regionId: r.id } }),
        ),
      );

      toast({ title: 'Model created', description: `${data.label} was created successfully.` });
      navigate(`/models/configure/${encodeURIComponent(configurationId)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Creation failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Create a new model</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define a model configuration — its parameters, inputs and outputs. Linking it to
                  a model family is optional.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Model name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder='e.g. "Modflow · Barton Springs"' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Brief description of this model" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                <ParameterSection />
                <Separator />
                <InputOutputSection prefix="inputs" />
                <Separator />
                <InputOutputSection prefix="outputs" />
                <Separator />
                <OptionalDetailsSection />

                {submitError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {submitError}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create model
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </FormProvider>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/registration/__tests__/CreateModelForm.test.tsx`
Expected: PASS (3 tests). If the standalone-create test can't match the generated id, apply the `variableMatcher` / navigation-only adjustment from the Step 1 note.

- [ ] **Step 5: Commit**

```bash
git add src/components/registration/CreateModelForm.tsx src/components/registration/__tests__/CreateModelForm.test.tsx
git commit -m "feat(registration): CreateModelForm — config-first single-page model creation"
```

---

## Task 7: Wire `RegisterPage` and remove the old wizard

**Files:**
- Modify: `src/pages/RegisterPage.tsx`
- Delete: `ModelRegistrationWizard.tsx`, `SoftwareStep.tsx`, `VersionStep.tsx`, `ConfigurationStep.tsx`
- Delete/replace: `src/components/registration/__tests__/ModelRegistrationWizard.test.tsx`

- [ ] **Step 1: Point RegisterPage at the new form**

Read `src/pages/RegisterPage.tsx`, then replace its body so it renders `CreateModelForm` instead of `ModelRegistrationWizard`. Example shape (adapt to the existing page chrome/heading):

```tsx
import { CreateModelForm } from '@/components/registration/CreateModelForm';

export function RegisterPage() {
  return (
    <div className="py-8">
      <CreateModelForm />
    </div>
  );
}
```

- [ ] **Step 2: Delete the obsolete wizard files**

```bash
git rm src/components/registration/ModelRegistrationWizard.tsx \
       src/components/registration/SoftwareStep.tsx \
       src/components/registration/VersionStep.tsx \
       src/components/registration/ConfigurationStep.tsx \
       src/components/registration/__tests__/ModelRegistrationWizard.test.tsx
```

- [ ] **Step 3: Find and fix any remaining references**

Run: `grep -rn "ModelRegistrationWizard\|SoftwareStep\|VersionStep\|ConfigurationStep\|softwareStepSchema\|versionStepSchema\|emptySoftwareStep\|emptyVersionStep" src/`
Expected: only matches inside files you are about to fix. Update each import to the new components/schema (e.g. any index barrel, `RegisterPage`, leftover tests). There should be zero references after this step.

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc -b --noEmit && npm test`
Expected: PASS. No unresolved imports; all registration tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(registration): replace 3-step wizard with config-first CreateModelForm"
```

---

## Task 8: Lint + format pass

**Files:** all changed files.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS. Fix any issues reported.

- [ ] **Step 2: Format**

Run: `npm run format`
Expected: files formatted; re-run `npm run format:check` → PASS.

- [ ] **Step 3: Commit (if anything changed)**

```bash
git add -A
git commit -m "chore(registration): lint + format config-first form"
```

---

## Task 9: Hasura migration — drop the Configuration→SoftwareVersion FK

**Files:**
- Create: `graphql_engine/migrations/default/<timestamp>_drop_configuration_software_version_fk/{up,down}.sql`

> Requires Hasura CLI + a reachable database. Run from `graphql_engine/`.

- [ ] **Step 1: Identify the FK constraint name**

Run (psql against the dev DB, or Hasura console SQL):

```sql
SELECT conname
FROM pg_constraint
WHERE conrelid = 'modelcatalog_configuration'::regclass
  AND contype = 'f'
  AND confrelid = 'modelcatalog_software_version'::regclass;
```

Expected: one constraint name (e.g. `modelcatalog_configuration_software_version_id_fkey`). Use it below.

- [ ] **Step 2: Create the migration**

Run: `hasura migrate create drop_configuration_software_version_fk --database-name default`

Populate `up.sql`:

```sql
ALTER TABLE modelcatalog_configuration
  DROP CONSTRAINT IF EXISTS modelcatalog_configuration_software_version_id_fkey;
```

Populate `down.sql` (restores the FK; allow nulls so existing standalone rows don't break the rollback):

```sql
ALTER TABLE modelcatalog_configuration
  ADD CONSTRAINT modelcatalog_configuration_software_version_id_fkey
  FOREIGN KEY (software_version_id)
  REFERENCES modelcatalog_software_version (id);
```

> Replace the constraint name in both files with the actual one from Step 1 if it differs.

- [ ] **Step 3: Apply + reload metadata**

```bash
hasura migrate apply --database-name default
hasura metadata reload
```

Expected: migration applies cleanly; `software_version_id` is now nullable-in-practice (no FK). Confirm an `insert_modelcatalog_configuration_one` with `software_version_id: null` succeeds (the `CreateModelForm` standalone path).

- [ ] **Step 4: Commit**

```bash
git add graphql_engine/migrations/default
git commit -m "feat(db): drop Configuration->SoftwareVersion FK to allow standalone configs"
```

---

## Final verification

- [ ] **All tests:** `cd ui-react && npm test` → PASS
- [ ] **Typecheck/build:** `npm run build` → PASS
- [ ] **Lint/format:** `npm run lint && npm run format:check` → PASS
- [ ] **Manual smoke (with dev server + Hasura):** `npm run dev`, visit `/models/register`:
  - Create a model with name + one parameter, no family → lands on `/models/configure/:id`.
  - Create a model linking `Modflow — 2013` → configuration has that `software_version_id`.
  - Create a model with a new family "PIHM / 2024.1" → new Software+Version exist and the config links to the new version.
  - Tag a region → `configuration_region` row exists.

## Flagged follow-ups (not in this plan)

- Standalone configs (null `software_version_id`) won't show in `GetModelTree` (queries `modelcatalog_software`). Needs a standalone-config listing on the browse page.
- App-wide relabel (Software/Configuration → Model Family/Model) across tree/browse pages.
- Persistence for license/website/keywords (currently captured in the form but not stored — matches prior behavior). Decide target columns and wire mutations.
