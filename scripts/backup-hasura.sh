#!/bin/bash
set -euo pipefail

# backup-hasura.sh
# Non-interactive backup of the MINT Hasura stack. Safe to run from cron.
#
# Produces, per run, in --out-dir:
#   hasura-db-<TS>.sql.gz         full pg_dump (schema + data)
#   hasura-metadata-<TS>.json     Hasura metadata export (best effort)
#   latest-db.sql.gz              symlink to the newest dump
#
# Usage:
#   ./scripts/backup-hasura.sh [--out-dir DIR] [--namespace NS] [--keep-days N]
#                              [--db-pod POD] [--db-user USER] [--db-name NAME]
#                              [--no-metadata] [--retries N] [--retry-delay S]
#                              [--websockets] [--log-file FILE] [--dry-run]
#
# Flags:
#   --out-dir DIR    Where dumps land (default: /var/backups/mint-hasura).
#   --namespace NS   k8s namespace (default: mint).
#   --keep-days N    Delete backups older than N days (default: 14; 0 = never).
#   --db-pod POD     Postgres pod (default: mint-hasura-db-0).
#   --db-user USER   Postgres role (default: hasura).
#   --db-name NAME   Database (default: hasura).
#   --no-metadata    Skip the Hasura metadata export.
#   --retries N      Dump attempts before giving up (default: 3).
#   --retry-delay S  Seconds between attempts (default: 15).
#   --websockets     Use kubectl's WebSocket exec protocol (default: SPDY, which
#                    survives long streams better on resets).
#   --log-file FILE  Append all output to FILE as well as stdout.
#   --dry-run        Print the commands; write nothing.
#
# Exit codes: 0 ok, 1 error, 2 bad args, 3 another run holds the lock.
#
# Restore (manual, never automated):
#   gunzip -c hasura-db-<TS>.sql.gz | \
#     kubectl exec -i -n mint mint-hasura-db-0 -- psql -U hasura -d hasura
#   cd graphql_engine && hasura metadata apply && hasura metadata reload
# Check for idle-in-transaction lock holders first — TACC Postgres has no
# idle_in_transaction_session_timeout, so a stale session will block the restore.

# ---- defaults ---------------------------------------------------------------
NAMESPACE="mint"
OUT_DIR="/var/backups/mint-hasura"
KEEP_DAYS=14
DB_POD="mint-hasura-db-0"
DB_USER="hasura"
DB_NAME="hasura"
DO_METADATA=1
LOG_FILE=""
DRY_RUN=0
RETRIES=3
RETRY_DELAY=15
WEBSOCKETS=0
TS="$(date +%Y%m%d-%H%M%S)"

# ---- arg parse --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)     OUT_DIR="$2"; shift 2 ;;
    --namespace)   NAMESPACE="$2"; shift 2 ;;
    --keep-days)   KEEP_DAYS="$2"; shift 2 ;;
    --db-pod)      DB_POD="$2"; shift 2 ;;
    --db-user)     DB_USER="$2"; shift 2 ;;
    --db-name)     DB_NAME="$2"; shift 2 ;;
    --no-metadata) DO_METADATA=0; shift ;;
    --retries)     RETRIES="$2"; shift 2 ;;
    --retry-delay) RETRY_DELAY="$2"; shift 2 ;;
    --websockets)  WEBSOCKETS=1; shift ;;
    --log-file)    LOG_FILE="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     sed -n '1,40p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] || { echo "--keep-days must be an integer" >&2; exit 2; }
[[ "$RETRIES" =~ ^[1-9][0-9]*$ ]] || { echo "--retries must be >= 1" >&2; exit 2; }

# kubectl 1.30+ speaks a WebSocket exec protocol that some ingress paths reset
# mid-stream ("next reader: ... read: connection reset by peer"). The older SPDY
# path survives long streams more often, so prefer it. --websockets opts back in.
if [[ $WEBSOCKETS -eq 0 ]]; then
  export KUBECTL_REMOTE_COMMAND_WEBSOCKETS=false
fi

# ---- logging ----------------------------------------------------------------
if [[ -n "$LOG_FILE" ]]; then
  mkdir -p "$(dirname "$LOG_FILE")"
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

