---
phase: quick
plan: 260328-hu8
subsystem: deployment
tags: [kubectl, hasura, automation, bash, deployment]
dependency_graph:
  requires: []
  provides: [scripts/deploy-hasura.sh]
  affects: []
tech_stack:
  added: []
  patterns: [bash set -euo pipefail, ERR trap, kubectl rollout restart + status]
key_files:
  created:
    - scripts/deploy-hasura.sh
  modified: []
decisions:
  - "Used hasura metadata apply (not metadata sync -- sync is console-only)"
  - "Used --skip-update-check flag for both migrate and metadata apply to suppress prompts in non-TTY exec"
  - "Pod discovery uses label selector app=mint-hasura matching existing mint-shell-hasura tooling"
metrics:
  duration: "3 min"
  completed: "2026-03-28"
  tasks_completed: 1
  files_created: 1
---

# Quick 260328-hu8: Create Script to Automate MINT Hasura/Model-Catalog Deployment Summary

## One-liner

Single bash script replacing the 4-step manual deploy cycle (restart model-catalog, restart hasura, shell into pod, run migrate+metadata) with `./scripts/deploy-hasura.sh [namespace]`.

## What Was Built

`scripts/deploy-hasura.sh` -- a 139-line executable bash script that automates the full MINT Hasura deployment cycle.

### Script Behavior

1. **Prerequisites check** -- verifies kubectl is installed and cluster is reachable (`cluster-info --request-timeout=5s`)
2. **Rollout restarts** -- restarts `mint-model-catalog` and `mint-hasura` deployments, then waits for both to become ready (120s timeout each)
3. **Pod discovery** -- finds the live hasura pod using label `app=mint-hasura`
4. **Migrations + metadata** -- runs `hasura migrate apply --skip-update-check && hasura metadata apply --skip-update-check` inside the pod via `kubectl exec`

### Flags

| Flag | Description |
|------|-------------|
| `[namespace]` | Kubernetes namespace (default: `mint`) |
| `--skip-restart` | Skip rollout restarts (useful when only migrations changed) |
| `--dry-run` | Print commands without executing (safe for testing) |

## Decisions Made

- **`hasura metadata apply` not `metadata sync`** -- `metadata sync` is a console-only command. `metadata apply` pushes the local metadata directory to the server and works in CLI/exec context.
- **`--skip-update-check`** -- prevents interactive update prompts when running inside a non-TTY kubectl exec session.
- **ERR trap** -- traps failures and prints which step failed, providing useful context beyond the raw bash error.
- **Label selector `app=mint-hasura`** -- matches the existing `mint-shell-hasura` tooling convention used in the team's scripts.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check

- [x] `scripts/deploy-hasura.sh` exists and is executable
- [x] `bash -n scripts/deploy-hasura.sh` passes
- [x] Contains `set -euo pipefail`
- [x] Contains `hasura migrate apply`
- [x] Contains `hasura metadata apply`
- [x] 139 lines (above 40-line minimum)
- [x] Commit 7c30fd1 exists
