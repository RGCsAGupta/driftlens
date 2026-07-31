# AI evidence redaction manifest template

Status: template only; do not mark complete before functional code freeze.

## Session and submission manifest

| Purpose           | Source session ID | Parent/delegation              | Interaction status                          | Submitted file               | SHA-256           | Parse result | Completeness | Redactions        |
| ----------------- | ----------------- | ------------------------------ | ------------------------------------------- | ---------------------------- | ----------------- | ------------ | ------------ | ----------------- |
| Replace at freeze | Replace at freeze | Root, child, reviewer, or none | Completed, interrupted, or active-at-freeze | `sessions/<safe-name>.jsonl` | Replace at freeze | PENDING      | PENDING      | See entries below |

## Export procedure

1. Freeze functional code at one exact SHA. Any later functional change reopens
   affected gates and reconciliation.
2. Copy each original `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl` into a
   private staging area without changing the source.
3. Parse each staged file, read its `session_meta` identifier, and map it to
   exactly one inventory row plus its parent/delegation relationship.
4. Reconcile prompt, interaction, output, owner review, corrections, final
   outcome, and interrupted work whose output influenced delivery.
5. Secret-review a derived copy. Apply explicit markers only in that copy. A
   generated redaction report may enumerate every replacement by line and JSON
   path; summarize that report below without reproducing removed values.
6. Place reviewed copies under `docs/ai-interactions/sessions/`, compute SHA-256
   checksums, then run manifest/file reconciliation and the final secret scan.

Never publish original private staging paths, missing-session guesses, or a
summary in place of an available full interaction.

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
