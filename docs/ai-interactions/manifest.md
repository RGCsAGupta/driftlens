# AI interaction export manifest

Status: partial rolling export; final freeze reconciliation pending

This manifest is both the human review index and the agent-readable source of
truth for submitted AI interactions. A `PASS` here proves only the stated
property. It does not make an active or unreviewed session complete.

## Submitted sessions

| Purpose                             | Source session ID                      | Relationship       | Status    | Submitted file                         | SHA-256                                                            | JSONL/line match | Final review |
| ----------------------------------- | -------------------------------------- | ------------------ | --------- | -------------------------------------- | ------------------------------------------------------------------ | ---------------- | ------------ |
| #12 documentation read-only audit   | `019fb868-da36-7251-b5e5-bf2448d1c492` | Child of #12 owner | Completed | `sessions/issue-12-docs-audit.jsonl`   | `1233b51392dfe21bcebe9efd35a60316c389453895b04eac5ca7131b626567d5` | PASS: 94/94      | PENDING      |
| #12 GitHub/evidence read-only audit | `019fb869-0231-7f40-908f-3c9e12957e3d` | Child of #12 owner | Completed | `sessions/issue-12-github-audit.jsonl` | `247bb40fe141b686695c3eb250ac32c491fd8db9ff3fd1e5a3001956423edde8` | PASS: 108/108    | PENDING      |

The source files remain unchanged. The submitted copies parse as JSONL, retain
the same line counts, and pass the automated prohibited-pattern checks. Final
human secret/context review remains pending; therefore these are not yet final
submission-complete exports.

## Redaction reports

Each report enumerates every replacement by JSONL line, JSON path, category,
and marker without reproducing the removed value.

| Submitted file                         | Report                                  | Replacements | Categories                                             |
| -------------------------------------- | --------------------------------------- | -----------: | ------------------------------------------------------ |
| `sessions/issue-12-docs-audit.jsonl`   | `redactions/issue-12-docs-audit.json`   |          117 | credential, local path, personal data, private network |
| `sessions/issue-12-github-audit.jsonl` | `redactions/issue-12-github-audit.json` |          116 | credential, local path, personal data, private network |

## Active sessions held from export

| Interaction                      | Known ID                               | Reason held                                    |
| -------------------------------- | -------------------------------------- | ---------------------------------------------- |
| Primary DriftLens coordinator    | `019fb403-ca02-7ea0-800a-3b873e3ba025` | Active; later turns would make an export stale |
| #12 submission-preparation owner | `019fb868-5297-7a82-b3f0-890aece9a970` | Active; current documentation/export work      |

## Archived export queue

These completed or delivered sessions are identified by exact session ID. They
remain queued because each still needs source-readability verification,
derived-copy generation, a redaction report, checksum reconciliation, and
final review; listing is not an export claim.

| Interaction                      | Source session ID                      | Review note                               |
| -------------------------------- | -------------------------------------- | ----------------------------------------- |
| Initial assessment planning      | `019fae4f-99bb-7a11-a6ef-e79a04312d50` | Planning checkpoint; export next          |
| Scope review                     | `019fb405-eafd-74d2-a692-5bd7c46a1c3b` | Completed child                           |
| Timebox review                   | `019fb405-fa05-7b93-87e9-972f3c4ae4f8` | Completed child                           |
| Infrastructure readiness audit   | `019fb448-2dfc-7cf1-bea0-989c8a64c4b0` | Requires additional topology review       |
| PRD review                       | `019fb460-0880-7f13-a8ea-ecebdd0772a8` | Completed child                           |
| Collaboration-contract audit     | `019fb495-0f03-75e0-b9b9-3727dfb3f558` | Completed child                           |
| PRD traceability audit           | `019fb495-2968-7791-b6df-7b29f6ffc098` | Completed child                           |
| Architecture traceability review | `019fb4aa-7180-7192-bdbd-9650c742c719` | Completed child                           |
| Architecture timebox review      | `019fb4aa-8c97-7203-9cb3-3e8def6c3da6` | Completed child                           |
| Delivery-pattern research        | `019fb4d3-22ca-7da1-a7ba-d88b20d61eff` | Requires unrelated-project data review    |
| #13 transient-registry diagnosis | `019fb711-70d0-72d1-92c3-3cd335b94b02` | Requires additional infrastructure review |
| #9 exact-head review             | `019fb71f-e7c6-7cc0-9ccc-032629ed941a` | Completed child                           |
| #17 repository-assets task       | `019fb82c-92e1-7772-a647-859a8702b032` | Completed child                           |
| #12 submission audit             | `019fb868-aaab-7a11-8daf-53e1af4f7020` | Completed child                           |
| #10 implementation owner         | `019fb86c-c3fc-7ac1-94f1-9fef99424dee` | Delivered; reconcile owner handoff        |
| #10 exact-head review            | `019fb875-e5c1-7c72-b213-a7750594cd34` | Delivered; completed child                |
| Release-evidence audit           | `019fb895-f59b-78f1-8639-2fbde220f90e` | Completed child                           |
| #11 user-facing delivery         | `019fb8bd-49b7-7b72-a751-53ccec952c51` | Delivered; source readability pending     |
| #11 user-facing delivery         | `019fb8c3-8ec5-70a0-81e1-ca904918da9f` | Delivered; source readability pending     |
| #11 implementation owner         | `019fb86c-432c-7c03-a755-536272766dfb` | Delivered; source readability pending     |
| #11 review child                 | `019fb8a1-9a1b-7070-8724-f1042b3d6a8c` | Delivered; source readability pending     |
| #11 review child                 | `019fb8a1-c1b2-73e3-a5ff-d68833c156f1` | Delivered; source readability pending     |

## Exact gaps

- The interrupted #12 duplicate task
  `019fb868-0ca0-7810-af7d-4d93258b8286` remains inventoried, but no persisted
  source file has been located. Do not invent a transcript or completeness
  result.
- Previously recorded #8/#9 task identifiers that do not map to a located
  first `session_meta` record require coordinator reconciliation.
- Final freeze must re-enumerate sources, add the sessions currently held,
  verify every parent/child relationship, complete human review, recompute all
  checksums, and rerun the repository secret scan.
