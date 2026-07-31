# AI interaction export manifest

Status: rolling export verified; final coordinator-session closure pending

The machine-readable [index](./index.json) is authoritative for every submitted
copy. It records purpose, exact session ID, full JSONL filename, redaction-report
filename, line count, SHA-256 checksum, completion state, and final review state.
The exact-head gate fails unless every submitted copy has `finalReview: pass` and
its ID, line count, checksum, and report reconcile.

## Verified rolling exports

- `31` stable persisted sessions have full derived JSONL copies under
  `sessions/` and matching machine redaction reports under `redactions/`.
- Input and output line counts match for every copy; no JSONL record was
  intentionally omitted.
- Automated review found and replaced credential-shaped values, sensitive-key
  values, private keys, kubeconfig material, personal email addresses, private
  topology/network values (including internal host and VM labels), and local
  paths, including paths stored as object keys.
- Repository secret scanning and explicit credential, private-network,
  internal-label, and local-path scans pass on the derived copies.
- These passes cover the submitted rolling copies only. They do not make an
  active or unavailable source complete.

## Active sessions held for closure

| Interaction                   | Session ID                             | State         |
| ----------------------------- | -------------------------------------- | ------------- |
| Primary DriftLens coordinator | `019fb403-ca02-7ea0-800a-3b873e3ba025` | `held-active` |
| #12 coordinator review        | `019fb926-109f-7a23-a7fe-6477f5fc57cf` | `held-active` |

Export these only after their final turns, then rerun the same ID, line,
checksum, redaction-report, secret-scan, and final-review gates.

## Recovered archived sources

The five previously unavailable exact IDs were recovered from the local Codex
archive. Their complete redacted copies now pass the same ID, line-count,
checksum, redaction-report, secret-scan, and final-review gates as the other
rolling exports. The interrupted duplicate is preserved as a partial task and
is not presented as a successful implementation.

## Reconciled exact-session inventory

- The #8 implementation owner is reconciled to
  `019fb4f6-2983-7302-8e37-b73f35e511ba`, and its separate read-only reviewer
  is reconciled to `019fb4f7-4857-7423-935b-de071135aebd`.
- The requested read-only #12 coordinator review is reconciled to session
  `019fb926-109f-7a23-a7fe-6477f5fc57cf`; its final export is intentionally
  held until this task closes.

No historical exact-session mapping remains pending.

## Final freeze actions

1. Stop functional changes and record the frozen source SHA.
2. Export the two held active sessions after closure.
3. Confirm the final index has no unavailable or pending-reconciliation entry.
4. Rerun `npm run verify:ai-exports` and `npm run secret:scan`.
5. Record any unresolved omission without claiming complete AI exports.
