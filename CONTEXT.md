# MINT Platform

MINT is a scientific modeling platform. This repository holds its services, its
deployment chart, and its planning record.

This file is a glossary. It fixes the words this repository uses for its own
structure and delivery. It holds no implementation detail.

MINT **science** and **metadata** concepts are not here. They live in
[`knowledge-base/wiki/index.md`](./knowledge-base/wiki/index.md) — model catalog,
Software Description Ontology, scientific variables, units, provenance. Read that
wiki for a domain term. Read [`docs/adr/`](./docs/adr/) for a recorded decision.

## Language

### Repository layout

**superproject**:
The layout in use today. One repository holds each service as a git submodule.
_Avoid_: monorepo, parent repo, umbrella repo

**single-repo**:
The target layout. One repository holds each service as a plain directory, with
one history.
_Avoid_: monorepo, consolidated repo, merged repo

> **Never write "monorepo" for either one.** `mintproject/monorepo` is the name of
> this repository. The word also names both layouts above. It cannot tell them
> apart, so it is banned in prose about the migration.

**service**:
A separately deployable MINT component. It has its own build and its own
container image. Today: `model-catalog-api`, `mint-ensemble-manager`,
`graphql_engine`, `ui-react`, and the deprecated `ui`.
_Avoid_: package, module, component, app

**submodule**:
A git pointer from the superproject to another repository. A submodule is a
mechanism, not a service. Several submodules hold no service.
_Avoid_: dependency, subrepo

### Frontends

**`ui-react`**:
The current MINT frontend. It is a directory in this repository, not a submodule.
Its image is `mint-ui-react`.
_Avoid_: the React app, the new UI

**`ui`**:
The deprecated LitElement frontend. Its repository is `mint-ui-lit` and its image
is `mint-ui-lit`. The directory name and the repository name differ.
_Avoid_: the frontend (unqualified), the old UI

### Deployment

**the MINT chart**:
The Helm chart that deploys the whole platform. Its repository is
`mintproject/mint`. It appears in the superproject as the directory
`helm-charts/`. The three names denote one thing.
_Avoid_: helm-charts (as a repository name), the mint repo

**`dynamo`**:
The private repository that holds the deployment values for the TACC production
instance. It pins a chart version and image tags.
_Avoid_: the prod repo, the values repo

**the dev cluster**:
The shared MicroK8s instance used to test a branch before merge.
_Avoid_: staging, test cluster

### Planning

These words come from the `/wayfinder` skill. They have concrete referents here,
because every map and ticket is a GitHub issue in `mintproject/monorepo`.

**map**:
One issue that holds the whole route for a large effort. It carries the label
`wayfinder:map`. It is an index: it names each decision and links the ticket that
holds it.
_Avoid_: plan, epic, tracking issue

**destination**:
What one map is finding its way to. It fixes that map's scope.
_Avoid_: goal, outcome

**ticket**:
A child issue of a map. It asks one question whose answer is a decision.
_Avoid_: task, subtask, story

**frontier**:
The tickets of a map that are open, unblocked, and unassigned. These are the
tickets a session may take now.
_Avoid_: backlog, ready column

**fog of war**:
Work that is inside a map's destination but not yet sharp enough to state as a
ticket. A map records it under "Not yet specified".
_Avoid_: unknowns, TBD, icebox
