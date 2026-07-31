#!/usr/bin/env bash
set -euo pipefail

readonly SERVICE_ACCOUNT="driftlens-reader"
cluster_name="${DRIFTLENS_KIND_CLUSTER_NAME:-driftlens-demo}"
namespace="${DRIFTLENS_DEMO_NAMESPACE:-driftlens-demo}"
kubeconfig="${1:-}"

[[ "$kubeconfig" == /* && -r "$kubeconfig" ]] || {
  echo "usage: $0 /absolute/read-only-kubeconfig" >&2
  exit 2
}
[[ "$(kubectl --kubeconfig "$kubeconfig" config current-context)" == "$cluster_name" ]]
if grep -Eq '^[[:space:]]+(exec|tokenFile|client-certificate|client-key|certificate-authority):' "$kubeconfig"; then
  echo "kubeconfig contains an external credential reference" >&2
  exit 1
fi

can_i() {
  kubectl --kubeconfig "$kubeconfig" auth can-i "$1" "$2" --namespace "$namespace"
}

[[ "$(can_i get deployments.apps)" == "yes" ]]
kubectl --kubeconfig "$kubeconfig" get deployment --namespace "$namespace" --ignore-not-found >/dev/null
for denied in \
  "list deployments.apps" \
  "watch deployments.apps" \
  "create deployments.apps" \
  "update deployments.apps" \
  "patch deployments.apps" \
  "delete deployments.apps" \
  "get secrets"; do
  read -r verb resource <<<"$denied"
  [[ "$(can_i "$verb" "$resource")" == "no" ]]
done

echo "RBAC contract verified: Deployment get allowed; list/watch/mutation/Secret access denied."