log()  { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }
warn() { log "WARN: $*"; }
fail() { log "ERROR: $*"; exit 1; }

# ---- preflight --------------------------------------------------------------
command -v kubectl >/dev/null || fail "kubectl not in PATH (PATH=$PATH)"
command -v gzip    >/dev/null || fail "gzip not in PATH"

log "namespace=$NAMESPACE out-dir=$OUT_DIR keep-days=$KEEP_DAYS dry-run=$DRY_RUN"
log "kubectl context: $(kubectl config current-context 2>/dev/null || echo unknown)"

if [[ $DRY_RUN -eq 1 ]]; then
  log "DRY: mkdir -p $OUT_DIR"
  log "DRY: kubectl exec -n $NAMESPACE $DB_POD -- bash -c 'pg_dump -U $DB_USER -d $DB_NAME --no-owner --no-acl | gzip -9' > $OUT_DIR/hasura-db-$TS.sql.gz"
  log "DRY: up to $RETRIES attempt(s), ${RETRY_DELAY}s apart; KUBECTL_REMOTE_COMMAND_WEBSOCKETS=${KUBECTL_REMOTE_COMMAND_WEBSOCKETS:-default}"
  [[ $DO_METADATA -eq 1 ]] && log "DRY: export hasura metadata -> $OUT_DIR/hasura-metadata-$TS.json"
  [[ "$KEEP_DAYS" -gt 0 ]] && log "DRY: find $OUT_DIR -name 'hasura-*' -mtime +$KEEP_DAYS -delete"
  exit 0
fi

mkdir -p "$OUT_DIR" || fail "cannot create $OUT_DIR"

# ---- lock -------------------------------------------------------------------
# mkdir is atomic; a leftover lock from a crashed run is reported, not ignored.
LOCK_DIR="$OUT_DIR/.backup.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "another backup holds $LOCK_DIR (started $(cat "$LOCK_DIR/started" 2>/dev/null || echo unknown)); aborting"
  exit 3
fi
echo "$TS pid=$$" > "$LOCK_DIR/started"
trap 'rm -rf "$LOCK_DIR"' EXIT

# ---- resolve pods -----------------------------------------------------------
if ! kubectl get pod -n "$NAMESPACE" "$DB_POD" >/dev/null 2>&1; then
  warn "$DB_POD not found; falling back to label lookup"
  DB_POD="$(kubectl get pod -n "$NAMESPACE" -l app=mint-hasura-db \
            -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  [[ -n "$DB_POD" ]] || fail "no Postgres pod found in namespace $NAMESPACE"
  log "using db pod $DB_POD"
fi

# ---- 1. database dump -------------------------------------------------------
DUMP="$OUT_DIR/hasura-db-$TS.sql.gz"
PART="$DUMP.part"

# Compress INSIDE the pod. The exec connection to the API server is the fragile
# part of this backup: long streams get reset by load balancers and idle
# timeouts. A SQL dump compresses roughly 20-40x, so gzipping in the pod cuts
# both the bytes on the wire and the time the stream must stay open. Gzipping
# client-side (the obvious way) streams the full uncompressed dump instead.
POD_GZIP=1
if ! kubectl exec -n "$NAMESPACE" "$DB_POD" -- sh -c 'command -v gzip >/dev/null' 2>/dev/null; then
  warn "no gzip in $DB_POD; falling back to client-side compression (longer, more fragile stream)"
  POD_GZIP=0
fi

dump_once() {
  if [[ $POD_GZIP -eq 1 ]]; then
    # pipefail so a failing pg_dump is not masked by gzip exiting 0.
    kubectl exec -n "$NAMESPACE" "$DB_POD" -- bash -c \
      "set -o pipefail; pg_dump -U '$DB_USER' -d '$DB_NAME' --no-owner --no-acl | gzip -9" \
      > "$PART"
  else
    kubectl exec -n "$NAMESPACE" "$DB_POD" -- \
      pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
      | gzip -9 > "$PART"
  fi
}

