# Submission preparation evidence

Status: preparation only; not release evidence complete

Issue: [#12](https://github.com/RGCsAGupta/driftlens/issues/12)

Evidence base: `d8cf01eac14384ffbff65b9d5b705537ae03f96d`

Recorded: `2026-07-31T14:59:24Z`

This document records public-safe evidence available after issue #10 merged and
before issue #11 completed. `PENDING` means the requirement must not be claimed
in the submission.
No private endpoint, hostname, identity, credential, kubeconfig value, or image
digest belongs in this file.

## Release checkpoint

| Prerequisite                  | State   | Evidence or blocker                                                                                                   |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| #8 foundation                 | PASS    | PR [#14](https://github.com/RGCsAGupta/driftlens/pull/14), merge `c06562f004c30714dfd7eb799b43e0239ad9d719`           |
| #13 trusted delivery          | PASS    | PR [#15](https://github.com/RGCsAGupta/driftlens/pull/15), merge `43fc8fbb19d0a3709e6588e544e7d57d533556b4`           |
| #17 demo-cluster prerequisite | PASS    | PR [#18](https://github.com/RGCsAGupta/driftlens/pull/18), merge `96074e9c0373df37640378aba23eb4870c86feca`           |
| #9 deterministic scan         | PASS    | PR [#16](https://github.com/RGCsAGupta/driftlens/pull/16), merge `fb1bea1a8f359c8c52f32dbaa9a6e4e125e16965`           |
| #10 operator UI               | PASS    | PR [#20](https://github.com/RGCsAGupta/driftlens/pull/20), merge `d8cf01eac14384ffbff65b9d5b705537ae03f96d`           |
| #11 AI explanation            | PENDING | [Issue #11](https://github.com/RGCsAGupta/driftlens/issues/11) open; do not claim explanation proof                   |
| User-selected domain          | PENDING | No approved hostname recorded in #12; do not guess one                                                                |
| Server-side OpenAI preflight  | PENDING | No current server-side preflight evidence; no secret value was inspected or printed                                   |
| Session source readability    | PARTIAL | Candidate files found; final mapping, derived exports, and secret review wait for code freeze                         |
| #12 continuation authority    | PASS    | Prior conservative charge is `6m00s`; user explicitly authorized immediate continuation without another time approval |

Go/no-go result: **NO-GO for release execution**. Continue only preparation
that does not conflict with #11. Recalculate this table after #11 merges.

## Assessment deliverable matrix

| Deliverable                      | State    | Retained or required evidence                                                                          |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Public repository and final SHA  | PARTIAL  | Repository is public; final submitted SHA waits for code freeze                                        |
| Working UI and backend workflow  | PARTIAL  | #9 API and #10 UI/private deploy passed; integrated real-cluster demo pending                          |
| Persistence and graceful failure | PARTIAL  | #9 tests and CI retained; final demo failure/recovery pending                                          |
| Clean-clone setup                | PENDING  | Run from isolated checkout after feature freeze                                                        |
| Comprehensive README             | PARTIAL  | Setup, UI, API, persistence, testing, security, and limitations exist; AI/demo/final rationale pending |
| Architecture overview            | PARTIAL  | `docs/architecture.md` exists; release/domain wording audit below                                      |
| Design decisions and trade-offs  | PARTIAL  | PRD and architecture carry decisions; consolidated reviewer path pending                               |
| Next-work writeup                | PARTIAL  | PRD/architecture scope mapped below; final production-hardening summary pending                        |
| Meaningful Git history           | PARTIAL  | Merge and bounded correction history recorded below; final review pending                              |
| Full quality pyramid             | PARTIAL  | Exact-main CI passed through #10; #11/final-head CI pending                                            |
| Read-only RBAC proof             | PASS     | Sanitized #17 live proof retained below                                                                |
| CI/deployment links              | PARTIAL  | Exact-main private deployment through #10 retained; final release pending                              |
| Protected-domain proof           | PENDING  | Requires user-selected domain and approved route                                                       |
| Complete AI exports              | PENDING  | Inventory starts below; export occurs only after functional freeze                                     |
| Screenshots or recording         | OPTIONAL | Capture last only if time remains and secret review passes                                             |
| Known risks/failed gates         | PARTIAL  | Current blockers and prior CI failure are recorded below                                               |

## Exact revision and CI/deployment evidence

| Slice              | Source head                                | Merge SHA                                  | Authoritative evidence                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Governance         | `39edb29d633a5b84abebdb07c81ef17c40883659` | `27b2b08e039063ec6da7c5c00dd32510ed93b30b` | PR [#2](https://github.com/RGCsAGupta/driftlens/pull/2)                                                                                                                                                                                                                                                |
| Architecture       | `76ab0237e1f61d3adf1b75ff289177bece1a4b35` | `89d99f461ddb1c3620a68117c12e9e8cee530217` | PR [#7](https://github.com/RGCsAGupta/driftlens/pull/7)                                                                                                                                                                                                                                                |
| Foundation         | `317f19a3f948ba00a6d4fd2dd8003a031b4d7a6a` | `c06562f004c30714dfd7eb799b43e0239ad9d719` | PR [#14](https://github.com/RGCsAGupta/driftlens/pull/14)                                                                                                                                                                                                                                              |
| Trusted delivery   | `8c5e7df44cf9425bade3929da824459e87e2d1e3` | `43fc8fbb19d0a3709e6588e544e7d57d533556b4` | [Main run 30631735176](https://github.com/RGCsAGupta/driftlens/actions/runs/30631735176) succeeded                                                                                                                                                                                                     |
| Demo cluster       | `3b5b6607bd9286bde974869be8f2d659d40fdb6d` | `96074e9c0373df37640378aba23eb4870c86feca` | [Main run 30634458368](https://github.com/RGCsAGupta/driftlens/actions/runs/30634458368) and private release succeeded                                                                                                                                                                                 |
| Deterministic scan | `80ef4c84ec32c4b38351644198c524f2e7e29f9f` | `fb1bea1a8f359c8c52f32dbaa9a6e4e125e16965` | [Main run 30635279699](https://github.com/RGCsAGupta/driftlens/actions/runs/30635279699): [verify](https://github.com/RGCsAGupta/driftlens/actions/runs/30635279699/job/91171192064) and [private release](https://github.com/RGCsAGupta/driftlens/actions/runs/30635279699/job/91171711853) succeeded |
| Operator console   | `76c3a2aeed4816106f62830c3b704a0a5c85b744` | `d8cf01eac14384ffbff65b9d5b705537ae03f96d` | [Main run 30639327549](https://github.com/RGCsAGupta/driftlens/actions/runs/30639327549): [verify](https://github.com/RGCsAGupta/driftlens/actions/runs/30639327549/job/91184933285) and [private release](https://github.com/RGCsAGupta/driftlens/actions/runs/30639327549/job/91185514520) succeeded |

The main-run private-release jobs prove immutable publication, private deploy,
health, readiness, exact-version smoke, and transient credential cleanup. They
do not prove a Cloudflare-protected domain response.

Formal-gate exception: user direction in [#12](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5143389244)
makes trusted exact-head CI authoritative for lint, type, unit, build, audit,
scanner, and secret gates. Local full-suite duplication is intentionally
omitted. Missing or red exact-head CI still blocks readiness.

## Active-development ledger

Only implementation, correction, and verification activity counts. Planning,
read-only review, approval waits, CI waits, idle time, and wall-clock gaps do
not count.

| Lane |            Active time | Status/source                                                               |
| ---- | ---------------------: | --------------------------------------------------------------------------- |
| #9   | approximately `61m02s` | Final corrected issue comment; includes approved OpenAPI amendment          |
| #10  |               `24m05s` | Final issue-owner checkpoint; delivered through protected main              |
| #11  | approximately `10m00s` | Initial target consumed; owner findings remain before publication           |
| #17  |               `24m00s` | Final acceptance checkpoint; combined #17/#12 cap unchanged                 |
| #12  |   `6m00s` prior charge | Continuation explicitly authorized; current segment recorded at publication |
| #8   |              RECONCILE | Exact active-only total not yet consolidated here                           |
| #13  |              RECONCILE | Exact active-only total not yet consolidated here                           |

Do not infer missing totals from commit timestamps or PR age. Final ledger must
sum authoritative issue-owner handoffs against the 240-active-minute ceiling.
The parent records one `65m39s` implementation/review window spanning #8
completion while #13 was active, with parallel work counted once; it is not a
defensible per-issue total. The original target was `12m00s` for each lane.

## Live cluster and RBAC proof

Issue #17 retained one public-safe controlled proof before merge:

- named single-node cluster health passed;
- authenticated named Deployment `get` passed;
- Deployment `list`, `watch`, and `create` were denied;
- unrelated Secret `get` was denied;
- generated kubeconfig was self-contained, installed read-only, and used by the
  application target for a named Deployment read;
- no cluster endpoint, token, certificate, host identity, or kubeconfig content
  was retained in public evidence.

Source: [#17 final acceptance checkpoint](https://github.com/RGCsAGupta/driftlens/issues/17#issuecomment-5143333852)
and [merge/delivery checkpoint](https://github.com/RGCsAGupta/driftlens/issues/17#issuecomment-5143401361).

## Bounded demo runbook

Run only after #11 merges, final configuration is reconciled, and the go/no-go
table passes.

Clean-clone preparation:

```bash
git clone https://github.com/RGCsAGupta/driftlens.git
cd driftlens
git checkout --detach FROZEN_FUNCTIONAL_SHA
test "$(git rev-parse HEAD)" = "FROZEN_FUNCTIONAL_SHA"
npm ci
```

`FROZEN_FUNCTIONAL_SHA` remains pending. On the authorized demo host, follow
`docs/demo-cluster.md` for pinned tool installation, bootstrap, and sanitized
RBAC verification. Replace README configuration examples only with approved
public source metadata and a private absolute kubeconfig path; never paste
kubeconfig content or private topology into evidence.

1. Start from a clean clone of the frozen functional SHA; install pinned
   prerequisites and dependencies.
2. Bootstrap/verify the named disposable cluster using
   `docs/demo-cluster.md`; retain only sanitized verifier output.
3. Start DriftLens outside the cluster using the read-only kubeconfig and the
   public desired-state source.
4. Prove `IN_SYNC` with matching replicas and image.
5. Mutate the disposable live workload through the explicit demo operator path;
   prove `DRIFTED` with exact replica and image differences.
6. Delete the disposable live Deployment; prove `MISSING_LIVE`.
7. Introduce one bounded invalid source/access failure; retain actionable
   history; restore configuration and run a new successful scan. Do not call
   this retry.
8. Manually request one sanitized AI explanation for a completed drift outcome;
   confirm deterministic scan truth is unchanged.
9. Prove the DriftLens credential still denies mutation while named read works.
10. After approved main merge, retain exact private and protected-domain
    health/readiness/version proof. Confirm direct-origin bypass is unavailable.
11. Tear down only the named disposable cluster after evidence is retained.

Retain for each scenario: frozen SHA, start request, terminal scan identifier,
stage history, deterministic outcome or safe error code, and one secret-reviewed
UI/API proof. The repository now prepares a public desired manifest plus
bounded, idempotent scenario and named teardown commands. They remain unproven
against the live demo cluster until #11 is delivered and the frozen source is
deployed. Other blockers are the #11 explanation path and final configuration
values.

Official operator references: [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/),
[kubectl auth can-i](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_auth/kubectl_auth_can-i/),
and [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## Git-history evidence

History through #10 shows separate conventional commits for scope, governance,
architecture, application foundation, delivery controls, demo-cluster setup,
scan implementation, API documentation, operator UI, CI/E2E corrections, and
merge boundaries. PR #20 preserves its reviewed head
`76c3a2aeed4816106f62830c3b704a0a5c85b744` and main merge
`d8cf01eac14384ffbff65b9d5b705537ae03f96d`. Final audit must verify:

- every implementation issue maps to one bounded PR and merge;
- corrective commits remain visible instead of being erased;
- no unrelated or secret-bearing file appears in the submitted history;
- final feature, evidence-only, and release SHAs are distinguished;
- #11 and #12 links are added after their merges.

## AI interaction inventory

These entries identify required roles, not completed exports. Session source
files remain private until code freeze and secret review.

| Interaction                         | Known ID                                                         | State                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Primary DriftLens coordinator       | `019fb403-ca02-7ea0-800a-3b873e3ba025`                           | Source file found; final mapping/review pending                                                                 |
| #12 submission-preparation owner    | `019fb868-5297-7a82-b3f0-890aece9a970`                           | Active; export forbidden before completion/freeze                                                               |
| #12 duplicate preparation task      | `019fb868-0ca0-7810-af7d-4d93258b8286`                           | Interrupted and archived before completion; no final result claimed; inventory/export any used partial evidence |
| #12 documentation read-only audit   | `019fb868-da36-7251-b5e5-bf2448d1c492`                           | Completed; prompt/result/owner synthesis retained; export pending freeze                                        |
| #12 GitHub/evidence read-only audit | `019fb869-0231-7f40-908f-3c9e12957e3d`                           | Completed; prompt/result/owner synthesis retained; export pending freeze                                        |
| #8 owner and bounded reviewer       | Inventory exists in `docs/ai-interaction-evidence.md`            | Exact IDs/export pending                                                                                        |
| #9 owner and reviewers              | Resolve from persisted sessions                                  | Exact IDs/export pending                                                                                        |
| #10 user-visible owner              | `019fb85c-78bd-7b02-87f0-cb1376c6d0a3`                           | Delivered; task record identified; source readability/export reconciliation pending freeze                      |
| #10 coordinator review              | Primary coordinator session                                      | Exact-head reviews and delivery handoff retained; export pending freeze                                         |
| #11 owner and reviewers             | PENDING                                                          | Lane incomplete                                                                                                 |
| #13 owner and reviewer              | Inventory exists in `docs/ai-interactions/inventory/issue-13.md` | Exact IDs/export pending                                                                                        |
| #17 owner and reviewers             | Resolve from persisted sessions                                  | Exact IDs/export pending                                                                                        |

Candidate discovery found multiple DriftLens-related session files. Keyword
matches are not proof of ownership or completeness. At freeze, map each source
`session_meta` ID to exactly one inventory row and reconcile parent/child
delegation relationships.

## Code-freeze export checklist

- [ ] Record frozen functional SHA; distinguish later evidence-only commits.
- [ ] Stop and reopen freeze if any functional file changes.
- [ ] Inventory every coordinator, owner, reviewer, research, and audit session.
- [ ] Copy originals to private staging; never modify source JSONL files.
- [ ] Parse every staged JSONL and verify its `session_meta` ID.
- [ ] Map every source file to exactly one inventory entry.
- [ ] Reconcile delegation prompt, interaction, result, owner review, correction,
      and final outcome.
- [ ] Derive submission copies under `docs/ai-interactions/sessions/` only after
      secret review.
- [ ] Replace sensitive content with explicit redaction markers in derived
      copies only.
- [ ] Record submitted filename, checksum, completeness, and each redaction in
      the final manifest.
- [ ] Run JSONL parse, manifest/file reconciliation, checksum, repository secret
      scan, and dependency audit gates.
- [ ] Export account/app history as backup completeness evidence when available.
- [ ] Confirm interrupted/archived tasks are present or explicitly reconciled;
      never silently omit a partial interaction whose output influenced work.
- [ ] Record final manifest relative paths only; keep private staging paths out
      of repository evidence.

## Documentation gap audit

| Artifact               | Current gap                                                                                                                                                                             | Final owner/action                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `README.md`            | #10 added accurate console/API/setup/testing/security content; AI explanation, executable demo, troubleshooting, rationale/trade-off index, and final evidence links remain absent      | Reconcile after #11 merge; avoid concurrent edits now           |
| Setup                  | No single clean-clone sequence covers desired source, SQLite data, cluster, app, demo, failure recovery, and teardown                                                                   | Add final reviewer sequence after feature freeze                |
| `docs/architecture.md` | Opening status still says proposed/pending review; sequencing/timebox omits #13/#17; must distinguish reused private Cloudflare infrastructure from the not-yet-approved hostname route | Reconcile after domain decision and feature merge               |
| Design decisions       | Decisions are split across PRD/architecture/issues; reviewer-facing rationale and trade-offs lack one index                                                                             | Add links, not duplicate architecture prose                     |
| Next steps             | PRD and architecture enumerate Extended/Future scope; no concise reviewer-facing production-hardening index                                                                             | Finalize outline below only after Core gates                    |
| OpenAPI                | #9 scan contract exists; operational health/ready/version routes are absent; audit final #11 explanation endpoints and UI-consumed contracts after merge                                | Validate scope/spec against routes and failure shapes at freeze |
| Delivery               | Private exact-revision path documented; protected-domain route, origin-bypass proof, and final rollback evidence pending                                                                | Complete only after user supplies domain                        |
| AI evidence            | Procedures and partial inventories exist; full IDs, exports, checksums, and redaction manifest absent                                                                                   | Complete after functional freeze                                |

## What-next outline

Do not start these items before every Core gate passes:

- MVP Extended: repository/target configuration CRUD, authorized private Git,
  CPU/memory quantity comparison, event log, overall timeout, cancellation,
  linked manual scan retry, independent explanation retry, optional in-cluster
  ServiceAccount mode, and bounded namespace Deployment discovery.
- Future: more Kubernetes kinds, bidirectional container sets, ignored-container
  policy, multi-cluster/tenant support, scheduled scans, alerts, remediation,
  encrypted snapshots, retention/access/audit controls, interactive AI,
  analytics, and horizontal scaling.
- Production hardening: application authentication/authorization, database
  backup/restore and retention, durable queue/restart recovery, HA, capacity and
  load evidence, SLOs/alerts, key rotation, dependency/SBOM policy, and tested
  disaster recovery.

Final writeup must tie each item to the current accepted trade-off and avoid
implying any deferred capability exists today.

## Known blockers and failure record

- #11 remains unmerged after its initial active cap; owner review findings must
  be corrected and exact-head/main CI must pass before feature completion.
- Exact domain absent; Cloudflare route/protected proof cannot start.
- Server-side OpenAI configuration preflight remains pending; no value was
  inspected or exposed.
- Repository demo manifest, bounded scenario orchestration, and named teardown
  are prepared but not live-proven. Clean-clone execution and final live demo
  evidence remain pending until #11 delivery and deployment of the frozen
  source.
- A 2026-07-31 15:02 UTC scan reached `LOADING_DESIRED` and failed safely with
  `GITHUB_FILE_NOT_FOUND` because canonical main did not contain the configured
  public manifest path. Preserve its history and, after secret review, a
  cropped screenshot as failure-step evidence; never publish the private
  origin.
- #8/#13 active-only totals require authoritative reconciliation.
- Complete chat exports, checksums, and redaction review are intentionally
  incomplete before code freeze.
- Historical trusted-delivery run
  [30613165928](https://github.com/RGCsAGupta/driftlens/actions/runs/30613165928)
  failed on an intermediate #13 correction. Later exact-head and main runs
  passed; preserve the failure in the assessment history.
