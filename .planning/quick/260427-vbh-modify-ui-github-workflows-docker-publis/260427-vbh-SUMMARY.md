---
phase: quick-260427-vbh
plan: "01"
subsystem: ui/ci
tags: [docker, ci, github-actions, branch-sanitization]
dependency_graph:
  requires: []
  provides: [sanitized-docker-tags-for-slash-branches]
  affects: [ui/.github/workflows/docker-publish.yml]
tech_stack:
  added: []
  patterns: [SAFE_BRANCH env var via bash string substitution]
key_files:
  modified:
    - ui/.github/workflows/docker-publish.yml
decisions:
  - Replace raw branch name with SAFE_BRANCH (/ -> -) in docker tag to fix invalid tag for slash-containing branch names
metrics:
  duration: ~3min
  completed: 2026-04-27
---

# Quick Task 260427-vbh: Modify UI GitHub Workflows Docker Publish Summary

**One-liner:** Docker workflow now sanitizes branch names (replaces `/` with `-`) via `SAFE_BRANCH` env var so slash-containing branches like `gsd/phase-12-is-optional` produce valid image tags.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Commit diff in ui submodule | e0547dd (ui) | ui/.github/workflows/docker-publish.yml |
| 2 | Bump ui submodule pointer in superproject | b70cdb7 (mint) | ui (submodule pointer) |

## Changes Made

`ui/.github/workflows/docker-publish.yml`:
- Widened push trigger from `'*'` to `'**'` so branches containing `/` are included
- Added `SAFE_BRANCH` env var that replaces `/` with `-` in the current branch name
- Changed `docker/build-push-action` `tags:` to use `${{ env.SAFE_BRANCH }}` instead of the raw branch name output

## Deviations from Plan

None - plan executed exactly as written. Diff was pre-applied; only commits were needed.

## Verification

- SAFE_BRANCH appears 3 times in docker-publish.yml (set, export, tags line): PASS
- Trigger shows `'**'`: PASS
- Submodule pointer in superproject matches ui commit e0547dd: PASS

## Self-Check: PASSED

- ui commit e0547dd exists: FOUND
- superproject commit b70cdb7 exists: FOUND
- docker-publish.yml modified: FOUND
