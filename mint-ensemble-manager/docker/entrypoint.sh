#!/bin/sh
set -eu

# Tapis Pods cannot mount the Helm ConfigMap used in Kubernetes. When the dev
# deployment supplies ENSEMBLE_MANAGER_CONFIG_JSON, materialize it as the config
# file that the application already knows how to read.
if [ -n "${ENSEMBLE_MANAGER_CONFIG_JSON:-}" ]; then
  CONFIG_PATH="${ENSEMBLE_MANAGER_CONFIG_FILE:-/home/node/app/config.runtime.json}"
  printf '%s' "$ENSEMBLE_MANAGER_CONFIG_JSON" > "$CONFIG_PATH"
  export ENSEMBLE_MANAGER_CONFIG_FILE="$CONFIG_PATH"
fi

exec "$@"
