#!/usr/bin/env bash
# Bump dynamo image tag(s) to one or more submodule branch HEAD SHAs.
# Creates same-named branch in dynamo, commits, pushes, opens PR.
# See SKILL.md.
set -euo pipefail

# submodule_dir|component_key|owner/repo
COMPONENTS=(
  "mint-ensemble-manager|ensemble_manager|mintproject/mint-ensemble-manager"
  "model-catalog-api|model_catalog_api|mintproject/model-catalog-api"
  "ui|ui|mintproject/mint-ui-lit"
  "graphql_engine|hasura|mintproject/graphql_engine"
)
ROOT_PATH="MINT.components"

usage() {
  cat <<EOF
Usage: $(basename "$0") --submodule NAME [--submodule NAME...] [options]

Required:
  --submodule NAME           Repeat for each submodule to bump.
                             One of: mint-ensemble-manager, model-catalog-api, ui, graphql_engine

Options:
  --branch NAME              Branch to read SHA from. Default: each submodule's current branch.
                             All submodules must share a branch name when this is omitted.
  --base NAME                PR base in dynamo. Default: main
  --dynamo-dir PATH          Path to dynamo repo. Default: dynamo
  --values PATH              Values file relative to --dynamo-dir. Default: shared/values.yaml
  --title STRING             Override PR/commit title.
  --body STRING              Override PR body.
  --no-push                  Skip push + PR (commit only).
  --no-pr                    Skip PR (push commit only).
  --dry-run                  Print planned changes; do not modify anything.
  -h, --help                 Show this help.
EOF
}

