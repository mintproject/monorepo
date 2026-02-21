---
phase: 03-fk-migration-and-cleanup
plan: 02
subsystem: infra
tags: [helm, kubernetes, fuseki, ensemble-manager, config]

# Dependency graph
requires:
  - phase: 03-fk-migration-and-cleanup
    provides: Context and research on Fuseki deprecation strategy
provides:
  - Fuseki (model_catalog_endpoint) disabled in Helm chart with enabled=false in values.yaml
  - All 4 Fuseki Helm templates guarded by model_catalog_endpoint.enabled condition
  - model_catalog_api key removed from ensemble-manager Helm ConfigMap and local config files
affects: [03-fk-migration-and-cleanup, deployment, ensemble-manager]

# Tech tracking
tech-stack:
  added: []
  patterns: [Helm enabled flag pattern for graceful service disable without template removal]

key-files:
  created: []
  modified:
    - helm-charts/charts/mint/values.yaml
    - helm-charts/charts/mint/templates/model-catalog-endpoint-backup.yaml
    - helm-charts/charts/mint/templates/ingress-model-catalog-endpoint.yaml
    - helm-charts/charts/mint/templates/ensemble-manager-config.yaml
    - mint-ensemble-manager/src/config/config.json
    - mint-ensemble-manager/src/config/config-tapis.json

key-decisions:
  - "ingress-model-catalog-endpoint.yaml guarded by AND of model_catalog_endpoint.enabled + ingress.enabled (not just ingress.enabled) so top-level flag controls all Fuseki resources"
  - "model-catalog-endpoint-backup.yaml guarded by AND of model_catalog_endpoint.enabled + backups.enabled for same reason"
  - "PVC template (pvc-model-catalog.yaml) left intact with helm.sh/resource-policy: keep for data preservation"
  - "TypeScript MintPreferences interface cleanup deferred to Plan 03 for atomicity (config files cleaned first)"

patterns-established:
  - "Disable pattern: set enabled=false in values.yaml; wrap templates in {{if .Values.components.X.enabled}} guard"

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 3 Plan 02: Fuseki Disable and model_catalog_api Config Cleanup Summary

**Fuseki (Jena/SPARQL) disabled in Helm chart via enabled=false flag with template guards; model_catalog_api key removed from ensemble manager ConfigMap and local config files**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-21T20:00:00Z
- **Completed:** 2026-02-21T20:08:00Z
- **Tasks:** 2
- **Files modified:** 6 (across 2 submodules)

## Accomplishments

- Set `components.model_catalog_endpoint.enabled: false` and `jobs.model_catalog_endpoint.enabled: false` in values.yaml -- Fuseki no longer deployed
- Added `model_catalog_endpoint.enabled` guard to `model-catalog-endpoint-backup.yaml` (was only guarded by `backups.enabled`)
- Added `model_catalog_endpoint.enabled` guard to `ingress-model-catalog-endpoint.yaml` (was only guarded by `ingress.enabled`)
- Removed `model_catalog_api` key from Helm ConfigMap template, `config.json`, and `config-tapis.json`
- Verified: no Fuseki-specific templates appear in `helm template` output when disabled; JSON files remain valid

## Task Commits

Each task was committed atomically:

1. **Task 1: Disable Fuseki in Helm chart** - `1f68731` (chore) -- values.yaml + template guards
2. **Task 2: Remove model_catalog_api from ConfigMap and config files** - `50526e1` (chore) -- 3 config files cleaned

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `helm-charts/charts/mint/values.yaml` - Set model_catalog_endpoint.enabled to false in both components and jobs sections
- `helm-charts/charts/mint/templates/model-catalog-endpoint-backup.yaml` - Added model_catalog_endpoint.enabled guard (AND with backups.enabled)
- `helm-charts/charts/mint/templates/ingress-model-catalog-endpoint.yaml` - Added model_catalog_endpoint.enabled guard (AND with ingress.enabled)
- `helm-charts/charts/mint/templates/ensemble-manager-config.yaml` - Removed model_catalog_api line from ConfigMap JSON
- `mint-ensemble-manager/src/config/config.json` - Removed model_catalog_api key
- `mint-ensemble-manager/src/config/config-tapis.json` - Removed model_catalog_api key

## Decisions Made

- `ingress-model-catalog-endpoint.yaml` previously only checked `ingress.enabled` (not the top-level `enabled`). Added AND guard so disabling the component is sufficient to stop all Fuseki resources from rendering.
- `model-catalog-endpoint-backup.yaml` previously only checked `backups.enabled`. Same fix applied.
- `model-catalog-endpoint.yaml` and `post-install-model-catalog-endpoint.yaml` already had `model_catalog_endpoint.enabled` guards -- no change needed.
- TypeScript `MintPreferences` interface cleanup deferred to Plan 03 to keep the change atomic with SDK removal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ingress-model-catalog-endpoint.yaml missing top-level enabled guard**
- **Found during:** Task 1 (Disable Fuseki in Helm chart)
- **Issue:** Template guarded only by `model_catalog_endpoint.ingress.enabled`, not by `model_catalog_endpoint.enabled`. Setting the top-level enabled=false would not suppress the ingress.
- **Fix:** Changed guard to `{{- if and .Values.components.model_catalog_endpoint.enabled .Values.components.model_catalog_endpoint.ingress.enabled -}}`
- **Files modified:** `helm-charts/charts/mint/templates/ingress-model-catalog-endpoint.yaml`
- **Verification:** `helm template` with enabled=false renders no ingress resource
- **Committed in:** `1f68731` (Task 1 commit)

**2. [Rule 1 - Bug] model-catalog-endpoint-backup.yaml missing top-level enabled guard**
- **Found during:** Task 1 (Disable Fuseki in Helm chart)
- **Issue:** Template guarded only by `backups.enabled`, not by `model_catalog_endpoint.enabled`. Backup CronJob would still render if backups enabled but Fuseki disabled.
- **Fix:** Changed guard to `{{- if and .Values.components.model_catalog_endpoint.enabled .Values.components.backups.enabled }}`
- **Files modified:** `helm-charts/charts/mint/templates/model-catalog-endpoint-backup.yaml`
- **Verification:** `helm template` with enabled=false renders no backup CronJob
- **Committed in:** `1f68731` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - missing guard bugs in Helm templates)
**Impact on plan:** Both fixes required for correct disable behavior. Without them, setting enabled=false would not fully disable Fuseki. No scope creep.

## Issues Encountered

The plan's verify step (`helm template | grep -c "model-catalog-endpoint" should return 0`) returned 5, not 0. Investigation showed references come from `model-catalog.yaml` (FastAPI v1.8.0, intentionally kept running per user decision) and `secrets.yaml` (global secrets file). None of the 5 are from the 4 Fuseki-specific templates -- those render zero output when disabled. Verification criteria adjusted to confirm no Fuseki-specific Source templates appear.

## User Setup Required

None - no external service configuration required. Changes take effect on next Helm release upgrade.

## Next Phase Readiness

- Fuseki is fully disabled in the Helm chart; no Fuseki resources will be deployed
- model_catalog_api config key is gone from all three config files
- Plan 03 (TypeScript SDK removal and MintPreferences cleanup) can proceed atomically
- PVC with existing Fuseki data is preserved for emergency rollback

## Self-Check: PASSED

All claimed files exist and commits are present in git log.

---
*Phase: 03-fk-migration-and-cleanup*
*Completed: 2026-02-21*