# Prints the rejection reason and returns 1, or returns 0 silently.
verify_dump() {
  [[ -s "$PART" ]]            || { echo "file is empty"; return 1; }
  gzip -t "$PART" 2>/dev/null || { echo "not valid gzip"; return 1; }
  # The check that matters: a dump cut short by a reset connection is still
  # valid gzip and still plausibly sized. Only the marker proves pg_dump ran out.
  gunzip -c "$PART" | tail -5 | grep -q "PostgreSQL database dump complete" \
    || { echo "truncated - no pg_dump completion marker ($(gunzip -c "$PART" | wc -c | tr -d ' ') bytes raw)"; return 1; }
  return 0
}

DUMP_OK=0
ATTEMPT=1
while [[ $ATTEMPT -le $RETRIES ]]; do
  log "dumping $DB_NAME from $DB_POD -> $DUMP (attempt $ATTEMPT/$RETRIES, pod-gzip=$POD_GZIP)"
  rm -f "$PART"

  RC=0
  dump_once || RC=$?

  if [[ $RC -ne 0 ]]; then
    warn "kubectl exec / pg_dump exited $RC"
  elif REASON="$(verify_dump)"; then
    DUMP_OK=1
    break
  else
    warn "dump rejected: $REASON"
  fi

  ATTEMPT=$((ATTEMPT + 1))
  if [[ $ATTEMPT -le $RETRIES ]]; then
    log "retrying in ${RETRY_DELAY}s"
    sleep "$RETRY_DELAY"
  fi
done

if [[ $DUMP_OK -ne 1 ]]; then
  rm -f "$PART"
  fail "dump failed after $RETRIES attempt(s). If the cause is a reset exec stream, raise --retries/--retry-delay, or dump to a file inside the pod and kubectl cp it out (see --help)."
fi

RAW_BYTES=$(gunzip -c "$PART" | wc -c | tr -d ' ')
mv "$PART" "$DUMP"
ln -sfn "$(basename "$DUMP")" "$OUT_DIR/latest-db.sql.gz"
log "database dump ok: $DUMP ($(du -h "$DUMP" | cut -f1) compressed, ${RAW_BYTES} bytes raw)"

# ---- 2. metadata export (best effort) ---------------------------------------
# Metadata is already in git under graphql_engine/metadata/. This export only
# catches drift from console edits, so a failure here must not fail the backup.
if [[ $DO_METADATA -eq 1 ]]; then
  META="$OUT_DIR/hasura-metadata-$TS.json"
  HASURA_POD="$(kubectl get pod -n "$NAMESPACE" -l app=mint-hasura \
                -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"

  if [[ -z "$HASURA_POD" ]]; then
    warn "no Hasura pod found; skipping metadata export"
  elif kubectl exec -n "$NAMESPACE" "$HASURA_POD" -- bash -c \
         "cd /hasura && hasura metadata export -o json --skip-update-check" \
         > "$META.part" 2>/dev/null && [[ -s "$META.part" ]]; then
    mv "$META.part" "$META"
    log "metadata export ok (CLI): $META"
  else
    # Fall back to the metadata API from inside the pod, using its own env.
    rm -f "$META.part"
    if kubectl exec -n "$NAMESPACE" "$HASURA_POD" -- sh -c \
         'curl -sf -X POST http://localhost:8080/v1/metadata \
            -H "x-hasura-admin-secret: $HASURA_GRAPHQL_ADMIN_SECRET" \
            -H "Content-Type: application/json" \
            -d "{\"type\":\"export_metadata\",\"args\":{}}"' \
         > "$META.part" 2>/dev/null && [[ -s "$META.part" ]]; then
      mv "$META.part" "$META"
      log "metadata export ok (API): $META"
    else
      rm -f "$META.part"
      warn "metadata export failed (both CLI and API); DB dump is still valid"
    fi
  fi
fi

# ---- 3. retention -----------------------------------------------------------
if [[ "$KEEP_DAYS" -gt 0 ]]; then
  log "pruning backups older than $KEEP_DAYS days"
  find "$OUT_DIR" -maxdepth 1 -type f \
    \( -name 'hasura-db-*.sql.gz' -o -name 'hasura-metadata-*.json' \) \
    -mtime +"$KEEP_DAYS" -print -delete || warn "prune had errors"
fi

REMAINING=$(find "$OUT_DIR" -maxdepth 1 -name 'hasura-db-*.sql.gz' | wc -l | tr -d ' ')
log "done. $REMAINING dump(s) retained in $OUT_DIR"
