# Production: DYNAMO Migration Runbook

Apply migrations 1771200012000–1771200014000 + ETL backfill against production Hasura DB.

**Scope**: production cluster. Non-destructive (no PVC delete, no DB restore). Assumes prod DB already at migration `1771200011000` (junction-merge complete).

**Prerequisites**:
- `kubectl` context = TACC production cluster
- `hasura` CLI installed
- Python 3 with ETL deps (`etl/requirements.txt`)
- Maintenance window: API write traffic paused (FK swap on `thread_model` / `execution`)

---

## Recommended: use the runner script

`scripts/run-migration-prod.sh` automates every step below with a mandatory operator pause between each one. Use it instead of running the bash blocks by hand.

```bash
# full interactive run (prompts at each gate)
./scripts/run-migration-prod.sh

# resume mid-run after fixing a failure (e.g. start at Step 6)
./scripts/run-migration-prod.sh --start-from 6

# dry-run: echo destructive commands without executing
./scripts/run-migration-prod.sh --dry-run --yes
```

Flags: `--start-from N`, `--dry-run`, `--yes` (skip pauses — replay only), `--namespace NS`, `--trig-url URL`. Script prints current kubectl context first and waits for confirmation before any destructive op. Backup written to `backups/prod-backup-<timestamp>.sql`; TriG fetched to `model-catalog-endpoint/data/dynamo-<date>.trig`.

The numbered steps below are the manual fallback and the source of truth for what the script executes.

---

## Step 1: Pre-flight backup

```bash
NAMESPACE=mint
TS=$(date +%Y%m%d-%H%M%S)

# Full DB dump (schema + data) — required rollback artifact
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- \
  pg_dump -U hasura -d hasura --no-owner --no-acl \
  > prod-backup-${TS}.sql

ls -lh prod-backup-${TS}.sql   # verify non-zero
```

Store dump off-cluster before proceeding.

## Step 2: Verify starting state

```bash
POD=$(kubectl get pod -n $NAMESPACE -l app=mint-hasura -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura migrate status --skip-update-check" \
  | tail -20
```

Expect `1771200011000` = `Present Applied`. Migrations `1771200012000`–`1771200014000` = `Present Not Applied`.

If `1771200011000` not applied: STOP. Production not at expected baseline.

## Step 3: Pause writers

Stop services that write to `thread_model` / `execution` during FK swap:

```bash
kubectl scale deployment mint-ensemble-manager -n $NAMESPACE --replicas=0
kubectl scale deployment mint-ui -n $NAMESPACE --replicas=0
# Hasura stays UP for migrations + reads
```

## Step 4: Validate vetted TriG snapshot

Prod uses the pre-vetted snapshot at `backups/dynamo-2025-04-08-v2.trig`. md5 is pinned — same bytes as the local dry-run. Do NOT swap in a fresh download mid-window without a new round of local testing.

```bash
TRIG_PATH=backups/dynamo-2025-04-08-v2.trig
EXPECTED_MD5=d20aae3db73111e6c1b7bcf7ae812e89

ls -lh "$TRIG_PATH"   # ~24M

# Linux: md5sum; macOS: md5 -q
GOT_MD5=$(md5sum "$TRIG_PATH" 2>/dev/null | awk '{print $1}' || md5 -q "$TRIG_PATH")
[[ "$GOT_MD5" == "$EXPECTED_MD5" ]] || { echo "md5 mismatch: $GOT_MD5"; exit 1; }
echo "md5 OK"
```

If you must roll forward to a newer dump, re-run the local test recipe (`docs/migration-testing.md`) against the new file first, then update the pinned md5 here.

## Step 5: Run ETL against production

Populates `modelcatalog_configuration` rows that migration `1771200012000` FK-references.

```bash
# Get hasura DB password from secret
HASURA_PWD=$(kubectl get secret -n $NAMESPACE mint-hasura-secrets \
  -o jsonpath='{.data.password}' | base64 -d)

# Port-forward in background
kubectl port-forward -n $NAMESPACE svc/mint-hasura-db 5432:5432 &
PF_PID=$!
sleep 3

# Run ETL with prod credentials (use vetted trig validated in Step 4)
DB_NAME=hasura DB_USER=hasura DB_PASSWORD="$HASURA_PWD" \
  python3 etl/run.py \
  --trig-path backups/dynamo-2025-04-08-v2.trig

kill $PF_PID
```

