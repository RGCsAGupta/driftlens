#!/bin/sh

runtime_env_file=/etc/driftlens/runtime.env
kubeconfig_file=/etc/driftlens/kubeconfig
origin_address_file=/etc/driftlens/origin-address
container_kubeconfig=/run/driftlens/kubeconfig

require_config_file() {
  config_label=$1
  config_file=$2
  expected_uid=$3
  expected_gid=$4
  expected_mode=$5

  test -f "$config_file" || fail "$config_label is not configured"
  test "$(stat -c '%u' "$config_file")" -eq "$expected_uid" ||
    fail "$config_label owner is invalid"
  test "$(stat -c '%g' "$config_file")" -eq "$expected_gid" ||
    fail "$config_label group is invalid"
  test "$(stat -c '%a' "$config_file")" = "$expected_mode" ||
    fail "$config_label mode is invalid"
}

validate_runtime_environment() {
  if grep -Ev '^($|#[^[:cntrl:]]*|[A-Z][A-Z0-9_]*=[^[:cntrl:]]*)$' \
    "$runtime_env_file" >/dev/null; then
    fail "runtime environment format is invalid"
  fi
  if cut -d= -f1 "$runtime_env_file" | grep -E '^[A-Z][A-Z0-9_]*$' |
    sort | uniq -d | grep -q .; then
    fail "runtime environment contains duplicate keys"
  fi
  grep -Fx 'NODE_ENV=production' "$runtime_env_file" >/dev/null ||
    fail "runtime environment mode is invalid"
  grep -Fx 'DRIFTLENS_DATA_DIR=/data' "$runtime_env_file" >/dev/null ||
    fail "runtime data directory is invalid"
  grep -Fx "DRIFTLENS_KUBECONFIG_PATH=$container_kubeconfig" \
    "$runtime_env_file" >/dev/null ||
    fail "runtime kubeconfig path is invalid"
  github_repository=$(sed -n 's/^DRIFTLENS_GITHUB_REPOSITORY=//p' "$runtime_env_file")
  printf '%s' "$github_repository" |
    grep -Eq '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' ||
    fail "runtime GitHub repository is invalid"
  manifest_path=$(sed -n 's/^DRIFTLENS_MANIFEST_PATH=//p' "$runtime_env_file")
  test -n "$manifest_path" ||
    fail "runtime manifest path is invalid"
  test "${#manifest_path}" -le 500 ||
    fail "runtime manifest path is invalid"
  case "$manifest_path" in
    /* | *\\* | */ | *//*)
      fail "runtime manifest path is unsafe"
      ;;
  esac
  if printf '%s' "$manifest_path" |
    grep -Eq '(^|/)\.{1,2}(/|$)'; then
    fail "runtime manifest path is unsafe"
  fi
  kubeconfig_context=$(sed -n 's/^DRIFTLENS_KUBECONTEXT=//p' "$runtime_env_file")
  if test -n "$kubeconfig_context"; then
    test "$(printf '%s' "$kubeconfig_context" | wc -m)" -le 253 ||
      fail "runtime kubeconfig context is invalid"
  fi
  if grep -Eq '^(DRIFTLENS_BUILD_SHA|HOSTNAME|PORT)=' "$runtime_env_file"; then
    fail "runtime environment overrides an immutable setting"
  fi
}

validate_kubeconfig_content() {
  grep -Fx 'apiVersion: v1' "$kubeconfig_file" >/dev/null ||
    fail "kubeconfig API version is invalid"
  grep -Fx 'kind: Config' "$kubeconfig_file" >/dev/null ||
    fail "kubeconfig kind is invalid"
  if grep -Eq '^[[:space:]]*['"'"'"]|^[[:space:]]*\?[[:space:]]|[{}]|^[[:space:]]*---([[:space:]]*(#.*)?)?$|(^|[[:space:]])[&*!][^[:space:]]*|(^|[[:space:]])(certificate-authority|client-certificate|client-key|tokenFile|exec|auth-provider)[[:space:]]*:' \
    "$kubeconfig_file"; then
    fail "kubeconfig must use flattened block-style YAML"
  fi
}

validate_private_ipv4() {
  printf '%s' "$origin_address" |
    grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' ||
    return 1

  saved_ifs=$IFS
  IFS=.
  set -- $origin_address
  IFS=$saved_ifs

  test "$#" -eq 4 || return 1
  for octet in "$@"; do
    case "$octet" in
      "" | *[!0-9]*)
        return 1
        ;;
      0)
        ;;
      0*)
        return 1
        ;;
    esac
    test "$octet" -le 255 || return 1
  done

  case "$1" in
    10)
      return 0
      ;;
    172)
      test "$2" -ge 16 && test "$2" -le 31
      return
      ;;
    192)
      test "$2" -eq 168
      return
      ;;
  esac

  return 1
}

validate_origin_address() {
  test "$(wc -l <"$origin_address_file")" -eq 1 ||
    fail "private origin address must contain one line"
  origin_address=$(sed -n '1p' "$origin_address_file")
  validate_private_ipv4 ||
    fail "private origin address is invalid"
}

validate_runtime_files() {
  require_config_file "runtime environment" "$runtime_env_file" 0 0 600
  require_config_file "kubeconfig" "$kubeconfig_file" 0 1001 440
  require_config_file "private origin address" "$origin_address_file" 0 0 600

  validate_runtime_environment
  validate_kubeconfig_content
  validate_origin_address
}
