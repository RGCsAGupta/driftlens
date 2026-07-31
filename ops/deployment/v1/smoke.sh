#!/bin/sh

set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

candidate_name=driftlens-candidate
stable_name=driftlens
release_root=/var/lib/driftlens/releases
data_root=/var/lib/driftlens/data

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

. /usr/local/libexec/driftlens/v1/common.sh

test "$(id -u)" -eq 0 || fail "smoke requires root"
test "$#" -eq 1 || fail "usage: driftlens-smoke <revision>"

expected_revision=$1
printf '%s' "$expected_revision" | grep -Eq '^[0-9a-f]{40}$' ||
  fail "revision must be a full Git SHA"
validate_runtime_files

test -f "$release_root/candidate" || fail "release candidate metadata is missing"
test "$(wc -l <"$release_root/candidate")" -eq 2 ||
  fail "release candidate metadata is invalid"
candidate_image=$(sed -n '1p' "$release_root/candidate")
candidate_revision=$(sed -n '2p' "$release_root/candidate")
test "$candidate_revision" = "$expected_revision" ||
  fail "release candidate revision does not match"

validate_container() {
  checked_name=$1

  test "$(docker container inspect "$checked_name" --format '{{.Config.Image}}' 2>/dev/null)" = \
    "$candidate_image" || return 1
  test "$(docker container inspect "$checked_name" --format '{{.Config.User}}' 2>/dev/null)" = \
    1001:1001 || return 1
  test "$(docker container inspect "$checked_name" --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null)" = \
    true || return 1
  docker container inspect "$checked_name" \
    --format '{{json .HostConfig.SecurityOpt}}' 2>/dev/null |
    grep -F 'no-new-privileges' >/dev/null || return 1
  docker container inspect "$checked_name" \
    --format '{{json .HostConfig.CapDrop}}' 2>/dev/null |
    grep -F 'ALL' >/dev/null || return 1
  test "$(docker container inspect "$checked_name" \
    --format '{{range .Mounts}}{{if eq .Destination "/run/driftlens/kubeconfig"}}{{.RW}}{{end}}{{end}}' \
    2>/dev/null)" = false || return 1

  attempt=0
  until docker exec "$checked_name" node -e \
    "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  do
    attempt=$((attempt + 1))
    test "$attempt" -lt 10 || return 1
    sleep 1
  done

  docker exec --env "EXPECTED_SHA=$expected_revision" "$checked_name" node -e '
const expected = process.env.EXPECTED_SHA;
const base = "http://127.0.0.1:3000/api";
Promise.all(["health", "ready", "version"].map(async (endpoint) => {
  const response = await fetch(`${base}/${endpoint}`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`${endpoint} request failed`);
  return [endpoint, await response.json()];
})).then((entries) => {
  const result = Object.fromEntries(entries);
  if (result.health.service !== "driftlens" || result.health.status !== "ok") {
    throw new Error("health payload mismatch");
  }
  if (
    result.ready.service !== "driftlens" ||
    result.ready.status !== "ready" ||
    result.ready.checks?.configuration !== "pass" ||
    result.ready.issues?.length !== 0
  ) {
    throw new Error("readiness payload mismatch");
  }
  if (result.version.service !== "driftlens" || result.version.buildSha !== expected) {
    throw new Error("version payload mismatch");
  }
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
'
}

if ! validate_container "$candidate_name"; then
  docker container rm --force "$candidate_name" >/dev/null 2>&1 || true
  fail "isolated release candidate smoke failed; private origin remains stopped"
fi

docker container rm --force "$candidate_name" >/dev/null 2>&1
stable_pending=1
cleanup_unverified_origin() {
  if test "$stable_pending" -eq 1; then
    docker container rm --force "$stable_name" >/dev/null 2>&1 || true
  fi
}
trap cleanup_unverified_origin EXIT INT TERM
docker run --detach \
  --name "$stable_name" \
  --restart unless-stopped \
  --read-only \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --user 1001:1001 \
  --env-file "$runtime_env_file" \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --mount "type=bind,source=$data_root,target=/data" \
  --mount "type=bind,source=$kubeconfig_file,target=$container_kubeconfig,readonly" \
  --publish "$origin_address:3000:3000" \
  --label "org.opencontainers.image.revision=$expected_revision" \
  "$candidate_image" >/dev/null 2>&1 ||
  fail "verified image failed to start on private origin"

if ! validate_container "$stable_name"; then
  fail "private origin smoke failed; private origin remains stopped"
fi

mv -f "$release_root/candidate" "$release_root/current"
stable_pending=0
trap - EXIT INT TERM
printf 'Private smoke passed for revision %s.\n' "$expected_revision"
