#!/bin/sh

set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

candidate_name=driftlens-candidate
stable_name=driftlens
state_root=/var/lib/driftlens
release_root=$state_root/releases
data_root=$state_root/data
repository_file=/etc/driftlens/image-repository
registry_auth_parent=/run/driftlens

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

cleanup_registry_auth() {
  cleanup_failed=0

  docker logout "$registry" >/dev/null 2>&1 || cleanup_failed=1
  unset registry_username registry_password
  rm -f "$docker_config/config.json" || cleanup_failed=1
  rmdir "$docker_config" || cleanup_failed=1

  return "$cleanup_failed"
}

cleanup_registry_auth_on_exit() {
  release_status=$?
  trap - EXIT INT TERM
  if ! cleanup_registry_auth && test "$release_status" -eq 0; then
    release_status=1
  fi
  exit "$release_status"
}

. /usr/local/libexec/driftlens/v1/common.sh

test "$(id -u)" -eq 0 || fail "release requires root"
test "$#" -eq 2 || fail "usage: driftlens-release <image-digest> <revision>"

image_digest=$1
revision=$2

printf '%s' "$image_digest" |
  grep -Eq '^([^/@[:space:]]+)(/[A-Za-z0-9._-]+)+@sha256:[0-9a-f]{64}$' ||
  fail "image must use an immutable sha256 digest"
printf '%s' "$revision" | grep -Eq '^[0-9a-f]{40}$' ||
  fail "revision must be a full Git SHA"
test -f "$repository_file" || fail "approved image repository is not configured"
test "$(stat -c '%u' "$repository_file")" -eq 0 ||
  fail "image repository config must be root-owned"
test "$(stat -c '%a' "$repository_file")" = 600 ||
  fail "image repository config must use mode 0600"
test "$(wc -l <"$repository_file")" -eq 1 ||
  fail "image repository config must contain one line"

repository=$(sed -n '1p' "$repository_file")
printf '%s' "$repository" |
  grep -Eq '^([^/@[:space:]]+)(/[A-Za-z0-9._-]+)+$' ||
  fail "approved image repository is invalid"
test "${image_digest%%@*}" = "$repository" ||
  fail "image repository does not match approved target"
validate_runtime_files

registry=${repository%%/*}
IFS= read -r registry_username ||
  fail "registry credentials are missing"
IFS= read -r registry_password ||
  fail "registry credentials are incomplete"
if IFS= read -r unexpected_credential_input; then
  fail "registry credentials contain unexpected input"
fi
printf '%s' "$registry_username" |
  grep -Eq '^[A-Za-z0-9._@-]+$' ||
  fail "registry username is invalid"
test -n "$registry_password" || fail "registry password is empty"
if printf '%s' "$registry_password" | LC_ALL=C grep -q '[[:cntrl:]]'; then
  fail "registry password contains unsupported control characters"
fi

install -d -o root -g root -m 0700 "$registry_auth_parent"
docker_config=$(mktemp -d "$registry_auth_parent/auth.XXXXXX")
chmod 0700 "$docker_config"
DOCKER_CONFIG=$docker_config
export DOCKER_CONFIG
trap cleanup_registry_auth_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf '%s' "$registry_password" |
  docker login "$registry" \
    --username "$registry_username" \
    --password-stdin >/dev/null 2>&1 ||
  fail "registry authentication failed"
unset registry_username registry_password

docker pull "$image_digest" >/dev/null 2>&1 || fail "image pull failed"
docker image inspect "$image_digest" \
  --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null |
  grep -Fx "$image_digest" >/dev/null ||
  fail "pulled image digest does not match requested digest"

cleanup_registry_auth || fail "registry authentication cleanup failed"
trap - EXIT INT TERM

install -d -o root -g root -m 0750 "$release_root"
install -d -o 10001 -g 10001 -m 0750 "$data_root"

if test -f "$release_root/candidate"; then
  mv -f "$release_root/candidate" "$release_root/failed"
fi

if test -f "$release_root/current"; then
  test "$(wc -l <"$release_root/current")" -eq 2 ||
    fail "current release metadata is invalid"
  cp -p "$release_root/current" "$release_root/previous.tmp"
  mv -f "$release_root/previous.tmp" "$release_root/previous"
fi

candidate_tmp=$(mktemp "$release_root/.candidate.XXXXXX")
trap 'rm -f "$candidate_tmp"' EXIT INT TERM
printf '%s\n%s\n' "$image_digest" "$revision" >"$candidate_tmp"
chmod 0600 "$candidate_tmp"
mv -f "$candidate_tmp" "$release_root/candidate"
trap - EXIT INT TERM

if docker container inspect "$candidate_name" >/dev/null 2>&1; then
  docker container rm --force "$candidate_name" >/dev/null 2>&1
fi
if docker container inspect "$stable_name" >/dev/null 2>&1; then
  docker container rm --force "$stable_name" >/dev/null 2>&1
fi

docker run --detach \
  --name "$candidate_name" \
  --restart no \
  --read-only \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --user 10001:10001 \
  --env-file "$runtime_env_file" \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --mount "type=bind,source=$data_root,target=/data" \
  --mount "type=bind,source=$kubeconfig_file,target=$container_kubeconfig,readonly" \
  --label "org.opencontainers.image.revision=$revision" \
  "$image_digest" >/dev/null 2>&1 ||
  fail "release candidate failed to start"

printf 'Isolated release candidate started for revision %s; private origin is stopped pending smoke.\n' \
  "$revision"
