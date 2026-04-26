# Debug Tapis Execution State

Helper queries for diagnosing stuck-on-spinner symptoms after Tapis submission failures.

## Symptom

UI stuck on "Downloading software image and data..." after `POST /v1/executionEngines/tapis` returns 500. Cause: `handle_failed_connection_ensemble` deletes the `thread_model_execution` junction. UI's `executions_for_thread_model` query joins through that junction and returns 0 rows even when the execution row is marked `FAILURE`.

> **Important — fresh thread vs. stale thread.** The fix in commit `aa15d063` (mint-ensemble-manager) preserves the junction on submission failure. New threads submitted against an image >= aa15d063 render the FAILURE row correctly. Threads that failed BEFORE the fix shipped will keep showing the spinner forever — their execution rows are orphans (`status=FAILURE`, no junction row) and re-submitting does NOT heal them, because `prepareModelExecutions` calls `deleteThreadModelExecutionIds(tm_id)` which wipes the entire junction for that thread_model before inserting the new attempt. To recover stuck stale threads, use the Recovery section below. To verify the fix works, always test against a brand-new thread.

## Junction-deleting mutations (audit list)

When debugging a stuck-spinner report, these are the only seven mutations in `mint-ensemble-manager` that delete `thread_model_execution` rows. Search this set first.

| Mutation | File | When it fires |
|---|---|---|
| `handle_failed_connection_ensemble` | `queries/execution/handle-failed-connection-ensemble.graphql` | After `aa15d063`, **does not** delete the junction. Older images do. |
| `new_executions` | `queries/execution/new.graphql` | Per-batch in `setExecutions`. Filters by `execution_id _in $ids` so it is a no-op for newly minted IDs. |
| `delete_executions` | `queries/execution/delete.graphql` | Explicit user delete of executions. |
| `delete_thread_model_executions` | `queries/execution/delete-thread-model-executions.graphql` | Called from `prepareModelExecutions` BEFORE `createExecutions` — wipes all junction rows for the thread_model. |
| `delete_thread_model_by_config` | `queries/model/delete.graphql` | Cascade when a model_catalog configuration is deleted. |
| `update_thread_data` | `queries/thread/set-dataslice-resources.graphql`, `update-datasets.graphql`, `update-datasets-and-parameters.graphql` | UI rewrites thread inputs. |
| `update_thread_model` | `queries/thread/update.graphql`, `update-models.graphql`, `update-parameters.graphql` | UI rewrites thread model selection or parameters. |

## Setup

```bash
export HASURA_URL="http://graphql.mint.local/v1/graphql"
export HASURA_ADMIN_SECRET="<admin-secret>"   # from cluster: kubectl get secret -n mint mint-hasura -o jsonpath='{.data.admin-secret}' | base64 -d
export THREAD_ID="<thread-uuid>"
export THREAD_MODEL_ID="<thread-model-uuid>"
export EXECUTION_ID="<execution-id>"
```

Helper:

```bash
hq() {
  curl -sS -X POST "$HASURA_URL" \
    -H "Content-Type: application/json" \
    -H "x-hasura-admin-secret: $HASURA_ADMIN_SECRET" \
    -d "$1" | jq .
}
```

### Querying Hasura from inside the cluster

Local DNS often cannot resolve `graphql.mint.local`. From the ensemble-manager pod the admin secret is in env and the in-cluster service is `mint-hasura`. Alpine images ship `wget` (BusyBox), not `curl`.

```bash
POD=$(kubectl get pod -n mint -l app=mint-ensemble-manager -o jsonpath='{.items[0].metadata.name}')

# Stage the query file inside the pod (BusyBox wget cannot post inline JSON).
cat q.json | kubectl exec -i "$POD" -n mint -c head -- sh -c 'cat > /tmp/q.json'

# Run the query (admin secret is already in $HASURA_GRAPHQL_ADMIN_SECRET env).
kubectl exec "$POD" -n mint -c head -- sh -c '
  wget -qO- \
    --header="x-hasura-admin-secret: $HASURA_GRAPHQL_ADMIN_SECRET" \
    --header="Content-Type: application/json" \
    --post-file=/tmp/q.json \
    http://mint-hasura/v1/graphql'
```

## Q1: Execution row state

Confirms whether `handleSingleExecutionFailure` wrote `status=FAILURE` and `runid` (set by `updateExecutionRunId` before subscribe failed).

```bash
hq '{
  "query": "query($id: String!) { execution_by_pk(id: $id) { id status run_progress runid start_time end_time execution_engine } }",
  "variables": { "id": "'"$EXECUTION_ID"'" }
}'
```

Expected after subscribe-500 + recovery: `status=FAILURE`, `run_progress=0`, `runid` populated with Tapis UUID.

## Q2: Junction row (the suspect)

Confirms whether `thread_model_execution` linking the execution to the thread_model still exists. If empty, UI cannot fetch the execution and renders the spinner placeholder.

```bash
hq '{
  "query": "query($tmid: uuid!) { thread_model_execution(where: { thread_model_id: { _eq: $tmid } }) { thread_model_id execution_id execution { id status run_progress } } }",
  "variables": { "tmid": "'"$THREAD_MODEL_ID"'" }
}'
```

