#!/bin/bash
set -euo pipefail

# install-backup-cron.sh
# Installs (or removes) the crontab entry that runs backup-hasura.sh on the
# server. Idempotent: it rewrites its own managed block and leaves every other
# crontab line untouched.
#
# Usage:
#   ./scripts/install-backup-cron.sh [--schedule "0 2 * * *"] [--out-dir DIR]
#                                    [--namespace NS] [--keep-days N]
#                                    [--kubeconfig PATH] [--log-file FILE]
#                                    [--user USER] [--show] [--remove] [--dry-run]
#
# Flags:
#   --schedule CRON  Cron expression (default: "0 2 * * *" — 02:00 daily).
#   --out-dir DIR    Backup destination (default: /var/backups/mint-hasura).
#   --namespace NS   k8s namespace (default: mint).
#   --keep-days N    Retention in days (default: 14).
#   --kubeconfig P   Kubeconfig for cron (default: $KUBECONFIG or ~/.kube/config).
#   --log-file FILE  Backup log (default: /var/log/mint-hasura-backup.log).
#   --user USER      Install into another user's crontab (needs root).
#   --show           Print the managed block and exit; change nothing.
#   --remove         Remove the managed block and exit.
#   --dry-run        Print the new crontab; do not install it.
#
# Cron runs with a near-empty environment. This script pins PATH and KUBECONFIG
# into the crontab because that is the usual reason a cron backup silently does
# nothing while the same command works in an interactive shell.
#
# The cron line redirects to the log rather than passing --log-file, so a crash
# before the script starts logging is captured too.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_SCRIPT="$REPO_ROOT/scripts/backup-hasura.sh"

MARKER_BEGIN="# >>> mint-hasura-backup (managed by scripts/install-backup-cron.sh) >>>"
MARKER_END="# <<< mint-hasura-backup <<<"

# ---- defaults ---------------------------------------------------------------
SCHEDULE="0 2 * * *"
OUT_DIR="/var/backups/mint-hasura"
NAMESPACE="mint"
KEEP_DAYS=14
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/.kube/config}"
LOG_FILE="/var/log/mint-hasura-backup.log"
CRON_USER=""
ACTION="install"
DRY_RUN=0

# ---- arg parse --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --schedule)   SCHEDULE="$2"; shift 2 ;;
    --out-dir)    OUT_DIR="$2"; shift 2 ;;
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    --keep-days)  KEEP_DAYS="$2"; shift 2 ;;
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2 ;;
    --log-file)   LOG_FILE="$2"; shift 2 ;;
    --user)       CRON_USER="$2"; shift 2 ;;
    --show)       ACTION="show"; shift ;;
    --remove)     ACTION="remove"; shift ;;
    --dry-run)    DRY_RUN=1; shift ;;
    -h|--help)    sed -n '1,32p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }

CRONTAB=(crontab)
[[ -n "$CRON_USER" ]] && CRONTAB=(crontab -u "$CRON_USER")

command -v crontab >/dev/null || fail "crontab not in PATH"

# Field count is the one cron-expression error worth catching early; the rest
# only shows up when cron rejects the file, which it reports clearly.
FIELDS=$(echo "$SCHEDULE" | awk '{print NF}')
[[ "$FIELDS" -eq 5 ]] || fail "--schedule needs 5 fields, got $FIELDS: '$SCHEDULE'"

# ---- build the managed block ------------------------------------------------
build_block() {
  cat <<EOF
$MARKER_BEGIN
# Installed $(date +'%Y-%m-%d %H:%M:%S') from $REPO_ROOT
PATH=$PATH
KUBECONFIG=$KUBECONFIG_PATH
$SCHEDULE $BACKUP_SCRIPT --out-dir $OUT_DIR --namespace $NAMESPACE --keep-days $KEEP_DAYS >> $LOG_FILE 2>&1
$MARKER_END
EOF
}

if [[ "$ACTION" == "show" ]]; then
  build_block
  exit 0
fi

# ---- read current crontab, strip any previous managed block -----------------
CURRENT="$("${CRONTAB[@]}" -l 2>/dev/null || true)"
STRIPPED="$(printf '%s\n' "$CURRENT" \
  | awk -v b="$MARKER_BEGIN" -v e="$MARKER_END" '
      $0 == b { skip = 1; next }
      $0 == e { skip = 0; next }
      !skip
    ')"

if [[ "$ACTION" == "remove" ]]; then
  if [[ "$CURRENT" == "$STRIPPED" ]]; then
    echo "no managed block found; nothing to remove"
    exit 0
  fi
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "--- crontab after removal (dry-run) ---"
    printf '%s\n' "$STRIPPED"
    exit 0
  fi
  printf '%s\n' "$STRIPPED" | "${CRONTAB[@]}" -
  echo "removed the mint-hasura-backup crontab block"
  exit 0
fi

# ---- install ----------------------------------------------------------------
[[ -x "$BACKUP_SCRIPT" ]] || fail "$BACKUP_SCRIPT missing or not executable (chmod +x it)"
[[ -r "$KUBECONFIG_PATH" ]] || fail "kubeconfig not readable: $KUBECONFIG_PATH"

# Drop trailing blank lines so repeated installs do not grow the file.
TRIMMED="$(printf '%s\n' "$STRIPPED" \
  | awk 'NF {last = NR} {line[NR] = $0} END {for (i = 1; i <= last; i++) print line[i]}')"

if [[ -z "$TRIMMED" ]]; then
  NEW_CRONTAB="$(build_block)"
else
  NEW_CRONTAB="$(printf '%s\n\n%s' "$TRIMMED" "$(build_block)")"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "--- crontab that would be installed (dry-run) ---"
  printf '%s\n' "$NEW_CRONTAB"
  exit 0
fi

printf '%s\n' "$NEW_CRONTAB" | "${CRONTAB[@]}" - || fail "crontab install rejected"

echo "installed. Current crontab:"
echo "---"
"${CRONTAB[@]}" -l
echo "---"

# ---- post-install checks ----------------------------------------------------
LOG_PARENT="$(dirname "$LOG_FILE")"
[[ -w "$LOG_PARENT" ]] || echo "WARN: $LOG_PARENT is not writable by $(whoami); cron output will be lost"
[[ -d "$OUT_DIR" ]] || echo "NOTE: $OUT_DIR does not exist yet; the first run creates it (needs write permission on $(dirname "$OUT_DIR"))"

cat <<EOF

Verify before trusting the schedule:

  # 1. dry-run the backup as the cron user
  $BACKUP_SCRIPT --out-dir $OUT_DIR --namespace $NAMESPACE --dry-run

  # 2. force one real run now
  $BACKUP_SCRIPT --out-dir $OUT_DIR --namespace $NAMESPACE --keep-days $KEEP_DAYS >> $LOG_FILE 2>&1

  # 3. after the first scheduled run
  tail -50 $LOG_FILE
  ls -lh $OUT_DIR

Remove with: $0 --remove
EOF
