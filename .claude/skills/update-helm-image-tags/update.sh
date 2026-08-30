#!/usr/bin/env bash
# Update image tags in a single helm values file to latest commit SHAs on each component's default branch.
# Usage: update.sh <path-to-values.yaml> [--dry-run] [--component <name>] [--root <yq-path>]
# See SKILL.md for details.
set -euo pipefail

# component_key|github_owner/repo|branch
COMPONENTS=(
  "hasura|mintproject/graphql_engine|main"
  "model_catalog_api|mintproject/model-catalog-api|main"
  "ui|mintproject/mint-ui-lit|master"
  "ensemble_manager|mintproject/mint-ensemble-manager|master"
)

usage() {
  cat <<EOF
Usage: $(basename "$0") <values-file> [--dry-run] [--component NAME]...

Updates components.<key>.image.tag in <values-file> to the latest commit SHA on
each component's default branch. Only keys present in the file are touched.

Components: hasura, model_catalog_api, ui, ensemble_manager
EOF
}

DRY_RUN=0
FILTER=()
TARGET=""
ROOT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --component) FILTER+=("$2"); shift 2 ;;
    --root) ROOT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$1"; shift
      else echo "unexpected arg: $1" >&2; exit 2; fi ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "ERROR: missing <values-file>" >&2
  usage >&2
  exit 2
fi
if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: file not found: $TARGET" >&2
  exit 1
fi

command -v git >/dev/null || { echo "git not found" >&2; exit 1; }
command -v yq  >/dev/null || { echo "yq not found (need mikefarah yq v4)" >&2; exit 1; }

in_filter() {
  [[ ${#FILTER[@]} -eq 0 ]] && return 0
  local k="$1"; for f in "${FILTER[@]}"; do [[ "$f" == "$k" ]] && return 0; done
  return 1
}

printf "%-22s %-12s %-44s %-44s\n" COMPONENT BRANCH OLD_TAG NEW_TAG
printf -- "----------------------------------------------------------------------------------------------------------------\n"

CHANGED=0
for entry in "${COMPONENTS[@]}"; do
  IFS='|' read -r KEY OWNER_REPO BRANCH <<< "$entry"
  in_filter "$KEY" || continue

  # Skip components not present in the target file.
  BASE="${ROOT:+${ROOT}.}components"
  EXISTS="$(yq ".${BASE} | has(\"${KEY}\")" "$TARGET")"
  if [[ "$EXISTS" != "true" ]]; then
    continue
  fi
  HAS_TAG="$(yq ".${BASE}.${KEY}.image | has(\"tag\")" "$TARGET" 2>/dev/null || echo false)"
  if [[ "$HAS_TAG" != "true" ]]; then
    continue
  fi

  SHA="$(git ls-remote "https://github.com/${OWNER_REPO}.git" "refs/heads/${BRANCH}" | awk '{print $1}')"
  if [[ -z "$SHA" ]]; then
    echo "ERROR: could not resolve $OWNER_REPO@$BRANCH" >&2
    exit 1
  fi

  OLD="$(yq ".${BASE}.${KEY}.image.tag // \"\"" "$TARGET")"
  printf "%-22s %-12s %-44s %-44s\n" "$KEY" "$BRANCH" "${OLD:-<unset>}" "$SHA"
  if [[ $DRY_RUN -eq 0 ]]; then
    SHA="$SHA" yq -i ".${BASE}.${KEY}.image.tag = strenv(SHA)" "$TARGET"
    CHANGED=1
  fi
done

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry-run — no files changed)"
else
  if [[ $CHANGED -eq 1 ]]; then
    echo "updated: $TARGET"
  else
    echo "no matching component tags found in: $TARGET"
  fi
fi