Empty array = junction was deleted by `handle_failed_connection_ensemble.graphql:11`.

## Q3: Summary counts

Confirms `failed_runs`/`submitted_runs` reflect the failure. UI text ("1 failed") reads from this — works even when the table body shows the spinner.

```bash
hq '{
  "query": "query($tmid: uuid!) { thread_model_execution_summary(where: { thread_model_id: { _eq: $tmid } }) { thread_model_id total_runs submitted_runs failed_runs successful_runs submission_time } }",
  "variables": { "tmid": "'"$THREAD_MODEL_ID"'" }
}'
```

## Q4: Reproduce the UI fetch

Same query the UI runs (`executions_for_thread_model`). If this returns `[]` while Q1 returns a FAILURE row, the gap is confirmed.

```bash
hq '{
  "query": "query($tmid: uuid!) { execution(where: { thread_model_executions: { thread_model_id: { _eq: $tmid } } }, order_by: { start_time: desc }) { id status run_progress runid } }",
  "variables": { "tmid": "'"$THREAD_MODEL_ID"'" }
}'
```

## Q5: Recent provenance events

`handleSubmissionFailure` writes a `thread_provenance` row with `notes="All jobs failed to submit"`. Useful for confirming the failure handler ran.

```bash
hq '{
  "query": "query($tid: String!) { thread_provenance(where: { thread_id: { _eq: $tid } }, order_by: { timestamp: desc }, limit: 5) { event userid timestamp notes } }",
  "variables": { "tid": "'"$THREAD_ID"'" }
}'
```

## Reproduce the submission

```bash
TOKEN="<keycloak-access-token>"
ENSEMBLE_MGR="http://localhost:3000"   # or cluster URL

curl -sS -X POST "$ENSEMBLE_MGR/v1/executionEngines/tapis" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"thread_id\":\"$THREAD_ID\",\"model_id\":\"<model-id>\"}" -i
```

Then re-run Q1-Q4. Expected divergence: Q1 shows FAILURE, Q4 returns `[]`.

## Recovery for stale stuck threads

If a thread is stuck because it failed BEFORE `aa15d063` shipped, re-submitting will not heal it (`prepareModelExecutions` wipes the junction first). Two recovery paths:

### Option A — reinsert junction for an existing FAILURE row

UI then renders the red FAILURE bar without a fresh submission.

```bash
hq '{
  "query": "mutation($tmid: uuid!, $eid: String!) { insert_thread_model_execution_one(object: { thread_model_id: $tmid, execution_id: $eid }) { thread_model_id execution_id } }",
  "variables": { "tmid": "'"$THREAD_MODEL_ID"'", "eid": "'"$EXECUTION_ID"'" }
}'
```

### Option B — full reset of a thread_model so the user can re-submit cleanly

Deletes orphan executions + their bindings + summary. After this, the user clicks Run again on a clean state with the new image.

```bash
hq '{
  "query": "mutation($tmid: uuid!, $ids: [uuid!]!) { delete_thread_model_execution_summary(where: {thread_model_id: {_eq: $tmid}}) { affected_rows } delete_execution_result(where: {execution_id: {_in: $ids}}) { affected_rows } delete_execution_data_binding(where: {execution_id: {_in: $ids}}) { affected_rows } delete_execution_parameter_binding(where: {execution_id: {_in: $ids}}) { affected_rows } delete_execution(where: {id: {_in: $ids}}) { affected_rows } }",
  "variables": { "tmid": "'"$THREAD_MODEL_ID"'", "ids": ["<orphan-exec-1>", "<orphan-exec-2>"] }
}'
```

Find the orphan execution IDs first: any `execution` row whose `modelid` matches the thread_model's `modelcatalog_configuration_id` and whose `thread_model_executions` array is empty.

## Triage flowchart

1. **UI shows "Downloading software image and data..." spinner.**
2. Run **Q1** — does the execution row have `status=FAILURE`?
   - No → real RUNNING/WAITING state, not the spinner bug. Check Tapis job status (Q5 + tapis API).
   - Yes → continue.
3. Run **Q2** — does the junction have a row for that execution?
   - Yes → UI cache stale. Reload browser.
   - No → junction was deleted. Continue.
4. Verify the fix is deployed: `kubectl exec <pod> -- cat /home/node/app/src/classes/graphql/queries/execution/handle-failed-connection-ensemble.graphql`. The mutation should NOT contain `delete_thread_model_execution`.
   - Missing fix → bump image to >= `aa15d063`.
   - Fix present → check **Q5** for repeated SYSTEM `UPDATE` events with notes `"All jobs failed to submit"`. Multiple failures across attempts mean the user re-tried before fix; orphans accumulated. Use Recovery Option B.
5. If the thread is fresh (no prior failures) and the fix is deployed but the junction is still empty after a failed submission, log a new bug — something OTHER than `handle_failed_connection_ensemble` is wiping the junction. Likely candidates: the UI fired `update_thread_model` or `update_thread_data` between submit and your query (see audit list above).
