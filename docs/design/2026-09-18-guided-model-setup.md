# Guided Model Setup from Dataset Discovery

Status: Implemented

## Objective

Replace the current `Start model setup` handoff with a guided problem-statement
flow. The flow should preserve the dataset/model context that initiated setup,
ask a small set of framing questions, retrieve relevant MINT standard
variables (SVOs), models, and datasets, and show those recommendations for
explicit user confirmation before continuing into model setup.

The first release is an assisted setup experience. It does not execute a
model, silently select recommendations, or replace the existing modeling
wizard.

## User need

- **Primary users:** Facilitators and data scientists beginning a model run
  from a discovered dataset or model.
- **Job to be done:** Turn an initial dataset/model selection and a short
  description of the user's goal into a reviewable problem formulation and a
  usable model-setup thread.
- **Current pain:** `Start model setup` navigates to the problem-statement list
  and drops the initiating dataset/model IDs. The user must manually create or
  find a problem statement, reconstruct the context, and repeat discovery in
  the modeling wizard.
- **Success:** The user answers a few questions, chooses whether to create a
  problem statement or add a task to an existing one, reviews evidence-backed
  recommendations, confirms or changes them, and reaches the modeling thread
  with the selected context retained.

## Current code/system summary

1. `DatasetCompatibilityPanel` currently navigates to
   `/modeling/problem-statements?modelId=...&datasetId=...`, but
   `ProblemStatementsList` does not consume those query parameters.
2. `ProblemStatementsList` creates a problem statement, provenance event, task,
   and default thread through the shared `provisionTask` helper. The form
   currently captures a name, region, date range, and notes.
3. `MintProblemStatement` manages tasks and threads under a saved problem
   statement. A new task can be created and selected inline.
4. `MintThread` already has sequential framing, variables, models, datasets,
   parameters, and runs steps. `ModelsStep` persists confirmed model
   configurations to `thread_models`.
5. `DatasetsStep` already finds datasets by the model input standard-variable
   names, region geometry, and date range, and persists selected resources as
   thread data bindings.
6. The semantic-search service already exposes
   `POST /problem-statements/recommendations`, returning ranked SVO and model
   configuration results with match context. It accepts draft text, goals,
   region, dates, and selected variable/model IDs.
7. Dataset discovery already resolves natural language to SVOs through semantic
   search and matches those SVOs to CKAN resource annotations. Dataset setup
   already has an exact standard-variable path for model inputs.

## Proposed design

### Entry point and context

- Change `Start model setup` to open a dedicated guided-start route, for
  example `/modeling/problem-statements/start`, carrying the initiating
  `modelId` and `datasetId` as route state or encoded query parameters.
- Preserve the initiating IDs through every step. Display them as **Starting
  context**, not as an implicit commitment: the user can remove, replace, or
  add recommendations before continuing.
- Keep `Build complete run` on the same guided entry point, with the initiating
  compatibility result shown as the initial context.

### Step 1 — Frame the problem

Ask only the information needed to produce useful recommendations:

| Question | Required | Persistence/use |
| --- | --- | --- |
| What are you trying to understand, predict, or decide? | Yes | Draft problem description and semantic recommendation query |
| What region or place does this concern? | Yes | Problem statement/task/thread region and hard dataset filter |
| What time period should the model consider? | Yes | Problem statement/task/thread dates and hard dataset filter |
| What outcome or indicator matters most? | No, recommended | Optional SVO selection and recommendation context |

The UI should use the existing region and standard-variable controls where
possible. It may offer an optional goal/notes field for additional context,
but should not require a long-form problem statement before showing results.

### Step 2 — Choose the problem-statement destination

Present two explicit choices before saving:

- **Create a new problem statement** — use the answers to create the saved
  statement, then provision its first task and thread.
- **Add to an existing problem statement** — select an existing statement and
  create a new task/thread under it, using the current answers as the task
  context. The existing statement itself is not overwritten.

The default should be creating a new statement. Existing statements should be
limited to the user's visible/authorized statements, using the same list and
permission behavior already used by the modeling pages.

### Step 3 — Recommend and confirm

After the framing answers are valid, call the existing
`problem_statement_recommendations` capability with the draft fields and the
initiating model/SVO context.

Display separate, editable recommendation groups:

1. **Standard variables / indicators** — ranked SVOs with label, description,
   and the matched context returned by semantic search.
2. **Models** — ranked model configurations with label, description, region,
   required inputs/outputs where available, and match evidence.
3. **Datasets** — datasets matched through confirmed SVOs and the selected
   model inputs, narrowed by the chosen region and time period. Show the
   source variables and coverage notes already available in the dataset
   discovery and data-catalog APIs.

Recommendations are suggestions, not automatic selections. Each item has an
explicit select/remove action, and the user must confirm the set before
continuing. The initiating model and dataset are shown as prefilled starting
context but still require confirmation, so the user can correct a misleading
match.

