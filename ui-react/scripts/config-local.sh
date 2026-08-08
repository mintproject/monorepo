#!/bin/sh
# Regenerate public/env-config.js from ./.env for local development.
#
# public/env-config.js is tracked, so this overwrites a committed file. Restore
# the checked-in defaults with:  git checkout -- public/env-config.js
#
# Deployed contexts never run this — the container entrypoint and the Vercel
# build invoke scripts/generate-env-config.mjs directly from their own
# environment.
set -e

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "config:local: no .env found. Start from the template:" >&2
  echo "  cp .env.example .env" >&2
  # Refusing rather than continuing is deliberate: with no .env the generator
  # falls back to its *.mint.local defaults, which would silently replace the
  # committed dev defaults with endpoints only reachable inside the cluster.
  exit 1
fi

# Values containing spaces must be quoted in .env — this is shell sourcing.
set -a
. ./.env
set +a

node scripts/generate-env-config.mjs public/env-config.js
