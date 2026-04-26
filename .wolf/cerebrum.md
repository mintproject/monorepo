# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-12

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** mint
- **Description:** MINT is a scientific modeling platform that enables researchers to discover, configure, and execute computational models. It provides a unified catalog of models, datasets, and variables, allowing sci
- **UI executions fetch path:** ui/src/screens/modeling/thread/mint-runs.ts renders run rows from `_executions[modelid].executions`, populated via `executions_for_thread_model.graphql` which JOINS through the `thread_model_execution` junction (`where: { thread_model_executions: { thread_model_id: { _eq: $threadModelId } } }`). If the junction is missing, UI shows the "Downloading software image and data..." fallback at line 538 even when execution.status=FAILURE.
- **Tapis submission failure handler chain:** TapisExecutionService.submitExecutions -> processExecutionSeeds (per-seed try/catch -> handleSingleExecutionFailure marks status=FAILURE, increments failed_runs, decrements submitted_runs) -> handleSubmissionResults throws "All jobs failed" if every seed failed -> outer catch -> handleSubmissionFailure -> handleFailedConnectionEnsemble (deletes+reinserts summary, inserts thread_provenance event). Both handlers run for the all-failed case.
- **Status string mapping:** TapisExecutionService.mapStatus translates Tapis "jobs.JOB_NEW_STATUS.*" tokens to mint Status enum (FAILED/CANCELLED/PAUSED -> FAILURE; FINISHED/ARCHIVED/SUCCESS -> SUCCESS; PENDING/PROCESSING_INPUTS/STAGING_*/SUBMITTING_JOB/QUEUED -> WAITING; RUNNING/ARCHIVING -> RUNNING).
- **Tapis webhook URL validation:** Tapis Notifications service rejects subscription delivery URLs via `NTFLIB_DLVRY_ADDR_NOT_URL` before reachability is even checked. Hostnames in RFC 6762 reserved TLDs (e.g. `*.local` mDNS) fail this validator. The webhook target must be a publicly resolvable URL. In ensemble-manager, `TapisJobSubscriptionService.generateWebHookUrl` reads `prefs.tapis_webhook_base_url` first (override; trailing slash trimmed) and falls back to `${prefs.ensemble_manager_api}/tapis` only when the override is unset. Dev clusters point the override at https://webhook.site/<uuid>; prod relies on the FQDN ingress.
- **Tapis stuck-spinner debugging — always test on a FRESH thread:** Threads that failed BEFORE the bug-011 fix shipped have orphan execution rows (status=FAILURE, no junction row) that cannot be auto-recovered by a re-submit because each new submission goes through `prepareModelExecutions` -> `deleteThreadModelExecutionIds` (wipes ALL junction for tm_id) -> `createExecutions` (inserts fresh junction). The orphans stay orphaned. To verify the fix works, create a new thread or use the Recovery section in `docs/debug-tapis-execution.md` to manually reinsert junction rows for stale orphans.
- **Junction-deleting mutations (audit list):** Six compiled mutations in mint-ensemble-manager dist/server.js delete `thread_model_execution`: `new_executions` (no-op for new IDs), `delete_executions`, `delete_thread_model_executions`, `delete_thread_model_by_config`, `update_thread_data`, `update_thread_model`. Plus the now-fixed `handle_failed_connection_ensemble`. When debugging stuck-spinner reports, search this set first before looking elsewhere.
- **Hasura admin query from inside the cluster:** When debugging from a pod, use `wget --post-file=` (BusyBox `wget` ships in alpine images, `curl` does not). Pipe JSON via stdin: `cat q.json | kubectl exec -i <pod> -c head -- sh -c 'cat > /tmp/q.json'` then `kubectl exec <pod> -c head -- sh -c 'wget -qO- --header="x-hasura-admin-secret: ..." --header="Content-Type: application/json" --post-file=/tmp/q.json http://mint-hasura/v1/graphql'`. The admin secret lives in `HASURA_GRAPHQL_ADMIN_SECRET` env on the ensemble-manager pod.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-26] Failure-cleanup mutations must not delete `thread_model_execution` junction rows without re-inserting them. UI executions list joins through that junction; deleting it strands FAILURE-marked execution rows so the UI shows an indefinite "Downloading..." spinner. See bug-011, handle-failed-connection-ensemble.graphql.
- [2026-04-26] Never derive Tapis webhook URLs from cluster-internal `*.local` hostnames. Tapis Notifications validates the URL with `NTFLIB_DLVRY_ADDR_NOT_URL` before any reachability test and rejects RFC 6762 reserved TLDs. Use the `tapis_webhook_base_url` config override in dev clusters (e.g. webhook.site) and reserve the `ensemble_manager_api` fallback for environments with a publicly resolvable FQDN. See bug-012.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