SUBMODULES=()
BRANCH_OVERRIDE=""
BASE_BRANCH="main"
DYNAMO_DIR="dynamo"
VALUES_REL="shared/values.yaml"
TITLE_OVERRIDE=""
BODY_OVERRIDE=""
DRY_RUN=0
NO_PUSH=0
NO_PR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --submodule)   SUBMODULES+=("$2"); shift 2 ;;
    --branch)      BRANCH_OVERRIDE="$2"; shift 2 ;;
    --base)        BASE_BRANCH="$2"; shift 2 ;;
    --dynamo-dir)  DYNAMO_DIR="$2"; shift 2 ;;
    --values)      VALUES_REL="$2"; shift 2 ;;
    --title)       TITLE_OVERRIDE="$2"; shift 2 ;;
    --body)        BODY_OVERRIDE="$2"; shift 2 ;;
    --no-push)     NO_PUSH=1; shift ;;
    --no-pr)       NO_PR=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ${#SUBMODULES[@]} -eq 0 ]]; then
  echo "ERROR: at least one --submodule is required" >&2
  usage >&2
  exit 2
fi

command -v git >/dev/null || { echo "git not found" >&2; exit 1; }
command -v yq  >/dev/null || { echo "yq not found (mikefarah v4)" >&2; exit 1; }
if [[ $NO_PR -eq 0 && $NO_PUSH -eq 0 && $DRY_RUN -eq 0 ]]; then
  command -v gh >/dev/null || { echo "gh not found (run with --no-pr if not installed)" >&2; exit 1; }
fi

VALUES_PATH="${DYNAMO_DIR%/}/${VALUES_REL}"
if [[ ! -f "$VALUES_PATH" ]]; then
  echo "ERROR: values file not found: $VALUES_PATH" >&2
  exit 1
fi
if [[ ! -d "${DYNAMO_DIR}/.git" ]]; then
  echo "ERROR: not a git repo: $DYNAMO_DIR" >&2
  exit 1
fi

lookup_component() {
  local dir="$1"
  for entry in "${COMPONENTS[@]}"; do
    IFS='|' read -r D K R <<< "$entry"
    if [[ "$D" == "$dir" ]]; then
      echo "$K|$R"
      return 0
    fi
  done
  return 1
}

# Resolve per-submodule branch + SHA + component metadata.
PLAN_KEYS=()
PLAN_SHAS=()
PLAN_REPOS=()
PLAN_BRANCHES=()
PLAN_OLDS=()
PLAN_DIRS=()

RESOLVED_BRANCH=""
for SUB in "${SUBMODULES[@]}"; do
  META="$(lookup_component "$SUB" || true)"
  if [[ -z "$META" ]]; then
    echo "ERROR: unknown submodule: $SUB" >&2
    exit 2
  fi
  IFS='|' read -r KEY OWNER_REPO <<< "$META"

  if [[ -n "$BRANCH_OVERRIDE" ]]; then
    BRANCH="$BRANCH_OVERRIDE"
    SHA="$(git ls-remote "https://github.com/${OWNER_REPO}.git" "refs/heads/${BRANCH}" | awk '{print $1}')"
    if [[ -z "$SHA" ]]; then
      echo "ERROR: ${OWNER_REPO}@${BRANCH} not found on remote" >&2
      exit 1
    fi
  else
    if [[ ! -d "${SUB}/.git" && ! -f "${SUB}/.git" ]]; then
      echo "ERROR: submodule not initialized at ./${SUB}" >&2
      exit 1
    fi
    BRANCH="$(git -C "$SUB" rev-parse --abbrev-ref HEAD)"
    if [[ "$BRANCH" == "HEAD" ]]; then
      echo "ERROR: ${SUB} is detached HEAD; pass --branch explicitly" >&2
      exit 1
    fi
    SHA="$(git -C "$SUB" rev-parse HEAD)"
  fi

  if [[ -z "$RESOLVED_BRANCH" ]]; then
    RESOLVED_BRANCH="$BRANCH"
  elif [[ "$RESOLVED_BRANCH" != "$BRANCH" ]]; then
    echo "ERROR: submodule branch mismatch (${SUB}=${BRANCH}, expected ${RESOLVED_BRANCH}). Pass --branch to override." >&2
    exit 1
  fi

  EXISTS="$(yq ".${ROOT_PATH} | has(\"${KEY}\")" "$VALUES_PATH")"
  if [[ "$EXISTS" != "true" ]]; then
    echo "WARN: ${ROOT_PATH}.${KEY} not in $VALUES_PATH — skipping" >&2
    continue
  fi
  HAS_TAG="$(yq ".${ROOT_PATH}.${KEY}.image | has(\"tag\")" "$VALUES_PATH" 2>/dev/null || echo false)"
  if [[ "$HAS_TAG" != "true" ]]; then
    echo "WARN: ${ROOT_PATH}.${KEY}.image.tag missing in $VALUES_PATH — skipping" >&2
    continue
  fi
  OLD="$(yq ".${ROOT_PATH}.${KEY}.image.tag // \"\"" "$VALUES_PATH")"

  PLAN_DIRS+=("$SUB")
  PLAN_KEYS+=("$KEY")
  PLAN_SHAS+=("$SHA")
  PLAN_REPOS+=("$OWNER_REPO")
  PLAN_BRANCHES+=("$BRANCH")
  PLAN_OLDS+=("$OLD")
done

if [[ ${#PLAN_KEYS[@]} -eq 0 ]]; then
  echo "no matching component tags to update" >&2
  exit 0
fi

echo "Branch: ${RESOLVED_BRANCH}"
echo "Dynamo: ${DYNAMO_DIR} (base: ${BASE_BRANCH})"
echo "Values: ${VALUES_PATH}"
echo
printf "%-22s %-12s %-44s -> %-44s\n" SUBMODULE COMPONENT OLD_TAG NEW_TAG
printf -- "------------------------------------------------------------------------------------------------------------------------------\n"
for i in "${!PLAN_KEYS[@]}"; do
  printf "%-22s %-12s %-44s -> %-44s\n" \
    "${PLAN_DIRS[$i]}" "${PLAN_KEYS[$i]}" "${PLAN_OLDS[$i]:-<unset>}" "${PLAN_SHAS[$i]}"
done
echo

if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry-run — no changes)"
  exit 0
fi

# Switch dynamo to target branch.
CURRENT="$(git -C "$DYNAMO_DIR" rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT" != "$RESOLVED_BRANCH" ]]; then
  if git -C "$DYNAMO_DIR" show-ref --verify --quiet "refs/heads/${RESOLVED_BRANCH}"; then
    git -C "$DYNAMO_DIR" checkout "$RESOLVED_BRANCH"
  else
    git -C "$DYNAMO_DIR" fetch origin "$BASE_BRANCH" --quiet || true
    git -C "$DYNAMO_DIR" checkout -b "$RESOLVED_BRANCH" "origin/${BASE_BRANCH}" 2>/dev/null \
      || git -C "$DYNAMO_DIR" checkout -b "$RESOLVED_BRANCH"
  fi
fi

# Apply tag updates.
for i in "${!PLAN_KEYS[@]}"; do
  SHA="${PLAN_SHAS[$i]}" KEY="${PLAN_KEYS[$i]}" \
    yq -i ".${ROOT_PATH}.${KEY}.image.tag = strenv(SHA)" "$VALUES_PATH"
done

# Stage + commit if there is a diff.
git -C "$DYNAMO_DIR" add "$VALUES_REL"
if git -C "$DYNAMO_DIR" diff --cached --quiet; then
  echo "No tag changes (file already at target SHAs). Nothing to commit."
  exit 0
fi

# Build commit message.
COMP_LIST=$(IFS=,; echo "${PLAN_KEYS[*]}")
DEFAULT_TITLE="chore(dynamo): bump ${COMP_LIST} to ${RESOLVED_BRANCH}"
TITLE="${TITLE_OVERRIDE:-$DEFAULT_TITLE}"

BODY_LINES=()
BODY_LINES+=("Bumps dynamo image tag(s) for branch \`${RESOLVED_BRANCH}\`:")
BODY_LINES+=("")
for i in "${!PLAN_KEYS[@]}"; do
  SHORT="${PLAN_SHAS[$i]:0:12}"
  BODY_LINES+=("- \`MINT.components.${PLAN_KEYS[$i]}.image.tag\` -> \`${PLAN_SHAS[$i]}\` (https://github.com/${PLAN_REPOS[$i]}/tree/${PLAN_BRANCHES[$i]}, was \`${PLAN_OLDS[$i]:-unset}\`)")
done
BODY_LINES+=("")
BODY_LINES+=("Wait for upstream CI to publish each image at the target SHA before merging.")
DEFAULT_BODY="$(printf '%s\n' "${BODY_LINES[@]}")"
BODY="${BODY_OVERRIDE:-$DEFAULT_BODY}"

git -C "$DYNAMO_DIR" commit -m "$TITLE" -m "$DEFAULT_BODY"
echo "Committed in ${DYNAMO_DIR}."

if [[ $NO_PUSH -eq 1 ]]; then
  echo "(--no-push) Skipping push and PR."
  exit 0
fi

git -C "$DYNAMO_DIR" push -u origin "$RESOLVED_BRANCH"

if [[ $NO_PR -eq 1 ]]; then
  echo "(--no-pr) Skipping PR creation."
  exit 0
fi

# Resolve dynamo remote owner/repo for gh -R targeting.
REMOTE_URL="$(git -C "$DYNAMO_DIR" remote get-url origin)"
REPO_SLUG="$(echo "$REMOTE_URL" \
  | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"

gh -R "$REPO_SLUG" pr create \
  --base "$BASE_BRANCH" \
  --head "$RESOLVED_BRANCH" \
  --title "$TITLE" \
  --body "$BODY"
