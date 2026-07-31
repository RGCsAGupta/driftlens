# AI interaction export manifest

Status: final submission checkpoint prepared

The machine-readable [index](./index.json) is authoritative for every submitted
copy. It records purpose, exact session ID, full JSONL filename, redaction-report
filename, line count, SHA-256 checksum, completion state, and final review state.
The exact-head gate fails unless every submitted copy has `finalReview: pass` and
its ID, line count, checksum, and report reconcile.

## Verified rolling exports

- `33` persisted session records have full derived JSONL copies under
  `sessions/` and matching machine redaction reports under `redactions/`.
- Input and output line counts match for every copy; no JSONL record was
  intentionally omitted.
- Automated review found and replaced credential-shaped values, sensitive-key
  values, private keys, kubeconfig material, personal email addresses, private
  topology/network values (including internal host and VM labels), and local
  paths, including paths stored as object keys.
- Repository secret scanning and explicit credential, private-network,
  internal-label, and local-path scans pass on the derived copies.
- The Issue #3 coordinator export was captured after its task-complete record.
- The primary coordinator copy is an explicit pre-final-review checkpoint. Its
  raw source remains immutable and continues with the final review, approval,
  merge, and archival metadata; the final platform/account export captures that
  unavoidable post-checkpoint tail without creating a self-referential commit.

## Final coordinator checkpoint

The Issue #3 coordinator is complete and exported. The primary coordinator is
captured through the pre-final-review checkpoint. This boundary is explicit:
the repository copy contains every source record through that checkpoint, and
the unmodified raw source remains the authority for the later approval and
archive tail.

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
  `019fb926-109f-7a23-a7fe-6477f5fc57cf` and is included after task completion.

No historical exact-session mapping remains pending.

## Final freeze actions

1. Confirm the final index has no held, unavailable, or
   pending-reconciliation entry.
2. Rerun `npm run verify:ai-exports` and `npm run secret:scan`.
3. Preserve the unmodified raw platform/account export for the final
   post-checkpoint approval and archival tail.
