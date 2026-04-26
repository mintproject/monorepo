#!/bin/bash
set -euo pipefail

# run-migration-prod.sh
# Automates docs/migration-production.md against the TACC production cluster.
# Mandatory pause between every step — operator confirms each gate before
# advancing. Designed for re-entry: --start-from N skips earlier steps.
#
# Usage:
#   ./scripts/run-migration-prod.sh [--start-from N] [--dry-run] [--yes]
#                                   [--namespace mint] [--trig-url URL]
#
# Flags:
#   --start-from N   Resume at step N (1..9). Default 1.
#   --dry-run        Echo destructive commands; do not execute.
#   --yes            Skip pauses (DANGEROUS — only for replays of a verified run).
#   --namespace NS   k8s namespace (default: mint).
#   --trig-url URL   Override Fuseki dump URL.
#
# Pre-reqs: kubectl context = TACC prod, hasura CLI, python3 + etl/requirements.txt,
# maintenance window arranged (writers will be scaled to 0 in Step 3).

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- defaults ---------------------------------------------------------------
NAMESPACE="mint"
START_FROM=1
DRY_RUN=0
ASSUME_YES=0
TRIG_URL="https://endpoint.models.mint.tacc.utexas.edu/modelcatalog/data"
TRIG_DATE="$(date +%Y-%m-%d)"
TS="$(date +%Y%m%d-%H%M%S)"
PRE_ETL_MIGRATION="1771200011000"

TRIG_PATH="$REPO_ROOT/model-catalog-endpoint/data/dynamo-${TRIG_DATE}.trig"
BACKUP_PATH="$REPO_ROOT/backups/prod-backup-${TS}.sql"

# ---- arg parse --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-from) START_FROM="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=1; shift ;;
    --yes)        ASSUME_YES=1; shift ;;
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    --trig-url)   TRIG_URL="$2"; shift 2 ;;
    -h|--help)    sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# ---- helpers ----------------------------------------------------------------
log()  { echo -e "\n=== $* ==="; }
fail() { echo "ERROR: $*" >&2; exit 1; }
run()  {
  if [[ $DRY_RUN -eq 1 ]]; then echo "DRY: $*"; else eval "$@"; fi
}
pause() {
  local msg="$1"
  if [[ $ASSUME_YES -eq 1 ]]; then
    echo ">>> [auto-yes] $msg"
    return
  fi
  read -rp $'\n>>> '"$msg"$'\n>>> Enter to continue, Ctrl-C to abort: ' _
}
should_run() {
  local n="$1"
  [[ $START_FROM -le $n ]]
}
ctx_check() {
  local ctx
  ctx="$(kubectl config current-context 2>/dev/null || echo unknown)"
  echo "current kubectl context: $ctx"
  pause "confirm context = TACC PRODUCTION cluster"
}

# ---- preflight --------------------------------------------------------------
command -v kubectl >/dev/null || fail "kubectl not in PATH"
command -v python3 >/dev/null || fail "python3 not in PATH"
command -v wget    >/dev/null || fail "wget not in PATH"

log "Inputs"
echo "Namespace:    $NAMESPACE"
echo "Start from:   step $START_FROM"
echo "Dry-run:      $DRY_RUN"
echo "Trig URL:     $TRIG_URL"
echo "Trig path:    $TRIG_PATH"
echo "Backup path:  $BACKUP_PATH"

ctx_check

# Resolve hasura pod once (used Steps 2, 6, 7, 8)
HASURA_POD="$(kubectl get pod -n "$NAMESPACE" -l app=mint-hasura \
              -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
[[ -n "$HASURA_POD" ]] || echo "warn: hasura pod not yet resolved"

# ---------------------------------------------------------------------------
# Step 1: Pre-flight backup
# ---------------------------------------------------------------------------
if should_run 1; then
  log "Step 1: Pre-flight backup -> $BACKUP_PATH"
  mkdir -p "$REPO_ROOT/backups"
  run "kubectl exec -n $NAMESPACE mint-hasura-db-0 -- \
        pg_dump -U hasura -d hasura --no-owner --no-acl \
        > '$BACKUP_PATH'"
  run "ls -lh '$BACKUP_PATH'"
  pause "verify backup file size non-zero AND copy off-cluster"
fi

# ---------------------------------------------------------------------------
# Step 2: Verify starting state
# ---------------------------------------------------------------------------
if should_run 2; then
  log "Step 2: Verify migration baseline ($PRE_ETL_MIGRATION applied)"
  [[ -n "$HASURA_POD" ]] || fail "hasura pod not found"
  run "kubectl exec -n $NAMESPACE $HASURA_POD -- bash -c \
        'cd /hasura && hasura migrate status --skip-update-check' | tail -20"
  pause "confirm $PRE_ETL_MIGRATION = Present Applied; 12000-14000 = Present Not Applied"
fi

# ---------------------------------------------------------------------------
# Step 3: Pause writers
# ---------------------------------------------------------------------------
if should_run 3; then
  log "Step 3: Scale ensemble-manager + ui to 0"
  run "kubectl scale deployment mint-ensemble-manager -n $NAMESPACE --replicas=0"
  run "kubectl scale deployment mint-ui -n $NAMESPACE --replicas=0"
  run "kubectl get deploy -n $NAMESPACE mint-ensemble-manager mint-ui"
  pause "confirm both deployments at 0/0 ready"
fi

