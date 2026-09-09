#!/usr/bin/env bash
# Launch the SVO Adapter with the NTGAM forecast tab wired up:
#   - CKAN token (read at runtime from the local token file; NOT stored in the repo)
# Open http://localhost:8000/ui/ and switch to the "NTGAM forecast" tab.
set -euo pipefail
cd "$(dirname "$0")"

export SVO_ADAPTER_CKAN_TOKEN="$(cat "${CKAN_TOKEN_FILE:-$HOME/.claude/tmp/ckan_token.txt}")"
# Optional overrides (defaults match local dev): SVO_ADAPTER_CKAN_URL, SVO_ADAPTER_MINT_HASURA_URL,
# SVO_ADAPTER_MINT_ADMIN_SECRET, SVO_ADAPTER_FORECAST_CONFIG_ID.
_export_dotenv_if_unset() {
  local key="$1"
  local value=""
  if [ -z "${!key:-}" ] && [ -f .env ]; then
    value="$(sed -n "s/^${key}=//p" .env | tail -n 1)"
    [ -n "${value}" ] && export "${key}=${value}"
  fi
}
_export_dotenv_if_unset SVO_ADAPTER_CKAN_URL
_export_dotenv_if_unset SVO_ADAPTER_NTGAM_WATERLEVELS_DATASET

# Start the server in the background, then register the forecast profile from CKAN.
# The registry is persisted by Hasura, so registration is safe to rerun.
.venv/bin/uvicorn app.main:app --port 8000 "$@" &
SERVER=$!
for _ in $(seq 1 30); do curl -sf http://localhost:8000/health >/dev/null 2>&1 && break; sleep 1; done
CKAN_TOKEN="$SVO_ADAPTER_CKAN_TOKEN" ADAPTER_URL="http://localhost:8000" \
  CKAN_URL="${SVO_ADAPTER_CKAN_URL:-http://localhost:5001}" \
  NTGAM_HEAD_DATASET="${SVO_ADAPTER_NTGAM_WATERLEVELS_DATASET:-ntgam-water-levels}" \
  .venv/bin/python ../../ntgam/register_forecast_planner.py || echo "(forecast registry registration failed; continuing)"
wait "$SERVER"
