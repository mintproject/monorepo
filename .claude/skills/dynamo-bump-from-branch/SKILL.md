---
name: dynamo-bump-from-branch
description: Bump dynamo helm image tag(s) to the current HEAD SHA of one or more submodule fix/feature branches, on a same-named dynamo branch, then commit + push + open PR. Use when the user asks to deploy a fix/feature branch from mint-ensemble-manager / model-catalog-api / ui / graphql_engine through dynamo, or to "create a dynamo branch and bump the image tag" for a submodule branch.
---

# dynamo-bump-from-branch

Automates the end-to-end flow used after merging or pushing a fix/feature branch in one of MINT's submodules:

1. Read each submodule's current branch + HEAD SHA (or `--branch` override resolved via `git ls-remote`).
2. Switch the dynamo repo to a same-named branch (create if missing) off `--base` (default `main`).
3. Update `MINT.components.<key>.image.tag` in `shared/values.yaml` for each mapped component.
4. Commit with an auto-generated message that lists each component + SHA.
5. Push the branch (`-u origin`).
6. Open a PR against `--base` via `gh pr create`.

Mirrors the manual sequence run for [mint-ensemble-manager#118 → dynamo#5].

## Usage

```bash
.claude/skills/dynamo-bump-from-branch/bump.sh \
  --submodule mint-ensemble-manager \
  [--submodule ui] \
  [--branch <name>] \
  [--base main] \
  [--dynamo-dir dynamo] \
  [--values shared/values.yaml] \
  [--title <pr-title>] \
  [--body <pr-body>] \
  [--no-push] [--no-pr] [--dry-run]
```

`--submodule` may be repeated. At least one is required.

### Branch resolution

- If `--branch` is given: resolve each submodule's SHA via `git ls-remote https://github.com/<owner>/<repo>.git refs/heads/<branch>`.
- If `--branch` is omitted: each submodule's CURRENT local branch is used. All submodules must agree on the branch name (script aborts otherwise — pass `--branch` explicitly to override).

The dynamo branch name = the resolved branch name.

## Submodule → component mapping

| Submodule dir | Component key in values.yaml | Source repo |
|---|---|---|
| `mint-ensemble-manager` | `MINT.components.ensemble_manager` | `mintproject/mint-ensemble-manager` |
| `model-catalog-api` | `MINT.components.model_catalog_api` | `mintproject/model-catalog-api` |
| `ui` | `MINT.components.ui` | `mintproject/mint-ui-lit` |
| `graphql_engine` | `MINT.components.hasura` | `mintproject/graphql_engine` |

## Behavior

- Skips a component if its `image.tag` key is missing in the values file.
- If the dynamo branch already exists locally, it is checked out (no reset). Add new commits on top.
- Commit message format:
  ```
  chore(dynamo): bump <comma-separated component keys> to <branch>

  - <component>: <short-sha>  (<owner/repo>@<branch>)
  ...
  ```
- PR title default: same as commit subject. PR body lists each bumped component with link to its upstream branch.
- `--no-push` skips push + PR. `--no-pr` skips PR only. `--dry-run` prints planned changes and exits without writing.

## Requirements

- `git`, `yq` (mikefarah v4), `gh` (logged in as a user with PR access to the dynamo repo).
- Run from a working tree where each named submodule is checked out at the desired branch (or pass `--branch`).

## Example: the original walkthrough

```bash
# After pushing fix/match-tapis-output-shape on mint-ensemble-manager:
.claude/skills/dynamo-bump-from-branch/bump.sh \
  --submodule mint-ensemble-manager
```

Produces a `fix/match-tapis-output-shape` branch in `dynamo/`, bumps
`MINT.components.ensemble_manager.image.tag` to the submodule's HEAD SHA,
commits, pushes, and opens a PR against `main`.

## After running

The PR depends on the upstream submodule CI publishing the docker image at that
SHA. Wait for `mintproject/<image>:<sha>` to be available before merging.
