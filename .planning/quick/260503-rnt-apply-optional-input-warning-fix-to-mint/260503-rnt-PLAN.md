---
phase: 260503-rnt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/src/screens/modeling/thread/mint-datasets.ts
autonomous: true
requirements:
  - optional-input-visual-polish
must_haves:
  truths:
    - "An empty optional input renders a grey info icon and '(optional)' label — no orange warning"
    - "An empty optional input does NOT set ok=false in _selectThreadDatasets and does NOT trigger 'Please select at least one dataset'"
    - "The render path for 'User selected Datasets' distinguishes optional inputs visually from required ones"
    - "Existing debug console.groupCollapsed instrumentation (lines 1113-1185) is preserved verbatim"
  artifacts:
    - path: "ui/src/screens/modeling/thread/mint-datasets.ts"
      provides: "Updated render + gating logic with optional-input awareness"
  key_links:
    - from: "input.isOptional"
      to: "render icon branch (grey info vs orange warning)"
      via: "ternary in input_files.map render template"
    - from: "input.isOptional"
      to: "_selectThreadDatasets ok=false gate"
      via: "already fixed at line 1169 — verify it still holds after edit"
---

<objective>
Apply visual/UX polish to mint-datasets.ts so that optional inputs render distinctly (grey info icon + "(optional)" label) instead of the orange warning shown for required inputs, matching the pattern already implemented in thread-expansion-datasets.ts.

The navigation gate fix (commit 929f48e, line 1162: `blocks = empty && !input.isOptional`) is already in place.
This plan covers the render layer only.

Purpose: Users should not see an alarming orange warning for inputs that are genuinely optional. The UI should communicate "this is optional" rather than "something is wrong."

Output: Modified mint-datasets.ts with optional-aware icon/label rendering in the "User selected Datasets" section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ui/src/screens/modeling/thread/mint-datasets.ts
@ui/src/screens/modeling/thread/thread-expansion-datasets.ts
</context>

<interfaces>
<!-- Key types and patterns the executor needs. No codebase exploration needed. -->

From ui/src/screens/models/reducers.ts (ModelIO shape relevant here):
```typescript
export interface ModelIO {
  id?: string;
  name?: string;
  type?: string;
  variables?: string[];
  value?: { resources: { url: string; name: string }[] };
  isOptional?: boolean;   // mapped from Hasura is_optional in graphql_adapter.ts
}
```

Reference pattern from thread-expansion-datasets.ts renderRequiredDatasetRow (lines 451-473):
```typescript
// Icon branch — three states:
${hasSelection
  ? html`<wl-icon style="color: 'green'; margin-right: 5px;">done</wl-icon>`
  : input.isOptional
  ? html`<wl-icon style="color: #999; margin-right: 5px;" title="Optional input — selection not required">info</wl-icon>`
  : html`<wl-icon style="color: 'orange'; margin-right: 5px;">warning</wl-icon>`}
// Label suffix for optional + no selection:
${input.name}${input.isOptional && !hasSelection
  ? html`<span style="color:#999; margin-left:6px; font-size:0.85em;">(optional)</span>`
  : ""}
```

Existing debug instrumentation in mint-datasets.ts to PRESERVE (lines 1113-1185):
- console.groupCollapsed("[mint-datasets] _selectThreadDatasets gating")
- Per-input console.log with isOptional, datasets, dts, blocks
- Per-model console.log with ok
- console.log("[mint-datasets] allok=...")
- console.groupEnd()
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add optional-aware icon/label to "User selected Datasets" render path</name>
  <files>ui/src/screens/modeling/thread/mint-datasets.ts</files>
  <action>
In the `render()` method (around line 244), the variable `input_files` collects all inputs without a `value`. This list is rendered in the "User selected Datasets" section (around lines 305-600+). Two render branches exist for each input:

BRANCH A — bindings already present and not in edit mode (around line 319-379): renders selected datasets. When the user has previously selected data for an optional input, it shows as normal. No change needed here.

BRANCH B — no bindings yet (the else branch, around line 380+): this is the "selection table" view that currently shows no icon differentiation. This is also the view shown when `_editMode=true`. In this branch the input name appears in a header like:

```html
<li>
  Select an input dataset for <b>${input.name}</b>. (You can select more...
```

Apply these two targeted changes:

CHANGE 1 — The "no bindings + not in edit mode" empty state. When `bindings` is falsy or empty AND `!this._editMode`, there is no explicit empty-state row for individual inputs in this code path — the table is rendered with `queriedInputDatasets`. However when `queriedInputDatasets` is undefined (input not yet queried), or when there are zero results, the input header line is still shown. Add an `(optional)` suffix to the `<b>${input.name}</b>` span when `input.isOptional` is true:

```typescript
// Replace the text:
Select an input dataset for <b>${input.name}</b>.
// With:
Select an input dataset for <b>${input.name}</b>${input.isOptional ? html` <span style="color:#999; font-size:0.85em;">(optional)</span>` : ""}.
```

CHANGE 2 — The "bindings empty + not in edit mode" early-exit branch. When `bindings && bindings.length > 0 && !this._editMode` is FALSE (i.e., no selection yet), and `queriedInputDatasetStatuses` is also falsy (datasets not yet loaded), the code falls through without rendering any row for this input. This means optional inputs in the "not yet loaded" state are silently absent. No visible orange warning in this case, so no icon change is needed there.

