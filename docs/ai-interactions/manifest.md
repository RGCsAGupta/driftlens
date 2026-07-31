# AI interaction export manifest

Status: rolling export verified; active-session closure and unavailable-source
reconciliation pending

The machine-readable [index](./index.json) is authoritative for every submitted
copy. It records purpose, exact session ID, full JSONL filename, redaction-report
filename, line count, SHA-256 checksum, completion state, and final review state.
The exact-head gate fails unless every submitted copy has `finalReview: pass` and
its ID, line count, checksum, and report reconcile.

## Verified rolling exports

- `23` stable persisted sessions have full derived JSONL copies under
  `sessions/` and matching machine redaction reports under `redactions/`.
- Input and output line counts match for every copy; no JSONL record was
  intentionally omitted.
- Automated review found and replaced credential-shaped values, sensitive-key
  values, private keys, kubeconfig material, personal email addresses, private
  topology/network values, and local paths, including paths stored as object
  keys.
- Repository secret scanning and explicit credential, private-network, and
  local-path scans pass on the derived copies.
- These passes cover the submitted rolling copies only. They do not make an
  active or unavailable source complete.

## Active sessions held for closure

| Interaction                   | Session ID                             | State         |
| ----------------------------- | -------------------------------------- | ------------- |
| Primary DriftLens coordinator | `019fb403-ca02-7ea0-800a-3b873e3ba025` | `held-active` |
| #12 preparation owner         | `019fb868-5297-7a82-b3f0-890aece9a970` | `held-active` |
| #12 coordinator review        | `019fb926-109f-7a23-a7fe-6477f5fc57cf` | `held-active` |

Export these only after their final turns, then rerun the same ID, line,
checksum, redaction-report, secret-scan, and final-review gates.

## Unavailable persisted sources

| Interaction                            | Session ID                             | State                |
| -------------------------------------- | -------------------------------------- | -------------------- |
| #9 implementation owner                | `019fb60b-0b49-7891-a35d-44ecfb24b23d` | `unavailable-source` |
| #9 bounded reviewer                    | `019fb690-a184-7022-825d-90bc4907257b` | `unavailable-source` |
| #10 user-visible owner record          | `019fb85c-78bd-7b02-87f0-cb1376c6d0a3` | `unavailable-source` |
| #11 second user-facing delivery record | `019fb8c3-8ec5-70a0-81e1-ca904918da9f` | `unavailable-source` |
| Interrupted duplicate #12 task         | `019fb868-0ca0-7810-af7d-4d93258b8286` | `unavailable-source` |

No transcript or completion result is invented for these entries. Resolve them
from the final Codex/App or account archive if available; otherwise retain the
explicit omission state and explain the evidence impact.

## Pending exact-session reconciliation

- #8 owner and bounded reviewer remain parent-captured inventory only.
- The requested read-only #12 coordinator review has its delegated prompt,
  result, and owner review captured by the parent, but its exact delegated
  session mapping is not yet asserted.

Both entries remain pending. Parent capture is evidence of the interaction,
not proof of a separately persisted child transcript.

## Final freeze actions

1. Stop functional changes and record the frozen source SHA.
2. Export the three held active sessions after closure.
3. Reconcile unavailable and parent-captured entries against final archives.
4. Rerun `npm run verify:ai-exports` and `npm run secret:scan`.
5. Record any unresolved omission without claiming complete AI exports.
