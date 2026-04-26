---
phase: 11
slug: simplify-ensemble-manager-and-ui-execution-model-kill-thread
status: approved
reviewed_at: 2026-04-26
shadcn_initialized: false
preset: none
created: 2026-04-26
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the Runs panel state machine. Generated from CONTEXT.md decisions D-09/D-10/D-11. Scope is **logic disambiguation in `mint-runs.ts`** — no global typography, color, or component-library changes. The phase replaces the conflated "executions array empty = generic spinner" rendering with an explicit four-state machine driven by `thread_model.submission_time`, `thread_model.last_submission_status`, and execution status counts.

---

## Scope

**In scope:**
- `ui/src/screens/modeling/thread/mint-runs.ts` — render branch around lines 372–545 (the per-model `<li>` block that today shows a spinner or a table of runs).
- Copy strings + severity tone for the four rendering states.
- Retry affordance on the new "Submission failed" state.
- Removal of the `Downloading software image and data...` fallback at line 538.
- Per-row WAITING progress-bar copy (clarification only — visual unchanged).

**Out of scope:**
- Typography, page chrome, breadcrumb, sidebar (`Problem Statements > test`), framing/parameters/results tabs.
- Color palette overhaul (no global token introduction — phase reuses inline `red` literal already used at line 280 + `wl-progress-bar.FAILURE` styles).
- Run results table column structure, run-log dialog, dataset-file links.
- Component library swap (LitElement + Weightless stays).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (existing LitElement app) |
| Preset | not applicable |
| Component library | Weightless (`wl-button`, `wl-progress-bar`, `wl-progress-spinner`, `wl-snackbar`, `wl-title`) |
| Icon library | Material Icons (via `<wl-icon>`) |
| Font | Benton Sans (14px body, 1.6 line-height, `#444`) |

No new dependencies. No new component files. Banner is a styled `<div>` inside `mint-runs.ts` template — kept local to avoid component sprawl for a single-use surface.

---

## Spacing Scale

Reuses values already inline in `mint-runs.ts`. No formal token system — values listed for checker reference only:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Icon-to-text gap inside banner |
| sm | 8px | Button padding (matches existing `--button-padding: 2px` style on inline buttons) |
| banner-v | 12px | Banner vertical inner padding (declared exception — multiple of 4, matches existing `<p>` rhythm at `mint-runs.ts:265-285`) |
| md | 16px | Banner horizontal inner padding, default element gap |
| lg | 24px | Empty-state container padding, banner outer margin |

Banner padding resolves to `12px 16px` (banner-v vertical / md horizontal). All values are multiples of 4.

---

## Typography

Inherits from project (`shared-styles.ts` + `mint-runs.ts` inline). No overrides in this phase.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Banner body (inherited) | 14px | 400 | 1.6 |
| Banner heading (introduced) | 14px | 600 | 1.4 |

Phase introduces only one new weight (600) on the banner heading; everything else inherits from the existing project stylesheet (`shared-styles.ts`) and Weightless component defaults. Button-label weight is owned by `wl-button` internal CSS — not declared here.

---

## Color

No new tokens. Phase reuses existing inline values:

| Role | Value | Usage in this phase |
|------|-------|---------------------|
| Body text | `#444` | Default text inside banner body |
| Destructive accent | `red` (CSS keyword) | Banner left border, banner heading, retry-button outline; same keyword already used at `mint-runs.ts:280` and on `wl-progress-bar.FAILURE` |
| Destructive surface | `#fff0f0` | Banner background |
| Neutral surface | `#FAFAFA` | "Not run yet" empty-state background |
| Border | `#EEE` | Banner border (matches existing table border at line 373) |

**Accent reserved for:** the Submission-failed banner left border, the failed-run progress bar (existing), and the `${failed_runs} failed` count text (existing). The retry button uses a neutral wl-button style with `red` text — not a filled red button (avoids competing with the banner edge).

---

## State Machine

The four rendering states for the per-model `<li>` block (`mint-runs.ts` ~ lines 372–545):

| # | Trigger condition (exact) | Render |
|---|---------------------------|--------|
| 1 | `thread_model.submission_time == null` | **Empty state.** Centered `<div>` with copy "Not run yet" + sub-line "Submit this thread to generate runs for `${model.name}`." Background `#FAFAFA`, padding `lg` (24px), border `1px solid #EEE`. No spinner. No table. |
| 2 | `thread_model.submission_time != null` AND `executions.length == 0` | **Submission-failed banner** (see §Banner spec below). No table. |
| 3 | `executions.length > 0` AND `executions.some(e => e.status === 'WAITING' \|\| e.status === 'RUNNING')` | **Existing table** with per-row `wl-progress-bar` + textual summary line at lines 274–285. WAITING rows show indeterminate `wl-progress-bar` (no value) with caption "Submitting…" replacing the deleted line-538 string. |
| 4 | `executions.length > 0` AND every run is terminal (`status` ∈ {`SUCCESS`, `FAILURE`}) | **Existing table** unchanged. Footer "Continue" button visible (lines 550–562) when `done == true`. |

