#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly CLUSTER_NAME="driftlens-demo"
readonly NAMESPACE="driftlens-demo"
readonly DEPLOYMENT_NAME="driftlens-demo"
readonly CONTAINER_NAME="web"
readonly READER_NAME="driftlens-reader"
readonly DRIFT_IMAGE="registry.k8s.io/pause@sha256:7c38f24774e3cbd906d2d33c38354ccf787635581c122965132c9bd309754d4a"

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "$script_directory/../../.." && pwd)"
manifest="$repository_root/demo/deployment.yaml"
admin_kubeconfig="${1:-}"
scenario="${2:-}"

fail() {
  echo "demo scenario: $1" >&2
  exit 2
}

[[ "$#" -eq 2 ]] || fail "usage: $0 /absolute/admin.kubeconfig {in-sync|drifted|missing-live|access-failure|restore-access}"
case "$scenario" in
  in-sync | drifted | missing-live | access-failure | restore-access) ;;
  *) fail "usage: $0 /absolute/admin.kubeconfig {in-sync|drifted|missing-live|access-failure|restore-access}" ;;
esac

[[ "$admin_kubeconfig" == /* && -r "$admin_kubeconfig" ]] || fail "admin kubeconfig must be an absolute readable file"
[[ -r "$manifest" ]] || fail "demo manifest is missing"
command -v kubectl >/dev/null || fail "kubectl is required"

kubectl_admin() {
  kubectl --kubeconfig "$admin_kubeconfig" "$@"
}

current_context="$(kubectl_admin config current-context)"
[[ "$current_context" == "kind-$CLUSTER_NAME" ]] || fail "admin kubeconfig does not target the named demo cluster"
kubectl_admin get namespace "$NAMESPACE" >/dev/null || fail "demo namespace is not ready"

apply_desired() {
  kubectl_admin apply -f "$manifest" >/dev/null
  kubectl_admin rollout status "deployment/$DEPLOYMENT_NAME" \
    --namespace "$NAMESPACE" \
    --timeout=120s >/dev/null
}

case "$scenario" in
  in-sync)
    apply_desired
    echo "Demo scenario ready: IN_SYNC."
    ;;
  drifted)
    apply_desired
    kubectl_admin scale "deployment/$DEPLOYMENT_NAME" \
      --namespace "$NAMESPACE" \
      --replicas=2 >/dev/null
    kubectl_admin set image "deployment/$DEPLOYMENT_NAME" \
      "$CONTAINER_NAME=$DRIFT_IMAGE" \
      --namespace "$NAMESPACE" >/dev/null
    kubectl_admin rollout status "deployment/$DEPLOYMENT_NAME" \
      --namespace "$NAMESPACE" \
      --timeout=120s >/dev/null
    echo "Demo scenario ready: DRIFTED replicas and image."
    ;;
  missing-live)
    kubectl_admin delete "deployment/$DEPLOYMENT_NAME" \
      --namespace "$NAMESPACE" \
      --ignore-not-found=true \
      --wait=true \
      --timeout=60s >/dev/null
    echo "Demo scenario ready: MISSING_LIVE."
    ;;
  access-failure)
    kubectl_admin delete "rolebinding/$READER_NAME" \
      --namespace "$NAMESPACE" \
      --ignore-not-found=true \
      --wait=true \
      --timeout=60s >/dev/null
    echo "Demo scenario ready: bounded cluster-access failure."
    ;;
  restore-access)
    kubectl_admin apply -f - >/dev/null <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: $READER_NAME
  namespace: $NAMESPACE
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: $READER_NAME
subjects:
  - kind: ServiceAccount
    name: $READER_NAME
    namespace: $NAMESPACE
EOF
    echo "Demo access restored; start a new scan for recovery proof."
    ;;
esac
