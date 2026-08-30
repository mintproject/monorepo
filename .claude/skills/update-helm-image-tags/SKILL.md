---
name: update-helm-image-tags
description: Update image tags in a single helm values.yaml to the latest commit SHA on the default branch (master/main) for graphql_engine, mint-ensemble-manager, model-catalog-api, and ui (mint-ui-lit). Use when the user asks to bump helm image tags, refresh deployment images, or sync a values file to latest upstream commits.
---

# update-helm-image-tags

Bumps `components.<key>.image.tag` in a chosen helm values file to the latest commit SHA on each component's default branch. Only keys that already exist in the target file are touched.

## Usage

```bash
.claude/skills/update-helm-image-tags/update.sh <path-to-values.yaml> [--dry-run] [--component NAME]...
```

Examples:

```bash
# bump all matching tags in dynamo-values.yaml
.claude/skills/update-helm-image-tags/update.sh helm-charts/dynamo-values.yaml

# preview only
.claude/skills/update-helm-image-tags/update.sh helm-charts/charts/mint/values.yaml --dry-run

# only one component
.claude/skills/update-helm-image-tags/update.sh helm-charts/dynamo-values.yaml --component ui
```

## Component → repo → branch mapping

| Component key (yaml) | Source repo | Branch |
|---|---|---|
| `components.hasura` | `mintproject/graphql_engine` | `main` |
| `components.model_catalog_api` | `mintproject/model-catalog-api` | `main` |
| `components.ui` | `mintproject/mint-ui-lit` | `master` |
| `components.ensemble_manager` | `mintproject/mint-ensemble-manager` | `master` |

## Behavior

1. Reads `<values-file>`. For each component, skips it if `components.<key>.image.tag` is absent.
2. Resolves SHA via `git ls-remote https://github.com/<owner>/<repo>.git refs/heads/<branch>`.
3. Updates the tag via `yq -i '.components.<key>.image.tag = "<sha>"' <file>` (preserves comments/formatting).
4. Prints a summary: component → old → new.
5. Does not commit.

## Requirements

- `git` (uses `git ls-remote`, no clone)
- `yq` (mikefarah v4)

## After running

Inspect: `git -C helm-charts diff <file>`. Commit inside the helm-charts submodule, then bump the submodule pointer in the parent if you want it tracked there.