CHANGE 3 — The heading row for each input in the "selection table": find the table header row template:
```html
<li>
  Select an input dataset for
  <b>${input.name}</b>. (You can select more
  than one dataset if you want several runs).
```
Extend the label with icon + optional tag following the thread-expansion-datasets.ts pattern. Specifically, prepend a status icon before the `<b>` element in this `<li>`:

```typescript
// Add before "Select an input dataset for":
${input.isOptional
  ? html`<wl-icon style="color: #999; font-size:16px; vertical-align:middle; margin-right:4px;" title="Optional input — selection not required">info</wl-icon>`
  : html`<wl-icon style="color: orange; font-size:16px; vertical-align:middle; margin-right:4px;">warning</wl-icon>`}
```

And add the `(optional)` label suffix on the input name:
```typescript
<b>${input.name}</b>${input.isOptional ? html` <span style="color:#999; font-size:0.85em;">(optional)</span>` : ""}
```

IMPORTANT — DO NOT touch:
- Lines 1113-1185 (the debug console.groupCollapsed block) — preserve verbatim
- Line 1169: `const blocks = empty && !input.isOptional;` — already correct, leave it
- Line 1075-1084: `_loadAndSelectThreadDatasets` filter — already iterates all non-value inputs to load them; leave as-is (harmless to load optional ones)
- Line 1209-1258: `queryDataCatalog` — harmless to query optional inputs for dataset suggestions; leave as-is
- Lines 1286-1310: `stateChanged` forEach — just loads DatasetSpecification metadata; no gating; leave as-is
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint/ui && grep -n "isOptional" src/screens/modeling/thread/mint-datasets.ts</automated>
  </verify>
  <done>
    - `grep -n "isOptional" mint-datasets.ts` shows at least 2 occurrences: one at line ~1169 (existing gate, unchanged) and one or more in the render section (new icon/label logic)
    - The render section for "User selected Datasets" contains `info` icon reference gated on `input.isOptional`
    - The render section contains `(optional)` label text gated on `input.isOptional`
    - The console.groupCollapsed debug block at lines ~1113-1185 is unchanged
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Visual distinction for optional inputs in mint-datasets.ts:
    - Grey info icon replaces orange warning for empty optional inputs in the dataset selection section
    - "(optional)" label suffix appears next to optional input names when no selection is made
    - Required inputs still show orange warning icon
    - Debug console instrumentation preserved in _selectThreadDatasets
  </what-built>
  <how-to-verify>
    1. In the ui/ submodule (branch feat/raw-outputs-fallback), run `yarn start` if not already running.
    2. Open a thread that has a model with at least one optional input (isOptional=true).
    3. Navigate to the Datasets step, enter edit mode.
    4. Confirm: optional inputs show a grey "info" icon and "(optional)" label — NOT an orange "warning" icon.
    5. Confirm: required inputs still show an orange "warning" icon when empty.
    6. Click "Continue" / "Save" without selecting data for the optional input.
    7. Confirm: the save proceeds normally (no "Please select at least one dataset" alert blocking on the optional input).
    8. Open browser DevTools console, re-trigger the save path, confirm the debug log group `[mint-datasets] _selectThreadDatasets gating` still appears with per-input lines.
  </how-to-verify>
  <resume-signal>Type "approved" if visual rendering is correct, or describe what looks wrong</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Hasura → UI | `isOptional` field value comes from DB via Apollo; UI renders it but does not gate security decisions on it |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260503-01 | Tampering | isOptional render flag | accept | Visual-only change; no auth or data-access decision depends on isOptional. Value originates from model catalog DB (trusted internal source). |
</threat_model>

<verification>
1. `grep -n "isOptional" ui/src/screens/modeling/thread/mint-datasets.ts` returns occurrences in both the gating logic (~line 1169) and the render template (new additions).
2. `grep -n "info" ui/src/screens/modeling/thread/mint-datasets.ts` returns the new icon reference in the render section.
3. `grep -n "optional" ui/src/screens/modeling/thread/mint-datasets.ts` returns the new `(optional)` label in the render section.
4. `grep -n "groupCollapsed" ui/src/screens/modeling/thread/mint-datasets.ts` still returns the debug line at ~1113.
5. Human checkpoint: optional inputs show grey info icon; required inputs show orange warning; save with unset optional inputs proceeds without alert.
</verification>

<success_criteria>
- Optional inputs in mint-datasets.ts render with grey info icon + "(optional)" label when no dataset is selected.
- Required empty inputs still render with orange warning icon.
- The navigation gate (`blocks = empty && !input.isOptional`) is unchanged and continues to allow proceed when only optional inputs are unset.
- The debug console.groupCollapsed instrumentation block is byte-for-byte preserved.
- The ui/ submodule change is committed on branch `feat/raw-outputs-fallback`; the outer repo submodule pointer is bumped.
</success_criteria>

<output>
After completion, create `.planning/quick/260503-rnt-apply-optional-input-warning-fix-to-mint/260503-rnt-01-SUMMARY.md` summarizing:
- What lines were changed in mint-datasets.ts
- Which isOptional occurrences are new (render) vs pre-existing (gating)
- Confirmation that debug instrumentation was preserved
- Submodule commit SHA on feat/raw-outputs-fallback
</output>
