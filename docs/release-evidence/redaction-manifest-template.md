# AI evidence redaction manifest template

Status: template only; do not mark complete before functional code freeze.

## Submission file manifest

| Purpose           | Source session ID | Submitted file               | SHA-256           | Parse result | Completeness | Redactions        |
| ----------------- | ----------------- | ---------------------------- | ----------------- | ------------ | ------------ | ----------------- |
| Replace at freeze | Replace at freeze | `sessions/<safe-name>.jsonl` | Replace at freeze | PENDING      | PENDING      | See entries below |

## Redaction entries

Record one row per replacement. Never reproduce the removed value.

| Submitted file    | JSONL line/event locator | Marker                 | Reason                                                                                        | Reviewer result |
| ----------------- | ------------------------ | ---------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| Replace at freeze | Replace at freeze        | `[REDACTED: CATEGORY]` | Credential, kubeconfig, private topology, unrelated personal data, or other approved category | PENDING         |

## Required review

- [ ] Original persisted source remains unchanged.
- [ ] Derived copy parses as JSONL.
- [ ] Session ID matches exactly one inventory entry.
- [ ] Every prompt, result, correction, and owner synthesis is retained.
- [ ] Credentials, tokens, kubeconfigs, private hosts/addresses, internal
      runner/registry details, and unrelated personal data were reviewed.
- [ ] Each replacement has one manifest entry without sensitive content.
- [ ] SHA-256 was calculated after redaction.
- [ ] Final repository secret scan passes.
- [ ] Manifest-to-file reconciliation passes with no orphan or duplicate entry.
