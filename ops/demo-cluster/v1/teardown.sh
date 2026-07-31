#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly CLUSTER_NAME="driftlens-demo"
readonly NAMESPACE="driftlens-demo"
readonly DEPLOYMENT_NAME="driftlens-demo"

admin_kubeconfig="${1:-}"
mode="${2:-workload-only}"

fail() {
  echo "demo teardown: $1" >&2
  exit 2
}

[[ "$#" -ge 1 && "$#" -le 2 ]] || fail "usage: $0 /absolute/admin.kubeconfig [--delete-cluster]"
[[ "$admin_kubeconfig" == /* ]] || fail "admin kubeconfig path must be absolute"
case "$mode" in
  workload-only | --delete-cluster) ;;
  *) fail "usage: $0 /absolute/admin.kubeconfig [--delete-cluster]" ;;
esac

if [[ "$mode" == "--delete-cluster" ]]; then
  command -v kind >/dev/null || fail "kind is required"
  if ! kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
    echo "Named demo cluster is already absent."
    exit 0
  fi
fi

[[ -r "$admin_kubeconfig" ]] || fail "admin kubeconfig must be readable"
command -v kubectl >/dev/null || fail "kubectl is required"

current_context="$(kubectl --kubeconfig "$admin_kubeconfig" config current-context)"
[[ "$current_context" == "kind-$CLUSTER_NAME" ]] || fail "admin kubeconfig does not target the named demo cluster"

if [[ "$mode" == "--delete-cluster" ]]; then
  kind delete cluster --name "$CLUSTER_NAME"
  echo "Named demo cluster deleted."
  exit 0
fi

kubectl --kubeconfig "$admin_kubeconfig" delete "deployment/$DEPLOYMENT_NAME" \
  --namespace "$NAMESPACE" \
  --ignore-not-found=true \
  --wait=true \
  --timeout=60s >/dev/null
echo "Named demo workload removed; cluster and read-only RBAC retained."
