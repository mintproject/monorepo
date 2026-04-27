#!/bin/bash
set -euo pipefail

# test-migration-devel.sh
# Devel-environment variant of test-migration-local.sh.
# Restores prod backup, applies migrations in two passes
# (schema -> ETL -> FK backfill), then applies metadata.
#
# Usage:
#   ./scripts/test-migration-devel.sh [trig-path] [sql-backup-path] [namespace]
#
# Defaults:
#   trig-path        /Users/mosorio/repos/mint/backups/dynamo-2025-04-08.trig
#   sql-backup-path  backups/production-backup.sql (relative to repo root)
#   namespace        mint

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRIG_PATH="${1:-/Users/mosorio/repos/mint/backups/dynamo-2025-04-08.trig}"
SQL_BACKUP="${2:-backups/production-backup.sql}"
NAMESPACE="${3:-mint}"

# Devel helm chart location (run from this dir for `helm upgrade mint .`)
HELM_CHART_DIR="/home/mint/tacc-values/shared"

# Resolve SQL backup relative to repo root if not absolute
if [[ "$SQL_BACKUP" != /* ]]; then
  SQL_BACKUP="$REPO_ROOT/$SQL_BACKUP"
fi

# Stop at this migration before ETL (FK constraints depend on populated tables)
PRE_ETL_MIGRATION="1771200011000"

log() { echo -e "\n=== $* ==="; }
fail() { echo "ERROR: $*" >&2; exit 1; }

# Validate inputs
[[ -f "$TRIG_PATH" ]]   || fail "TriG file not found: $TRIG_PATH"
[[ -f "$SQL_BACKUP" ]]  || fail "SQL backup not found: $SQL_BACKUP"
[[ -d "$HELM_CHART_DIR" ]] || fail "Helm chart dir not found: $HELM_CHART_DIR"
command -v kubectl >/dev/null || fail "kubectl not in PATH"
command -v helm    >/dev/null || fail "helm not in PATH"
command -v python3 >/dev/null || fail "python3 not in PATH"

log "Inputs"
echo "Repo root:    $REPO_ROOT"
echo "TriG:         $TRIG_PATH"
echo "SQL backup:   $SQL_BACKUP"
echo "Namespace:    $NAMESPACE"
echo "Helm chart:   $HELM_CHART_DIR"

# ---------------------------------------------------------------------------
# Step 2: Reset devel Hasura DB
# ---------------------------------------------------------------------------
log "Step 2: Reset devel Hasura DB"

kubectl patch deployment mint-hasura -n "$NAMESPACE" --type=merge -p '{"spec":{"replicas":0}}'
kubectl delete statefulset mint-hasura-db -n "$NAMESPACE" --ignore-not-found
kubectl delete pvc data-mint-hasura-db-0 -n "$NAMESPACE" --ignore-not-found

(cd "$HELM_CHART_DIR" && helm upgrade mint . -f values.yaml -f secrets.yaml)

kubectl rollout status statefulset/mint-hasura-db -n "$NAMESPACE" --timeout=180s

# Wait for postgres to accept connections
log "Wait for postgres ready"
for i in {1..30}; do
  if kubectl exec -n "$NAMESPACE" mint-hasura-db-0 -- \
       pg_isready -U hasura -d hasura >/dev/null 2>&1; then
    echo "postgres ready"
    break
  fi
  sleep 2
  [[ $i -eq 30 ]] && fail "postgres not ready after 60s"
done

# ---------------------------------------------------------------------------
# Step 3: Restore prod backup
# ---------------------------------------------------------------------------
log "Step 3: Restore prod backup ($SQL_BACKUP)"
kubectl exec -i -n "$NAMESPACE" mint-hasura-db-0 -- \
  psql -U hasura -d hasura < "$SQL_BACKUP"

# ---------------------------------------------------------------------------
# Step 4: Apply migrations through PRE_ETL_MIGRATION
# ---------------------------------------------------------------------------
log "Step 4: Bring hasura up + apply migrations to $PRE_ETL_MIGRATION"
kubectl patch deployment mint-hasura -n "$NAMESPACE" --type=merge -p '{"spec":{"replicas":1}}'
kubectl rollout status deployment/mint-hasura -n "$NAMESPACE" --timeout=180s

POD="$(kubectl get pod -n "$NAMESPACE" -l app=mint-hasura \
        -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$POD" ]] || fail "hasura pod not found"
echo "hasura pod: $POD"

kubectl exec -n "$NAMESPACE" "$POD" -- bash -c \
  "cd /hasura && hasura migrate apply --goto $PRE_ETL_MIGRATION --skip-update-check"

# ---------------------------------------------------------------------------
# Step 5: Run ETL
# ---------------------------------------------------------------------------
log "Step 5: ETL pipeline"

HASURA_PWD="$(kubectl get secret -n "$NAMESPACE" mint-hasura-secrets \
  -o jsonpath='{.data.password}' | base64 -d)"

kubectl port-forward -n "$NAMESPACE" svc/mint-hasura-db 5432:5432 \
  >/dev/null 2>&1 &
PF_PID=$!
trap "kill $PF_PID 2>/dev/null || true" EXIT

# Wait for port-forward
for i in {1..15}; do
  if nc -z localhost 5432 2>/dev/null; then break; fi
  sleep 1
  [[ $i -eq 15 ]] && fail "port-forward not ready"
done

DB_NAME=hasura DB_USER=hasura DB_PASSWORD="$HASURA_PWD" \
  python3 "$REPO_ROOT/etl/run.py" --trig-path "$TRIG_PATH" --clear

kill $PF_PID 2>/dev/null || true
trap - EXIT

# ---------------------------------------------------------------------------
# Step 6: Apply remaining migrations + metadata
# ---------------------------------------------------------------------------
log "Step 6: Remaining migrations (FK backfill + Phase 10) + metadata"

kubectl exec -n "$NAMESPACE" "$POD" -- bash -c \
  "cd /hasura && hasura migrate apply --skip-update-check"

kubectl exec -n "$NAMESPACE" "$POD" -- bash -c \
  "cd /hasura && hasura metadata apply --skip-update-check && \
   hasura metadata reload --skip-update-check"

# ---------------------------------------------------------------------------
# Step 7: Verify
# ---------------------------------------------------------------------------
log "Step 7: Verify"

kubectl exec -n "$NAMESPACE" "$POD" -- bash -c \
  "cd /hasura && hasura migrate status --skip-update-check"

echo ""
echo "modelcatalog_configuration row count:"
kubectl exec -n "$NAMESPACE" mint-hasura-db-0 -- \
  psql -U hasura -d hasura -c "SELECT count(*) FROM modelcatalog_configuration;"

echo ""
echo "execution.model_id should be empty (column dropped):"
kubectl exec -n "$NAMESPACE" mint-hasura-db-0 -- \
  psql -U hasura -d hasura -c "\d execution" | grep model_id || \
  echo "  (no model_id column — OK)"

log "Done"