**Do NOT pass `--clear` in production.** Truncates modelcatalog tables. ETL is idempotent (`ON CONFLICT DO NOTHING`); rerun is safe without clear.

Verify row count:
```bash
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura \
  -c "SELECT count(*) FROM modelcatalog_configuration;"
```
Expect non-zero (matches local-test count from two weeks ago).

## Step 6: Apply migrations 1771200012000–1771200014000

```bash
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura migrate apply --skip-update-check"
```

Migrations applied:
- `1771200012000` — backfill `thread_model.modelcatalog_configuration_id` + `execution.modelcatalog_configuration_id`, swap FK constraints, drop `public.model`
- `1771200013000` — drop `execution.model_id`
- `1771200014000` — repoint `execution_data_binding` / `execution_result` FK to `modelcatalog_dataset_specification`

**On failure**: see Rollback below. Backfill in `1771200012000` raises if any `thread_model` / `execution` row references a configuration not present in `modelcatalog_configuration`. Re-run ETL (Step 5) to populate, then retry.

## Step 7: Apply metadata + reload

```bash
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura metadata apply --skip-update-check && \
   hasura metadata reload --skip-update-check"
```

Metadata HEAD includes commit `6cb9eb2` (stale `model_io` relationships removed, invalid backfill values cleaned). Apply will fail loudly on inconsistent metadata — do not ignore.

## Step 8: Verify

```bash
# All migrations applied
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura migrate status --skip-update-check" | tail -10

# execution.model_id dropped
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura \
  -c "\d execution" | grep -c model_id
# Expect: 0 (only modelcatalog_configuration_id remains)

# FK present on thread_model
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura \
  -c "\d thread_model" | grep modelcatalog_configuration

# public.model dropped
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura \
  -c "\dt public.model" 2>&1 | grep -i "did not find"

# Hasura inconsistent metadata = empty
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura metadata inconsistency list --skip-update-check"
```

Smoke-test GraphQL:
```bash
kubectl port-forward -n $NAMESPACE svc/mint-hasura 8080:8080 &
curl -s -X POST http://localhost:8080/v1/graphql \
  -H "x-hasura-admin-secret: $ADMIN_SECRET" \
  -d '{"query":"{ thread_model(limit:1){ id modelcatalog_configuration_id } }"}'
```

## Step 9: Resume writers

```bash
kubectl scale deployment mint-ensemble-manager -n $NAMESPACE --replicas=1
kubectl scale deployment mint-ui -n $NAMESPACE --replicas=1
kubectl rollout status deployment/mint-ensemble-manager -n $NAMESPACE
kubectl rollout status deployment/mint-ui -n $NAMESPACE
```

Watch logs ~5 min for FK violations / GraphQL errors:
```bash
kubectl logs -n $NAMESPACE -l app=mint-ensemble-manager --tail=100 -f
```

---

## Rollback

If Step 6 or 7 fails and forward-fix not viable:

```bash
# 1. Scale Hasura down (release DB connections)
kubectl scale deployment mint-hasura -n $NAMESPACE --replicas=0

# 2. Restore from Step 1 backup
cat prod-backup-${TS}.sql | \
  kubectl exec -i -n $NAMESPACE mint-hasura-db-0 -- \
  psql -U hasura -d hasura

# 3. Scale Hasura back up
kubectl scale deployment mint-hasura -n $NAMESPACE --replicas=1
kubectl rollout status deployment/mint-hasura -n $NAMESPACE

# 4. Resume writers (Step 9)
```

Each migration wraps in `BEGIN/COMMIT`, so partial-state rollback within a single migration not needed — failure aborts that migration cleanly. Backup restore covers cross-migration rollback.

---

## Notes

- **Local test recipe** (destructive PVC reset): `docs/migration-testing.md`. Do not run against production.
- **ETL idempotency**: rerun without `--clear` is safe. `ON CONFLICT DO NOTHING` everywhere.
- **API compat**: `model-catalog-api` v2.0.0 reads from new tables, `mint-ensemble-manager` HEAD already uses `modelcatalog_configuration_id` (commits 304729b, f18afe4). UI submodule HEAD must match — verify before window.
