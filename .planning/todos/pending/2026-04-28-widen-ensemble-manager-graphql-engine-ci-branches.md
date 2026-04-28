---
created: 2026-04-28T23:45:00.000Z
title: Widen ensemble-manager + graphql_engine CI branches glob
area: tooling
files:
  - mint-ensemble-manager/.github/workflows/build-image-amd64.yml
  - graphql_engine/.github/workflows/docker-publish.yml
---

## Problem

Both submodules have docker workflows triggered on `branches: '*'`, which does NOT match slashed branch names like `gsd/phase-12-is-optional`. Identical bug to what was already fixed in:

- `ui` repo (commit `e0547dd`)
- `model-catalog-api` repo (commit `7109442`)

Consequence: feature branches with submodule changes never produce a docker image, so dev cluster keeps running stale tags. This is exactly what made phase 12-05 appear broken (model-catalog-api fix masked by deploy-not-actually-rolled). Same trap is still armed for ensemble-manager + graphql_engine — next phase that touches them will hit it.

For ensemble-manager specifically: phase 12-04 added TapisJobService skip-when-optional; that code is currently undeployed in dev (helm `dynamo-values.yaml` still pins `ensemble_manager.image.tag = "model-catalog-migration"` static branch tag).

## Solution

Mirror the ui/mca fix on each repo:

1. **mint-ensemble-manager** `.github/workflows/build-image-amd64.yml`:
   - `branches: '*'` → `branches: ['**']`
   - Add SAFE_BRANCH env step (replace `/` → `-`)
   - Tag image with both `${SAFE_BRANCH}` and `${{ github.sha }}`

2. **graphql_engine** `.github/workflows/docker-publish.yml`:
   - Same widening + SAFE_BRANCH

3. After CI builds, bump `helm-charts/dynamo-values.yaml`:
   - `ensemble_manager.image.tag` → ensemble-manager HEAD SHA on phase-12 branch (so 12-04 TapisJobService logic actually deploys)
   - graphql_engine usually pinned to a release version, less critical

4. helm upgrade dev, smoke-test ensemble-manager Tapis path skips optional inputs as designed

Reference commits to mirror: ui `e0547dd`, model-catalog-api `7109442`. Both already on `gsd/phase-12-is-optional` branch in those submodules.

Not blocking phase 12 finalization. Pick up as a small standalone task or fold into next phase that touches these submodules.