The recommendation view should explain *why* an item was suggested using
short evidence such as “matches your goal,” “provides the selected outcome,”
or “contains the required input variable.” It should not expose internal
implementation details such as vector search, SVO resolution, or embedding
scores in the end-user UI.

### Step 4 — Continue into modeling

On confirmation:

1. Save or select the destination problem statement.
2. Create a new task and default thread under that statement, unless the user
   explicitly chooses an existing task/thread in a later iteration.
3. Seed the thread framing fields and confirmed response variable where the
   current modeling schema supports them.
4. Persist confirmed model configurations using the existing thread-model
   mutation path.
5. Carry confirmed dataset recommendations into the datasets step as initial
   suggestions. The existing datasets step remains the authority for selecting
   model-input datasets, resources, and final persisted bindings.
6. Navigate to the saved problem statement with the new thread selected and
   the wizard ready at the next incomplete step.

No model run starts as part of this flow.

## Files likely affected

- `ui-react/src/App.tsx` — add the guided-start route.
- `ui-react/src/components/datasets/DatasetCompatibilityPanel.tsx` — route
  `Start model setup` and `Build complete run` through the guided flow while
  retaining model/dataset context.
- `ui-react/src/pages/modeling/GuidedModelSetup.tsx` (new) — questions,
  destination choice, recommendation review, and confirmation state.
- `ui-react/src/pages/modeling/ProblemStatementsList.tsx` — extract or reuse
  existing destination/list behavior without bypassing permissions.
- `ui-react/src/pages/modeling/MintProblemStatement.tsx` — accept a selected
  thread on navigation, if needed, and return to the guided flow cleanly.
- `ui-react/src/pages/modeling/MintThread.tsx` and wizard steps — accept
  confirmed initial model/SVO/dataset suggestions without changing the normal
  manual editing flow.
- `ui-react/src/lib/modeling/provisionTask.ts` — extend bootstrap only if the
  existing task/thread fields cannot be seeded after creation.
- `ui-react/src/hooks/useSemanticSearch.ts` and/or a new recommendation client
  — call and type the existing recommendation endpoint.
- `ui-react/src/lib/datasets/discovery.ts` and data-catalog helpers — reuse or
  expose dataset recommendation calls for confirmed SVOs and model inputs.
- Focused tests alongside the new page, route, recommendation mapping, and
  task/thread bootstrap.

No changes are planned to the unrelated dataset browse spatial-filtering work
currently in the worktree.

## API/schema changes

### Initial release

- Reuse `POST /problem-statements/recommendations` for draft SVO/model
  recommendations.
- Reuse the existing CKAN/data-catalog matching path for datasets after SVOs
  or model inputs are confirmed.
- Reuse existing Hasura mutations for problem statements, tasks, threads,
  thread models, and thread data.
- No database migration is planned. Draft narrative and recommendation
  selections remain page state until confirmation; confirmed state is written
  through existing modeling records.

### Possible follow-up

If users need to reopen or audit recommendation decisions, add a persisted
recommendation/provenance record in a separate design. It is not required for
the first guided flow.

## Data flow

```text
dataset/model entry
        |
        v
guided questions + region/date/SVO context
        |
        +--> POST problem-statement recommendations --> SVO/model results
        |
        +--> confirmed SVOs/model inputs + region/date --> dataset matching
                                                        |
                                                        v
                                      user confirms editable recommendations
                                                        |
                                                        v
                         save/new-or-existing PS -> task/thread -> modeling wizard
```

Semantic search remains an internal retrieval mechanism. The user sees
recommendations and concise match evidence, not the retrieval pipeline.

## Risks and tradeoffs

- **Recommendation quality:** The existing endpoint returns SVOs and model
  configurations, while dataset matching is a separate CKAN/data-catalog
  operation. The UI must handle partial results without implying that every
  model has a ready dataset.
- **Persisting too early:** Saving before confirmation can leave abandoned
  problem statements. The guided page should keep draft state local until the
  user confirms, then create the destination records once.
- **Existing statement semantics:** Adding a task preserves the existing
  statement, but the new task may introduce a narrower region/date scope. The
  UI must make that distinction visible.
- **Thread initialization:** Current model and dataset steps are designed for
  interactive edits. Prefilling them should not bypass their validation or
  resource-selection behavior.
- **Permissions:** Existing problem-statement selection and task creation must
  use the current authorization/provenance patterns; the guided route must not
  infer edit rights from a URL parameter.
- **Incomplete matches:** A recommendation may be relevant but not sufficient
  for a complete run. Continue should allow exploration of the thread, while
  the existing wizard remains responsible for completeness before execution.

## Alternatives considered

- **Navigate directly to the problem-statement list:** Rejected because it
  loses the initiating model/dataset context and does not formulate the user's
  problem.
- **Automatically select the top recommendations:** Rejected because the user
  explicitly asked for presentation and confirmation.
- **Create a new problem statement for every setup:** Rejected because users
  need to add related runs to an existing statement.
- **Build a new recommendation service:** Rejected because the semantic-search
  service already exposes the required problem-statement recommendation
  capability.
