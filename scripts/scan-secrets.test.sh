#!/usr/bin/env bash
set -Eeuo pipefail

scanner_test_dir="$(mktemp -d)"

cleanup() {
  rm -rf -- "$scanner_test_dir"
}
trap cleanup EXIT

mkdir -p "$scanner_test_dir/scripts"
cp scripts/scan-secrets.sh "$scanner_test_dir/scripts/scan-secrets.sh"
chmod +x "$scanner_test_dir/scripts/scan-secrets.sh"

git -C "$scanner_test_dir" init -q
printf '%s\n' "safe fixture" >"$scanner_test_dir/fixture.txt"
git -C "$scanner_test_dir" add scripts/scan-secrets.sh fixture.txt

if ! (cd "$scanner_test_dir" && ./scripts/scan-secrets.sh) >/dev/null; then
  echo "Scanner rejected safe fixture." >&2
  exit 1
fi

assert_rejected() {
  local label="$1"
  local candidate="$2"

  printf '%s\n' "$candidate" >"$scanner_test_dir/fixture.txt"
  git -C "$scanner_test_dir" add fixture.txt

  if (cd "$scanner_test_dir" && ./scripts/scan-secrets.sh) >/dev/null 2>&1; then
    echo "Scanner accepted $label fixture." >&2
    exit 1
  fi
}

github_candidate="$(printf 'github_%s%s' 'pat_' 'AAAAAAAAAAAAAAAAAAAAAAAA')"
openai_candidate="$(printf 'sk-%s%s' 'proj-' 'bbbbbbbbbbbbbbbbbbbbbbbb')"

assert_rejected "GitHub fine-grained token" "$github_candidate"
assert_rejected "OpenAI project key" "$openai_candidate"

echo "Secret scanner regression tests passed."
