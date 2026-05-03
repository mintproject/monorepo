# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-03

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** mint — scientific modeling platform; unified catalog of models, datasets, variables, plus execution.
- **UI executions render path:** `ui/src/screens/modeling/thread/mint-runs.ts` reads `_executions[modelid].executions` populated by `executions_for_thread_model.graphql`, which JOINs through the `thread_model_execution` junction. Missing junction rows → indefinite "Downloading software image and data..." spinner at line 538 even when execution.status=FAILURE.
- **Tapis submission failure chain:** `TapisExecutionService.submitExecutions` → `processExecutionSeeds` (per-seed try/catch → `handleSingleExecutionFailure` sets FAILURE, increments failed_runs, decrements submitted_runs) → `handleSubmissionResults` throws "All jobs failed" if every seed failed → outer catch → `handleSubmissionFailure` → `handleFailedConnectionEnsemble` (deletes+reinserts summary, inserts thread_provenance event). Both handlers run for all-failed case.
- **Status mapping:** `TapisExecutionService.mapStatus` translates `jobs.JOB_NEW_STATUS.*`: FAILED/CANCELLED/PAUSED → FAILURE; FINISHED/ARCHIVED/SUCCESS → SUCCESS; PENDING/PROCESSING_INPUTS/STAGING_*/SUBMITTING_JOB/QUEUED → WAITING; RUNNING/ARCHIVING → RUNNING.
- **Tapis webhook URL validation:** Tapis Notifications rejects URLs via `NTFLIB_DLVRY_ADDR_NOT_URL` before reachability check. RFC 6762 reserved TLDs (`*.local`) fail. `TapisJobSubscriptionService.generateWebHookUrl` uses `prefs.tapis_webhook_base_url` first (trailing slash trimmed), falls back to `${prefs.ensemble_manager_api}/tapis`. Dev clusters: override → webhook.site/<uuid>; prod: FQDN ingress.
- **Stuck-spinner fix verification:** Always test on a FRESH thread. Pre-fix orphans (status=FAILURE, no junction) won't auto-recover on re-submit because `prepareModelExecutions` → `deleteThreadModelExecutionIds` wipes all junction for tm_id then `createExecutions` inserts fresh. Manually reinsert junction via Recovery section in `docs/debug-tapis-execution.md` for stale orphans.
- **Junction-deleting mutations (audit list):** Six compiled mutations in `mint-ensemble-manager` dist/server.js delete `thread_model_execution`: `new_executions` (no-op for new IDs), `delete_executions`, `delete_thread_model_executions`, `delete_thread_model_by_config`, `update_thread_data`, `update_thread_model`. Plus fixed `handle_failed_connection_ensemble`. Search this set first when debugging stuck-spinner.
- **Hasura admin query from inside cluster:** Use `wget --post-file=` (BusyBox alpine has no curl). Pipe JSON via stdin: `cat q.json | kubectl exec -i <pod> -c head -- sh -c 'cat > /tmp/q.json'` then `kubectl exec <pod> -c head -- sh -c 'wget -qO- --header="x-hasura-admin-secret: ..." --header="Content-Type: application/json" --post-file=/tmp/q.json http://mint-hasura/v1/graphql'`. Admin secret in `HASURA_GRAPHQL_ADMIN_SECRET` env on ensemble-manager pod.
- **ModelCatalogResource lazy-fetch wipes junction columns:** `ui/src/screens/models/configure/resources/resource.ts` `setResources()` (line 1419) stores inline parent payload in `_resources` but then calls `resourceApi.get(id)` per row, storing entity GET response in `_loadedResources[id]`. Both render (lines 479, 513) and `getResources()` (line 1642) read `_loadedResources`, NOT `_resources`. Junction-only fields (e.g. `isOptional` on modelcatalog_configuration_input) get dropped. Subclasses must capture inline overlay before `super.setResources()` and re-merge into `_loadedResources` via `requestUpdate()` override + sync overlay on user edits. See `ModelCatalogDatasetSpecification._junctionOverlay`.
- **Tapis fileInput ↔ model.input_files join is by NAME (brittle):** `TapisJobService.createJobFileInputsFromSeed` (`TapisJobService.ts:110`) does `model.input_files.find(i => i.name === fileInput.name)`. Name drift between Tapis app `jobAttributes.fileInputs[].name` and model-catalog `input_files.name` → "Component input not found for <name>". Keep names identical in Hasura. Real fix: join by `component.inputs[].id` ↔ `model.input_files[].id` or by position. See bug-065.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-26] Failure-cleanup mutations must not delete `thread_model_execution` junction rows without re-inserting them. UI joins through that junction; deletion strands FAILURE rows → indefinite spinner. See bug-011, `handle-failed-connection-ensemble.graphql`.
- [2026-04-26] Never derive Tapis webhook URLs from cluster-internal `*.local` hostnames. Validator `NTFLIB_DLVRY_ADDR_NOT_URL` rejects RFC 6762 reserved TLDs pre-reachability. Use `tapis_webhook_base_url` override in dev (webhook.site); reserve `ensemble_manager_api` fallback for FQDN-ingress envs. See bug-012.
- [2026-04-27] Never commit phase/feature work directly on `main`/`master`. Create feature branch (e.g. `gsd/phase-{N}-{slug}`) before first phase commit, in BOTH superproject AND any submodule receiving phase commits. Applies regardless of `branching_strategy: none`.
- [2026-05-01] "Component input not found for X" = name drift between Tapis app `fileInputs[].name` and model-catalog `input_files[].name`. Check both sides match in Hasura before code-diving. See bug-065.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->