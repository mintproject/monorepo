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
#                              [--no-metadata] [--log-file FILE] [--dry-run]
#
# Flags:
#   --out-dir DIR    Where dumps land (default: /var/backups/mint-hasura).
#   --namespace NS   k8s namespace (default: mint).
#   --keep-days N    Delete backups older than N days (default: 14; 0 = never).
#   --db-pod POD     Postgres pod (default: mint-hasura-db-0).
#   --db-user USER   Postgres role (default: hasura).
#   --db-name NAME   Database (default: hasura).
#   --no-metadata    Skip the Hasura metadata export.
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
    --log-file)    LOG_FILE="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     sed -n '1,40p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] || { echo "--keep-days must be an integer" >&2; exit 2; }

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
  log "DRY: kubectl exec -n $NAMESPACE $DB_POD -- pg_dump -U $DB_USER -d $DB_NAME --no-owner --no-acl | gzip -9 > $OUT_DIR/hasura-db-$TS.sql.gz"
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
log "dumping $DB_NAME from $DB_POD -> $DUMP"

# Write to .part first so a failed run never leaves a file that looks complete.
if ! kubectl exec -n "$NAMESPACE" "$DB_POD" -- \
       pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
     | gzip -9 > "$PART"; then
  rm -f "$PART"
  fail "pg_dump failed"
fi

# Three checks, cheapest first. The completion marker is the one that matters:
# a dump killed mid-write still gunzips cleanly and still looks plausibly sized.
[[ -s "$PART" ]] || { rm -f "$PART"; fail "dump is empty"; }
gzip -t "$PART" 2>/dev/null || { rm -f "$PART"; fail "dump is not valid gzip"; }

RAW_BYTES=$(gunzip -c "$PART" | wc -c | tr -d ' ')
if ! gunzip -c "$PART" | tail -5 | grep -q "PostgreSQL database dump complete"; then
  rm -f "$PART"
  fail "dump is truncated: no pg_dump completion marker (${RAW_BYTES} bytes uncompressed)"
fi

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
