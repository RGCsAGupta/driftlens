#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly EXPECTED_KIND_VERSION="v0.32.0"
readonly EXPECTED_KUBECTL_VERSION="v1.35.5"
readonly NODE_IMAGE="kindest/node:v1.35.5@sha256:ce977ae6d65918d0b58a5f8b5e940429c2ce42fa3a5619ec2bbc60b949c0ac95"
readonly SERVICE_ACCOUNT="driftlens-reader"
readonly TOKEN_SECRET="driftlens-reader-token"

cluster_name="${DRIFTLENS_KIND_CLUSTER_NAME:-driftlens-demo}"
namespace="${DRIFTLENS_DEMO_NAMESPACE:-driftlens-demo}"
api_address="${DRIFTLENS_KIND_API_ADDRESS:-}"
api_port="${DRIFTLENS_KIND_API_PORT:-6443}"
output="${1:-}"

fail() {
  echo "demo-cluster bootstrap: $1" >&2
  exit 2
}

[[ "$cluster_name" =~ ^[a-z0-9]([a-z0-9-]{0,29}[a-z0-9])?$ ]] || fail "invalid cluster name"
[[ "$namespace" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail "invalid namespace"
[[ "$api_address" =~ ^[0-9a-fA-F:.]+$ ]] || fail "API address must be an explicit IP literal"
[[ "$api_port" =~ ^[0-9]+$ ]] && ((api_port >= 1024 && api_port <= 65535)) || fail "invalid API port"
[[ "$output" == /* ]] || fail "kubeconfig output must be an absolute path"

if [[ "${2:-}" == "--validate-only" ]]; then
  exit 0
fi

for command in kind kubectl docker base64; do
  command -v "$command" >/dev/null || fail "$command is required"
done
kind version | grep -Fq "$EXPECTED_KIND_VERSION" || fail "unexpected kind version"
kubectl version --client --output=yaml | grep -Fq "gitVersion: ${EXPECTED_KUBECTL_VERSION}" || fail "unexpected kubectl version"

working_directory="$(mktemp -d)"
trap 'rm -rf "$working_directory"' EXIT
admin_config="$working_directory/admin.kubeconfig"

if kind get clusters | grep -Fxq "$cluster_name"; then
  mapfile -t nodes < <(kind get nodes --name "$cluster_name")
  [[ "${#nodes[@]}" -eq 1 ]] || fail "existing cluster is not single-node"
  expected_image_id="$(docker image inspect "$NODE_IMAGE" --format '{{.Id}}')"
  actual_image_id="$(docker inspect "${nodes[0]}" --format '{{.Image}}')"
  [[ "$actual_image_id" == "$expected_image_id" ]] || fail "existing cluster uses an unexpected node image"
else
  cat >"$working_directory/kind.yaml" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  apiServerAddress: "$api_address"
  apiServerPort: $api_port
nodes:
  - role: control-plane
EOF
  kind create cluster \
    --name "$cluster_name" \
    --image "$NODE_IMAGE" \
    --config "$working_directory/kind.yaml" \
    --wait 120s
fi

kind get kubeconfig --name "$cluster_name" >"$admin_config"
export KUBECONFIG="$admin_config"
kubectl wait --for=condition=Ready nodes --all --timeout=120s >/dev/null
server="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')"
if [[ "$api_address" == *:* ]]; then
  expected_server="https://[$api_address]:$api_port"
else
  expected_server="https://$api_address:$api_port"
fi
[[ "$server" == "$expected_server" ]] || fail "existing cluster uses an unexpected API endpoint"

kubectl apply -f - >/dev/null <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: $namespace
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SERVICE_ACCOUNT
  namespace: $namespace
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: $SERVICE_ACCOUNT
  namespace: $namespace
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: $SERVICE_ACCOUNT
  namespace: $namespace
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: $SERVICE_ACCOUNT
subjects:
  - kind: ServiceAccount
    name: $SERVICE_ACCOUNT
    namespace: $namespace
---
apiVersion: v1
kind: Secret
metadata:
  name: $TOKEN_SECRET
  namespace: $namespace
  annotations:
    kubernetes.io/service-account.name: $SERVICE_ACCOUNT
type: kubernetes.io/service-account-token
EOF

token=""
ca_data=""
for _ in {1..30}; do
  token="$(kubectl get secret "$TOKEN_SECRET" -n "$namespace" -o jsonpath='{.data.token}' | base64 --decode)"
  ca_data="$(kubectl get secret "$TOKEN_SECRET" -n "$namespace" -o jsonpath='{.data.ca\.crt}')"
  [[ -n "$token" && -n "$ca_data" ]] && break
  sleep 1
done
[[ -n "$token" && -n "$ca_data" ]] || fail "service-account credential was not issued"

candidate="$working_directory/driftlens.kubeconfig"
cat >"$candidate" <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: $cluster_name
    cluster:
      certificate-authority-data: $ca_data
      server: $server
contexts:
  - name: $cluster_name
    context:
      cluster: $cluster_name
      namespace: $namespace
      user: $SERVICE_ACCOUNT
current-context: $cluster_name
users:
  - name: $SERVICE_ACCOUNT
    user:
      token: $token
EOF
install -D -m 0400 "$candidate" "$output"
echo "Demo cluster and read-only kubeconfig are ready."
