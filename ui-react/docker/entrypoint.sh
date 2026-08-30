#!/bin/sh
# Generate the runtime configuration into the web root, then hand off to nginx.
#
# The generator is the same module Vercel invokes at build time; passing an
# explicit output path puts it in runtime mode. Configuration comes from plain
# environment variables, so the image is equally runnable under Helm, docker
# run, or docker compose.
#
# Note: this writes into the nginx document root, so the container does not
# support a read-only root filesystem as-is.
set -e

CONFIG_PATH="${MINT_CONFIG_PATH:-/usr/share/nginx/html/env-config.js}"

node /opt/mint/generate-env-config.mjs "$CONFIG_PATH"

exec "$@"
