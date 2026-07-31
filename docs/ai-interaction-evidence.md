# AI interaction evidence procedure

The engineering assessment requires complete, secret-safe AI interaction
exports. A summary is not a substitute for an available full transcript.

## Inventory

| Interaction                              | Purpose                                                            | Export state                                                               |
| ---------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Primary DriftLens coordinator task       | Planning, specifications, reviews, and implementation coordination | Persisted session verified; inventory ID in final manifest                 |
| Issue #8 user-visible feature-owner task | Foundation review, correction, runtime proof, and publication      | Persisted session verified; inventory ID in final manifest                 |
| Issue #8 bounded read-only reviewer      | Independent scaffold review                                        | Prompt, result, and owner synthesis retained; ID in final manifest         |
| Issue #9 user-visible feature-owner task | Scan, persistence, API implementation, tests, review, publication  | Persisted session `019fb60b-0b49-7891-a35d-44ecfb24b23d`; reconcile in #12 |
| Issue #9 bounded read-only reviewer      | Independent scanner-slice correctness and security review          | Persisted session `019fb690-a184-7022-825d-90bc4907257b`; reconcile in #12 |
| Architecture review agents               | Traceability and timebox review                                    | Inventory and reconcile each persisted delegated session                   |
| Restaurant OS read-only audit agent      | Read-only delivery-pattern research                                | Inventory and reconcile the persisted delegated session                    |

## Preflight result

Preflight passed on 2026-07-30. The user confirmed that all project Codex
sessions can be preserved at final delivery. Persisted session JSONL files were
verified for the coordinator, issue #8 feature owner, and its bounded reviewer.
Files use this portable pattern:

```text
$CODEX_HOME/sessions/YYYY/MM/DD/rollout-...jsonl
```

Codex App Server thread enumeration and full-turn reads provide backup
verification. ChatGPT account export is a secondary completeness check for
ChatGPT history, not the primary Codex session-preservation mechanism.

## Code-freeze handoff

Issue
[#12](https://github.com/RGCsAGupta/driftlens/issues/12) owns the final session
export gate after functional code freeze at an exact commit SHA. Issue #8
records the verified procedure and current-session inventory only; it does not
add raw session files or derived exports.

At code freeze, issue #12 will:

1. At final freeze, inventory every project-related user-facing and delegated
   session ID in the evidence manifest.
2. Stage each original
   `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl` privately without changing
   the persisted source.
3. Validate every staged JSONL is readable and maps to its inventoried session,
   including parent and delegated-session relationships.
4. Reconcile every delegation prompt, result, owner review, correction, and
   final outcome, including the issue #8 reviewer, against those staged
   originals.
5. Create secret-reviewed derived submission copies under
   `docs/ai-interactions/sessions/`. Never alter the persisted originals or
   silently omit an interaction.
6. Scan derived copies for credentials, tokens, kubeconfig content, internal
   addresses, private hostnames, and unrelated personal data.
7. Replace sensitive content only with an explicit redaction marker and record
   the reason.
8. Create `docs/ai-interactions/manifest.md` recording each interaction's
   purpose, session ID, submitted file, checksum, completeness result, and
   explicit redactions.
9. Use App Server `thread/list` and `thread/read` with `includeTurns: true`, or
   account export, as backup completeness checks.
10. Rerun the repository secret scan against the final derived evidence.

## Rolling export for completed sessions

The user authorized a partial rolling export before final freeze. Export only
a completed, stable persisted session. Keep the primary coordinator, the
current #12 owner, and any feature lane still receiving turns as inventory-only
until those sessions close.

Run the checked-in exporter against a privately resolved source path:

```bash
npm run export:ai-session -- \
  /private/source/rollout-SESSION_ID.jsonl \
  SESSION_ID \
  docs/ai-interactions/sessions/safe-name.jsonl \
  docs/ai-interactions/redactions/safe-name.json
```

The exporter fails closed on unreadable/invalid JSONL and an ID mismatch. It
retains every JSONL record and recursively replaces recognized credentials,
key/kubeconfig material, personal email addresses, private network/topology
values, and local paths. Its machine report records every replacement locator
without the removed value.

Automation is not the final review. After generation:

1. verify every output line parses and input/output line counts match;
2. run prohibited credential, private-network, and personal-data scans;
3. review remaining URLs, hostnames, identifiers, prompts, tool output, and
   unrelated context manually;
4. record the checksum and review state in
   `docs/ai-interactions/manifest.md`; and
5. leave `Final review` as `PENDING` until a human completes that review.

At final freeze, repeat source enumeration and checksum/reconciliation for all
rolling exports. A rolling copy never substitutes for the final active-session
export.

## Official sources

- [Codex App Server](https://learn.chatgpt.com/docs/app-server.md)
- [Exporting your ChatGPT history and data](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)