- **Make the guided page a second modeling wizard:** Rejected; the guided page
  should frame and recommend, then hand off to the existing thread wizard for
  detailed configuration and completeness checks.

## Test plan

- Route tests verify that model/dataset IDs are preserved when setup begins.
- Question tests verify required validation, region/date handling, optional
  outcome selection, and draft payload construction.
- Recommendation tests verify loading, empty, abstained, error, and partial
  SVO/model/dataset result states.
- Confirmation tests verify that no selection is silently accepted, items can
  be added/removed, and the initiating context remains editable.
- Destination tests verify both new problem-statement creation and adding a
  task/thread to an existing statement without overwriting it.
- Persistence tests verify provenance, thread-model seeding, and navigation to
  the newly created/selected thread.
- Regression tests verify that manually created problem statements and the
  existing modeling wizard continue to work unchanged.
- Run the focused UI tests, full UI test suite, typecheck, build, lint, and
  formatting checks appropriate to the changed files.

## Documentation plan

- Update the modeling UI documentation to describe guided setup, destination
  choices, recommendation confirmation, and the boundary between suggestions
  and run completeness.
- Update the semantic-search documentation only if the existing recommendation
  contract or payload is changed.
- Add user-facing copy/help text in the UI, without describing vector search,
  SVO resolution, or other internal retrieval details.

## Rollout/rollback plan

- Roll out the new route behind the existing setup entry point, keeping the
  existing problem-statement list and manual modeling paths available.
- If recommendation or dataset services fail, show a recoverable error and let
  the user continue with manual setup where possible.
- Rollback is a route/link change back to the existing problem-statement list;
  no persisted catalog data needs to be deleted.

## Open questions

- Should the initiating model and dataset be preselected but visibly editable,
  or should every recommendation start unchecked? This spec assumes they are
  prefilled as starting context but still require explicit confirmation.
- Should the optional outcome question be a free-text goal, an SVO picker, or
  both? This spec assumes an SVO picker plus the required natural-language goal.
- Should the new task name be generated from the goal, or should the user
  confirm/edit it before saving? The initial proposal is to generate a concise
  default and allow editing during confirmation.
- Should the first implementation let users choose an existing task/thread, or
  only add a new task/thread under an existing problem statement? This spec
  assumes the safer latter behavior.
- What minimum confirmed set should enable Continue when recommendations are
  partial? The likely rule is at least one model and any required input data
  can be completed in the existing wizard, but product confirmation is needed.

## Decisions

### 2026-09-18 — Guided setup starts with problem formulation

- **Decision:** `Start model setup` begins with a few problem-framing
  questions, then presents data/model recommendations for confirmation.
- **Reason:** Model setup should reflect the user's intended problem, not only
  the dataset or model that happened to start discovery.
- **Impact:** The current direct navigation to the problem-statement list will
  be replaced by a guided-start route that preserves initiating context.

### 2026-09-18 — Confirmation is explicit

- **Decision:** Recommendations are presented for user confirmation and remain
  editable before persistence.
- **Reason:** The user must be able to reject an inferred SVO, model, or dataset
  rather than accepting an opaque automatic selection.
- **Impact:** Recommendation results are draft UI state until confirmation;
  the existing modeling wizard remains available for further edits.

### 2026-09-18 — Existing problem statements can receive a new setup

- **Decision:** The guided flow may add a new task/thread under an existing
  problem statement.
- **Reason:** Related model runs often share a problem statement while needing
  separate dates, data, or model configurations.
- **Impact:** Existing problem statements are selected without being
  overwritten; task/thread creation continues to use existing permission and
  provenance patterns.

## User feedback / decisions

- User confirmed: “Presented for user confirmation. allow adding to an existing
  one is fine.”
- User approved implementation of the guided flow. For the first release, the
  required confirmation rule is a valid goal, region, date range, and at least
  one confirmed model; dataset suggestions remain editable and may be completed
  in the existing Datasets step when no suitable suggestion is available.
- The first release uses a natural-language optional outcome prompt rather than
  a second SVO picker. Returned SVO recommendations can be confirmed as the
  thread response variable.
- The first release adds a new task/thread under an existing problem statement;
  it does not let the user attach the setup to an existing task/thread.

### 2026-09-18 — Implementation notes

- Added `/modeling/problem-statements/start` as a protected guided entry point.
- Reused the existing semantic-search recommendation endpoint and the existing
  standard-variable-to-CKAN dataset matching path; no new backend route or
  schema migration was needed.
- Confirmed model selections are persisted immediately to the new thread. A
  confirmed dataset id is carried to the existing Datasets step as an initial
  editable suggestion so resource binding and validation remain in one place.
- The guided review presents multiple SVO candidates but confirms at most one
  as the thread's response variable because the current thread schema has a
  singular `response_variable_id`; additional variables remain discoverable
  in the existing Variables step.
- Dataset lookup is best effort: a catalog failure leaves SVO/model
  recommendations reviewable and the user can continue manually in the wizard.
