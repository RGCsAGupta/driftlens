#!/usr/bin/env bash
set -Eeuo pipefail

patterns=(
  'github_pat_[A-Za-z0-9_]{20,}'
  'gh[pousr]_[A-Za-z0-9_]{20,}'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'
)

for pattern in "${patterns[@]}"; do
  if git grep -nE "$pattern" -- \
    ':!package-lock.json' \
    ':!scripts/scan-secrets.sh'; then
    echo "Potential secret material found." >&2
    exit 1
  fi
done

echo "Secret-pattern scan passed."
