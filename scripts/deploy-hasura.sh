#!/bin/bash
set -euo pipefail

# deploy-hasura.sh
# Automates the full MINT Hasura/model-catalog redeploy cycle:
#   1. Restart model-catalog and hasura deployments
#   2. Wait for rollouts to complete
#   3. Apply migrations and sync metadata inside the hasura pod
#
# Usage:
#   ./scripts/deploy-hasura.sh [namespace] [--skip-restart] [--dry-run]
#
# Arguments:
#   namespace       Kubernetes namespace (default: mint)
#   --skip-restart  Skip rollout restarts (useful when only migrations changed)
#   --dry-run       Print commands without executing them

NAMESPACE="mint"
SKIP_RESTART=false
DRY_RUN=false
STEP_NUM=0
FAILED_STEP=""

# Argument parsing
for arg in "$@"; do
  case "$arg" in
    --skip-restart)
      SKIP_RESTART=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --*)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
    *)
      NAMESPACE="$arg"
      ;;
  esac
done

# ERR trap to report which step failed
trap 'echo "" >&2; echo "ERROR: Script failed during step: ${FAILED_STEP:-unknown}" >&2' ERR

step() {
  STEP_NUM=$((STEP_NUM + 1))
  FAILED_STEP="Step ${STEP_NUM}: $*"
  echo ""
  echo "==> Step ${STEP_NUM}: $*"
}

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "  [dry-run] $*"
  else
    "$@"
  fi
}

echo "=================================================="
echo "  MINT Hasura Deployment"
echo "  Namespace: ${NAMESPACE}"
[[ "$DRY_RUN" == true ]]   && echo "  Mode:      DRY RUN (no commands will be executed)"
[[ "$SKIP_RESTART" == true ]] && echo "  Restarts:  SKIPPED"
echo "=================================================="

# Prerequisite checks
step "Checking prerequisites"

if ! command -v kubectl &>/dev/null; then
  echo "ERROR: kubectl is not installed or not in PATH" >&2
  exit 1
fi
echo "  kubectl: found ($(kubectl version --client --short 2>/dev/null | head -1))"

echo "  Checking cluster connectivity..."
run kubectl cluster-info --request-timeout=5s > /dev/null
echo "  Cluster: reachable"

# Step 1 - Rollout restarts
if [[ "$SKIP_RESTART" == false ]]; then
  step "Restarting deployments in namespace '${NAMESPACE}'"

  echo "  Restarting mint-model-catalog..."
  run kubectl rollout restart deployment/mint-model-catalog -n "${NAMESPACE}"

  echo "  Restarting mint-hasura..."
  run kubectl rollout restart deployment/mint-hasura -n "${NAMESPACE}"

  step "Waiting for rollouts to complete (timeout: 120s)"

  echo "  Waiting for mint-model-catalog..."
  run kubectl rollout status deployment/mint-model-catalog -n "${NAMESPACE}" --timeout=120s
  echo "  mint-model-catalog: ready"

  echo "  Waiting for mint-hasura..."
  run kubectl rollout status deployment/mint-hasura -n "${NAMESPACE}" --timeout=120s
  echo "  mint-hasura: ready"
else
  echo ""
  echo "  Skipping rollout restarts (--skip-restart)"
fi

# Step 2 - Find hasura pod
step "Locating hasura pod in namespace '${NAMESPACE}'"

if [[ "$DRY_RUN" == true ]]; then
  POD="<hasura-pod-name>"
  echo "  [dry-run] Would query: kubectl get pod -n ${NAMESPACE} -l app=mint-hasura -o jsonpath='{.items[0].metadata.name}'"
  echo "  Pod: ${POD}"
else
  POD=$(kubectl get pod -n "${NAMESPACE}" -l app=mint-hasura -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

  if [[ -z "$POD" ]]; then
    echo "ERROR: No running hasura pod found with label app=mint-hasura in namespace '${NAMESPACE}'" >&2
    echo "       Check that the deployment is healthy: kubectl get pods -n ${NAMESPACE} -l app=mint-hasura" >&2
    exit 1
  fi

  echo "  Pod: ${POD}"
fi

# Step 3 - Apply migrations and metadata
step "Applying Hasura migrations and metadata"

HASURA_CMD="cd /hasura && hasura migrate apply --skip-update-check && hasura metadata apply --skip-update-check"

echo "  Running inside pod: ${POD}"
echo "  Command: ${HASURA_CMD}"
run kubectl exec -n "${NAMESPACE}" "${POD}" -- bash -c "${HASURA_CMD}"

# Final summary
echo ""
echo "=================================================="
echo "  Deployment complete"
echo "  Namespace: ${NAMESPACE}"
[[ "$DRY_RUN" == true ]] && echo "  Mode:      DRY RUN - no changes were made"
echo "=================================================="