# ---------------------------------------------------------------------------
# Step 4: Fetch latest TriG
# ---------------------------------------------------------------------------
if should_run 4; then
  log "Step 4: Fetch latest TriG snapshot"
  mkdir -p "$(dirname "$TRIG_PATH")"
  run "wget -c '$TRIG_URL' -O '$TRIG_PATH'"
  run "ls -lh '$TRIG_PATH'"
  pause "confirm trig size ~24M"
fi

# ---------------------------------------------------------------------------
# Step 5: Run ETL
# ---------------------------------------------------------------------------
if should_run 5; then
  log "Step 5: ETL pipeline (no --clear in prod)"
  [[ -f "$TRIG_PATH" ]] || fail "trig missing: $TRIG_PATH"

  HASURA_PWD="$(kubectl get secret -n "$NAMESPACE" mint-hasura-secrets \
                 -o jsonpath='{.data.password}' | base64 -d)"
  [[ -n "$HASURA_PWD" ]] || fail "could not read hasura DB password"

  kubectl port-forward -n "$NAMESPACE" svc/mint-hasura-db 5432:5432 \
    >/dev/null 2>&1 &
  PF_PID=$!
  trap "kill $PF_PID 2>/dev/null || true" EXIT

  for i in {1..15}; do
    if nc -z localhost 5432 2>/dev/null; then break; fi
    sleep 1
    [[ $i -eq 15 ]] && fail "port-forward not ready"
  done

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "DRY: DB_PASSWORD=*** python3 etl/run.py --trig-path $TRIG_PATH"
  else
    DB_NAME=hasura DB_USER=hasura DB_PASSWORD="$HASURA_PWD" \
      python3 "$REPO_ROOT/etl/run.py" --trig-path "$TRIG_PATH"
  fi

  kill $PF_PID 2>/dev/null || true
  trap - EXIT

  run "kubectl exec -n $NAMESPACE mint-hasura-db-0 -- \
        psql -U hasura -d hasura \
        -c 'SELECT count(*) FROM modelcatalog_configuration;'"
  pause "confirm modelcatalog_configuration count is non-zero"
fi

# ---------------------------------------------------------------------------
# Step 6: Apply migrations 1771200012000–1771200014000
# ---------------------------------------------------------------------------
if should_run 6; then
  log "Step 6: Apply migrations 12000-14000"
  [[ -n "$HASURA_POD" ]] || fail "hasura pod not found"
  run "kubectl exec -n $NAMESPACE $HASURA_POD -- bash -c \
        'cd /hasura && hasura migrate apply --skip-update-check'"
  pause "confirm migrate apply completed without error"
fi

# ---------------------------------------------------------------------------
# Step 7: Metadata apply + reload
# ---------------------------------------------------------------------------
if should_run 7; then
  log "Step 7: Hasura metadata apply + reload"
  run "kubectl exec -n $NAMESPACE $HASURA_POD -- bash -c \
        'cd /hasura && hasura metadata apply --skip-update-check && \
         hasura metadata reload --skip-update-check'"
  run "kubectl exec -n $NAMESPACE $HASURA_POD -- bash -c \
        'cd /hasura && hasura metadata inconsistency list --skip-update-check'"
  pause "confirm inconsistency list is empty"
fi

# ---------------------------------------------------------------------------
# Step 8: Verify
# ---------------------------------------------------------------------------
if should_run 8; then
  log "Step 8: Verify schema"
  run "kubectl exec -n $NAMESPACE $HASURA_POD -- bash -c \
        'cd /hasura && hasura migrate status --skip-update-check' | tail -10"
  echo "execution.model_id (expect 0):"
  run "kubectl exec -n $NAMESPACE mint-hasura-db-0 -- \
        psql -U hasura -d hasura -c '\\d execution' | grep -c model_id || true"
  echo "thread_model FK to modelcatalog_configuration:"
  run "kubectl exec -n $NAMESPACE mint-hasura-db-0 -- \
        psql -U hasura -d hasura -c '\\d thread_model' | grep modelcatalog_configuration || true"
  echo "public.model dropped:"
  run "kubectl exec -n $NAMESPACE mint-hasura-db-0 -- \
        psql -U hasura -d hasura -c '\\dt public.model' 2>&1 | grep -i 'did not find' || true"
  pause "confirm: model_id=0, thread_model FK present, public.model dropped"
fi

# ---------------------------------------------------------------------------
# Step 9: Resume writers
# ---------------------------------------------------------------------------
if should_run 9; then
  log "Step 9: Scale writers back up"
  run "kubectl scale deployment mint-ensemble-manager -n $NAMESPACE --replicas=1"
  run "kubectl scale deployment mint-ui -n $NAMESPACE --replicas=1"
  run "kubectl rollout status deployment/mint-ensemble-manager -n $NAMESPACE --timeout=180s"
  run "kubectl rollout status deployment/mint-ui -n $NAMESPACE --timeout=180s"
  echo "tailing ensemble-manager logs (Ctrl-C when satisfied):"
  if [[ $DRY_RUN -eq 0 && $ASSUME_YES -eq 0 ]]; then
    kubectl logs -n "$NAMESPACE" -l app=mint-ensemble-manager --tail=50 -f || true
  fi
fi

log "Migration script complete"
echo "Backup retained at: $BACKUP_PATH"
echo "Rollback: see docs/migration-production.md (Rollback section)"
