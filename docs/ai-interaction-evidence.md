# AI interaction evidence procedure

The engineering assessment requires complete, secret-safe AI interaction
exports. A summary is not a substitute for an available full transcript.

## Inventory

| Interaction                  | Purpose                                                            | Export state                                                                                     |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Primary DriftLens Codex task | Planning, specifications, reviews, and implementation coordination | Export at submission                                                                             |
| Architecture review agents   | Traceability and timebox review                                    | Preserve parent prompt/result and export complete delegated records when the client exposes them |
| Restaurant OS audit agent    | Read-only delivery-pattern research                                | Preserve parent prompt/result and export complete delegated records when the client exposes them |

## Preflight result

Product implementation remains in the primary task until the Codex client
export is verified to contain complete delegated-agent interactions or an
equivalent complete per-agent export is available. Read-only review agents may
still provide bounded second opinions whose prompts and results are retained in
the primary transcript.

This is an open submission-evidence gate, not a product-runtime blocker.

## Export and review procedure

1. Export every user-facing Codex task in full.
2. Export every delegated-agent interaction in full when separately available.
3. Reconcile each delegation in the primary transcript to an exported record.
4. Scan exports for credentials, tokens, kubeconfig content, internal
   addresses, private hostnames, and unrelated personal data.
5. Replace sensitive content only with an explicit redaction marker and record
   the reason; never silently omit an interaction.
6. Record any client export limitation as a submission blocker.
