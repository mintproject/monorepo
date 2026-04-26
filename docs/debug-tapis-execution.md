# Debug Tapis Execution State

Helper queries for diagnosing stuck-on-spinner symptoms after Tapis submission failures.

## Symptom

UI stuck on "Downloading software image and data..." after `POST /v1/executionEngines/tapis` returns 500. Cause: `handle_failed_connection_ensemble` deletes the `thread_model_execution` junction. UI's `executions_for_thread_model` query joins through that junction and returns 0 rows even when the execution row is marked `FAILURE`.

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

## Recovery (manual, until fix shipped)

If a thread is stuck and the user wants the failed run to render, re-insert the junction:

```bash
hq '{
  "query": "mutation($tmid: uuid!, $eid: String!) { insert_thread_model_execution_one(object: { thread_model_id: $tmid, execution_id: $eid }) { thread_model_id execution_id } }",
  "variables": { "tmid": "'"$THREAD_MODEL_ID"'", "eid": "'"$EXECUTION_ID"'" }
}'
```

Reload UI — execution should now render with the FAILURE bar.
