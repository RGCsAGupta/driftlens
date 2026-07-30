# AI interaction evidence procedure

The engineering assessment requires complete, secret-safe AI interaction
exports. A summary is not a substitute for an available full transcript.

## Inventory

| Interaction                              | Purpose                                                            | Export state                                                       |
| ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Primary DriftLens coordinator task       | Planning, specifications, reviews, and implementation coordination | Persisted session verified; inventory ID in final manifest         |
| Issue #8 user-visible feature-owner task | Foundation review, correction, runtime proof, and publication      | Persisted session verified; inventory ID in final manifest         |
| Issue #8 bounded read-only reviewer      | Independent scaffold review                                        | Prompt, result, and owner synthesis retained; ID in final manifest |
| Architecture review agents               | Traceability and timebox review                                    | Inventory and reconcile each persisted delegated session           |
| Restaurant OS read-only audit agent      | Read-only delivery-pattern research                                | Inventory and reconcile the persisted delegated session            |

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

## Official sources

- [Codex App Server](https://learn.chatgpt.com/docs/app-server.md)
- [Exporting your ChatGPT history and data](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)
