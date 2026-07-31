#!/bin/sh

set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

install_root=/usr/local/libexec/driftlens/v1
state_root=/var/lib/driftlens
repository_file=/etc/driftlens/image-repository
sudoers_file=/etc/sudoers.d/driftlens-deploy

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

test "$(id -u)" -eq 0 || fail "bootstrap requires root"
test "$#" -eq 1 || fail "usage: bootstrap.sh <existing-deploy-user>"

deploy_user=$1
printf '%s' "$deploy_user" | grep -Eq '^[a-z_][a-z0-9_-]*$' ||
  fail "invalid deployment user"
id "$deploy_user" >/dev/null 2>&1 || fail "deployment user must already exist"
test "$(id -u "$deploy_user")" -ne 0 ||
  fail "deployment user must be non-root"
if id -nG "$deploy_user" | grep -Eq '(^| )(docker|sudo|wheel)( |$)'; then
  fail "deployment user must not have a privileged group"
fi

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v visudo >/dev/null 2>&1 || fail "visudo is required"
docker info >/dev/null 2>&1 || fail "docker daemon is unavailable"

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

script_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

install -d -o root -g root -m 0755 "$install_root"
install -d -o root -g root -m 0750 "$state_root/releases"
install -d -o 1001 -g 1001 -m 0750 "$state_root/data"
install -o root -g root -m 0755 "$script_root/release.sh" "$install_root/release.sh"
install -o root -g root -m 0755 "$script_root/smoke.sh" "$install_root/smoke.sh"
ln -sfn "$install_root/release.sh" /usr/local/sbin/driftlens-release
ln -sfn "$install_root/smoke.sh" /usr/local/sbin/driftlens-smoke

sudoers_tmp=$(mktemp "$state_root/.sudoers.XXXXXX")
trap 'rm -f "$sudoers_tmp"' EXIT INT TERM
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/driftlens-release *, /usr/local/sbin/driftlens-smoke *\n' \
  "$deploy_user" >"$sudoers_tmp"
chmod 0440 "$sudoers_tmp"
visudo -cf "$sudoers_tmp" >/dev/null
install -o root -g root -m 0440 "$sudoers_tmp" "$sudoers_file"
rm -f "$sudoers_tmp"
trap - EXIT INT TERM

printf 'DriftLens deployment contract v1 installed.\n'