**Mutual exclusivity:** Conditions are evaluated top-to-bottom; first match wins. `submission_time != null && executions.length > 0` always falls into 3 or 4 — the banner only renders when no rows exist at all.

---

## Banner Spec — "Submission failed" (state 2)

Rendered as inline `<div>` inside the model `<li>` block, replacing the table area. Structure:

```html
<div class="submission-failed-banner" role="alert" aria-live="polite">
  <div class="banner-row">
    <wl-icon style="color: red; vertical-align: middle;">error_outline</wl-icon>
    <span class="banner-heading">Submission failed</span>
  </div>
  <p class="banner-body">
    The runs for <strong>${model.name}</strong> could not be submitted to the
    execution server. ${last_submission_status ? `Reason: ${last_submission_status}` : ''}
  </p>
  <wl-button
    class="retry-button"
    flat
    @click="${() => this._submitRuns(model.id)}"
  >
    Retry submission
  </wl-button>
</div>
```

Inline styles (kept local — no shared CSS file change):

```css
.submission-failed-banner {
  background: #fff0f0;
  border: 1px solid #EEE;
  border-left: 4px solid red;
  padding: 12px 16px;
  margin: 0;
  font-size: 14px;
  color: #444;
}
.submission-failed-banner .banner-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.submission-failed-banner .banner-heading {
  font-weight: 600;
  color: red;
}
.submission-failed-banner .banner-body {
  margin: 4px 0 12px 0;
}
.submission-failed-banner .retry-button {
  --button-padding: 6px 12px;
  --button-border-radius: 4px;
  color: red;
}
```

**Why inline `<div>` and not `wl-snackbar`:** snackbar is a fixed-position toast that auto-dismisses; submission-failure is persistent state, must stay in-flow alongside the model card, and must keep the retry button visible until the user acts. Snackbar pattern reserved for transient action-confirm toasts (existing usage in `ui_renders.ts`).

---

## Spinner Spec — "Submitting…" caption (state 3, per-row WAITING)

Replaces the literal copy at line 538 inside the WAITING-row branch (lines 523–542):

| Aspect | Value |
|--------|-------|
| Component | Existing `wl-progress-bar` (indeterminate — no `value` prop) at line 534 |
| Caption copy | `Submitting…` (replaces `Downloading software image and data...`) |
| Layout | Unchanged — `display: inline-block; margin-right: 15px` on bar, caption inline |
| Loop behavior | Indeterminate animation continues until status moves to RUNNING/SUCCESS/FAILURE; row re-renders on status change |

**Rationale:** "Downloading software image and data..." is an implementation-leak (Tapis-specific semantics not visible to MINT users); "Submitting…" is accurate for the lifecycle stage and shorter.

---

## Empty-State Spec — "Not run yet" (state 1)

Replaces the conflated empty-table render today (when `grouped_ensemble.executions === undefined` falls into the line-538 branch by mistake).

| Aspect | Value |
|--------|-------|
| Container | `<div class="not-run-empty-state">` |
| Copy heading | `Not run yet` |
| Copy body | `Submit this thread to generate runs for ${model.name}.` |
| CTA | None in this phase — submit action lives in the upper "Run" button (existing). Banner is informational. |
| Spinner | None |
| Background | `#FAFAFA` |
| Border | `1px solid #EEE` |
| Padding | `24px` |
| Text alignment | Centered |
| Font color | `#444` (body) — no red, no accent |

---

## Removal Contract

The following code must be deleted/replaced as part of the planner's tasks. Acceptance grep checks must verify removal:

| Location | Current | Action |
|----------|---------|--------|
| `mint-runs.ts:538` | `Downloading software image and data...` | **Delete** the literal. Replace the surrounding wrap (lines 523–542) with the new state-3 caption "Submitting…" inside the same `<wl-progress-bar>` row. |
| `mint-runs.ts:88-97` (state derivation) | Empty-array → spinner conflation | **Replace** with explicit four-condition switch keyed on `thread_model.submission_time`, `thread_model.last_submission_status`, and `executions.length` + `executions[*].status`. |
| `mint-runs.ts:376-378` (loading branch) | `<wl-progress-spinner class="loading">` shown when `grouped_ensemble.loading` | **Keep** — this is the GraphQL-fetch loading state, distinct from execution-WAITING. Must NOT be conflated with state 3. Add comment: `// fetch loading — not the same as execution WAITING`. |
| Renderer pre-condition | `grouped_ensemble && !grouped_ensemble.loading` | **Reframe**: after the GraphQL fetch resolves, fall into the new four-state switch. The spinner at line 377 only covers the fetch itself. |

**Forbidden patterns** (planner must encode as anti-acceptance criteria):
- No new `wl-progress-spinner` rendered on `executions.length === 0` outside of the GraphQL-fetch loading branch.
- No literal string `"Downloading software image and data..."` anywhere in the updated file.
- No `wl-snackbar` for submission-failure state.

---

## Accessibility

| Concern | Spec |
|---------|------|
| Banner role | `role="alert"` on the submission-failed `<div>` so assistive tech announces immediately on first render. |
| State transition announcement | `aria-live="polite"` on the banner container — subsequent re-renders (e.g., after a retry attempt) read out the new state without interrupting. |
| Retry button name | Visible label "Retry submission" — no extra `aria-label` needed. |
| Empty-state landmark | `<div role="status">` on the "Not run yet" container so the empty state is reachable but not announced as an error. |
| Color-not-only-signal | The banner pairs the `error_outline` icon + bold "Submission failed" heading with the red border — never relies on color alone. |
| Focus order | Retry button receives focus naturally in DOM order; no `autofocus` (would surprise users navigating elsewhere on the page). |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| State 1 heading | `Not run yet` |
| State 1 body | `Submit this thread to generate runs for ${model.name}.` |
| State 2 banner heading | `Submission failed` |
| State 2 banner body (with reason) | `The runs for ${model.name} could not be submitted to the execution server. Reason: ${last_submission_status}` |
| State 2 banner body (no reason) | `The runs for ${model.name} could not be submitted to the execution server.` |
| State 2 retry button | `Retry submission` |
| State 3 per-row caption | `Submitting…` |
| State 4 footer button | `Continue` (existing — unchanged) |
| Existing summary line (lines 274–285) | **Unchanged.** Keeps `"X model runs have been submitted, out of which Y succeeded, while Z failed. W are currently running"` — already correct copy, drives by computed counters from the M3 view. |

**Deferred copy questions** (raise in execution if engineering uncovers product-text needs):
- Wording when `last_submission_status` is a multi-line stack trace vs short error code — planner may need a truncate-to-120-chars helper.
- Should "Retry submission" become "Submitting…" with a spinner during the retry round-trip? Default: yes — disable button + change label, restore on response. (Locked: yes.)

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Weightless | `wl-button`, `wl-progress-bar`, `wl-progress-spinner`, `wl-icon` | not required (already in use) |
| Material Icons | `error_outline` icon name | not required (existing `<wl-icon>` glyph names) |
| shadcn / external registry | none | n/a — no new components |

**No new third-party libraries introduced.** No build-system changes.

---

## Non-Goals (explicit, to prevent checker false-positive flags)

- **No design-system migration.** Project stays on LitElement + Weightless. Any "should this move to shadcn?" question is out of scope and belongs in a separate roadmap phase.
- **No global color token introduction.** `red` keyword + `#444` + `#fff0f0` + `#FAFAFA` + `#EEE` are reused as-is. A future cleanup phase may centralize these.
- **No table layout changes.** Run-status / start-time / end-time / log / inputs columns stay byte-identical.
- **No mobile responsive work.** App is desktop-only per existing patterns.
- **No i18n.** Copy is English-only (matches existing app).
- **No analytics events** added on retry-button click in this phase. Logging exists already at the `_submitRuns` layer.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — five locked strings, two deferred-with-default, no Lorem-ipsum.
- [x] Dimension 2 Visuals: PASS — banner spec is unambiguous (icon + heading + body + button), table unchanged.
- [x] Dimension 3 Color: PASS-with-FLAG — reuses existing inline values; 60/30/10 split deferred to a future palette-cleanup phase (Non-Goals).
- [x] Dimension 4 Typography: PASS — only banner-heading 600 introduced; body inherits.
- [x] Dimension 5 Spacing: PASS — banner-v=12px catalogued as declared exception; all values are 4-multiples.
- [x] Dimension 6 Registry Safety: PASS — no new dependencies, all components already in use.

**Approval:** approved 2026-04-26
