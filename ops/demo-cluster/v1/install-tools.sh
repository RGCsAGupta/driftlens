#!/usr/bin/env bash
set -euo pipefail

readonly KIND_VERSION="v0.32.0"
readonly KIND_SHA256="50030de23cf40a18505f20426f6a8506bedf13c6e509244bd1fa9463721b0f54"
readonly KUBECTL_VERSION="v1.35.5"
readonly KUBECTL_SHA256="90f75ea6ecc9ea5633262e1c0b83a40560003b30fc94a04cb099404fcef0c224"

destination="${1:-}"
if [[ -z "$destination" || "$destination" != /* ]]; then
  echo "usage: $0 /absolute/bin/directory" >&2
  exit 2
fi

install_binary() {
  local name="$1" url="$2" expected_sha="$3" target="$destination/$1"

  if [[ -x "$target" ]] && echo "$expected_sha  $target" | sha256sum --check --status; then
    return
  fi

  local temporary
  temporary="$(mktemp)"
  curl --fail --location --silent --show-error "$url" --output "$temporary"
  echo "$expected_sha  $temporary" | sha256sum --check --status
  install -m 0755 "$temporary" "$target"
  rm -f "$temporary"
}

install -d -m 0755 "$destination"
install_binary kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64" "$KIND_SHA256"
install_binary kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" "$KUBECTL_SHA256"
echo "Pinned kind and kubectl tools are installed."
