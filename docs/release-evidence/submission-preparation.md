# Submission preparation evidence

Status: preparation only; not release evidence complete

Parent: [#3](https://github.com/RGCsAGupta/driftlens/issues/3)

Release join: [#12](https://github.com/RGCsAGupta/driftlens/issues/12)

Evidence base: `2a607f91d61dda9f59650a52ad89da6299149bb7`

Recorded: `2026-07-31T17:41:33Z`

This document records public-safe parent #3 submission evidence after issues
#8–#11, #13, #17, and bug #22 merged. `PENDING` means the requirement must not
be claimed in the submission.
No private endpoint, private hostname, identity, credential, kubeconfig value,
or image digest belongs in this file.

## Release checkpoint

| Prerequisite                  | State   | Evidence or blocker                                                                                                                                                                                                                 |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #8 foundation                 | PASS    | PR [#14](https://github.com/RGCsAGupta/driftlens/pull/14), merge `c06562f004c30714dfd7eb799b43e0239ad9d719`                                                                                                                         |
| #13 trusted delivery          | PASS    | PR [#15](https://github.com/RGCsAGupta/driftlens/pull/15), merge `43fc8fbb19d0a3709e6588e544e7d57d533556b4`                                                                                                                         |
| #17 demo-cluster prerequisite | PASS    | PR [#18](https://github.com/RGCsAGupta/driftlens/pull/18), merge `96074e9c0373df37640378aba23eb4870c86feca`                                                                                                                         |
| #9 deterministic scan         | PASS    | PR [#16](https://github.com/RGCsAGupta/driftlens/pull/16), merge `fb1bea1a8f359c8c52f32dbaa9a6e4e125e16965`                                                                                                                         |
| #10 operator UI               | PASS    | PR [#20](https://github.com/RGCsAGupta/driftlens/pull/20), merge `d8cf01eac14384ffbff65b9d5b705537ae03f96d`                                                                                                                         |
| #11 AI explanation            | PASS    | PR [#21](https://github.com/RGCsAGupta/driftlens/pull/21), merge `f26f887f1b5c97c7374da82459bd6cff5d040313`                                                                                                                         |
| #22 manifest bug              | PASS    | PR [#23](https://github.com/RGCsAGupta/driftlens/pull/23), merge `2a607f91d61dda9f59650a52ad89da6299149bb7`                                                                                                                         |
| User-selected domain/topology | PASS    | Dedicated app-host Tunnel to the existing private-interface origin; public route, firewall, exact-main, and failed direct-bypass proof retained in [#12](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5145385301) |
| Server-side OpenAI preflight  | PENDING | No current server-side preflight evidence; no secret value was inspected or printed                                                                                                                                                 |
| Session source readability    | PARTIAL | Candidate files found; final mapping, derived exports, and secret review wait for code freeze                                                                                                                                       |
| #12 continuation authority    | PASS    | `47m19s` charged through mandatory coordinator corrections and local gates; user explicitly authorized continued finish-line work                                                                                                   |

Go/no-go result: **NO-GO for final release claim**. Application dependencies,
the dedicated public route, `IN_SYNC`, and real `DRIFTED` proof are delivered.
OpenAI preflight, clean-clone, bounded `MISSING_LIVE`, failure/recovery, final
RBAC, active-session closure, and freeze evidence remain mandatory.

## Assessment deliverable matrix

| Deliverable                      | State   | Retained or required evidence                                                                                                               |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Public repository and final SHA  | PARTIAL | Repository is public; final submitted SHA waits for code freeze                                                                             |
| Working UI and backend workflow  | PARTIAL | Real-cluster `IN_SYNC` and `DRIFTED`, durable history, AI explanation, and UI proof pass; final failure scenarios pending                   |
| Persistence and graceful failure | PARTIAL | #9 tests and CI retained; final demo failure/recovery pending                                                                               |
| Clean-clone setup                | PENDING | Run from isolated checkout after feature freeze                                                                                             |
| Comprehensive README             | PARTIAL | Human/agent setup, AI, demo, API, security, and limitations exist; clean-clone proof pending                                                |
| Architecture overview            | PASS    | Approved baseline plus dedicated app-server Tunnel topology documented                                                                      |
| Design decisions and trade-offs  | PARTIAL | PRD and architecture carry decisions; consolidated reviewer path pending                                                                    |
| Next-work writeup                | PARTIAL | PRD/architecture scope mapped below; final production-hardening summary pending                                                             |
| Meaningful Git history           | PARTIAL | Merge and bounded correction history recorded below; final review pending                                                                   |
| Full quality pyramid             | PARTIAL | Exact-main CI passed through #22; rebased PR #19 and final freeze CI pending                                                                |
| Read-only RBAC proof             | PASS    | Sanitized #17 live proof retained below                                                                                                     |
| CI/deployment links              | PARTIAL | Exact-main private deployment through #22 retained; final release pending                                                                   |
| Public-domain proof              | PASS    | Dedicated connector, firewall isolation, exact-main endpoints, and failed direct-origin bypass retained in #12                              |
| Complete AI exports              | PENDING | 23 stable copies verify; three active sessions plus unavailable/exact-session reconciliation remain                                         |
| Screenshots or recording         | PASS    | Secret-reviewed [IN_SYNC UI](./screenshots/in-sync-ui-proof.png) and [DRIFTED/AI UI](./screenshots/drifted-ai-ui-proof.png) proofs retained |
| Known risks/failed gates         | PARTIAL | Current blockers and prior CI failure are recorded below                                                                                    |

## Exact revision and CI/deployment evidence

| Slice                   | Source head                                | Merge SHA                                  | Authoritative evidence                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance              | `39edb29d633a5b84abebdb07c81ef17c40883659` | `27b2b08e039063ec6da7c5c00dd32510ed93b30b` | PR [#2](https://github.com/RGCsAGupta/driftlens/pull/2)                                                                                                                                                                                                                                                                                             |
| Architecture            | `76ab0237e1f61d3adf1b75ff289177bece1a4b35` | `89d99f461ddb1c3620a68117c12e9e8cee530217` | PR [#7](https://github.com/RGCsAGupta/driftlens/pull/7)                                                                                                                                                                                                                                                                                             |
| Foundation              | `317f19a3f948ba00a6d4fd2dd8003a031b4d7a6a` | `c06562f004c30714dfd7eb799b43e0239ad9d719` | PR [#14](https://github.com/RGCsAGupta/driftlens/pull/14)                                                                                                                                                                                                                                                                                           |
| Trusted delivery        | `8c5e7df44cf9425bade3929da824459e87e2d1e3` | `43fc8fbb19d0a3709e6588e544e7d57d533556b4` | [Main run 30631735176](https://github.com/RGCsAGupta/driftlens/actions/runs/30631735176) succeeded                                                                                                                                                                                                                                                  |
| Demo cluster            | `3b5b6607bd9286bde974869be8f2d659d40fdb6d` | `96074e9c0373df37640378aba23eb4870c86feca` | [Main run 30634458368](https://github.com/RGCsAGupta/driftlens/actions/runs/30634458368) and private release succeeded                                                                                                                                                                                                                              |
| Deterministic scan      | `80ef4c84ec32c4b38351644198c524f2e7e29f9f` | `fb1bea1a8f359c8c52f32dbaa9a6e4e125e16965` | [Main run 30635279699](https://github.com/RGCsAGupta/driftlens/actions/runs/30635279699): [verify](https://github.com/RGCsAGupta/driftlens/actions/runs/30635279699/job/91171192064) and [private release](https://github.com/RGCsAGupta/driftlens/actions/runs/30635279699/job/91171711853) succeeded                                              |
| Operator console        | `76c3a2aeed4816106f62830c3b704a0a5c85b744` | `d8cf01eac14384ffbff65b9d5b705537ae03f96d` | [Main run 30639327549](https://github.com/RGCsAGupta/driftlens/actions/runs/30639327549): [verify](https://github.com/RGCsAGupta/driftlens/actions/runs/30639327549/job/91184933285) and [private release](https://github.com/RGCsAGupta/driftlens/actions/runs/30639327549/job/91185514520) succeeded                                              |
| AI explanation          | `05d0e977c5afbe4b9a81100653ccfdc21841a82e` | `f26f887f1b5c97c7374da82459bd6cff5d040313` | [Main run 30644972229](https://github.com/RGCsAGupta/driftlens/actions/runs/30644972229): [verify](https://github.com/RGCsAGupta/driftlens/actions/runs/30644972229/job/91203994291) and [private release](https://github.com/RGCsAGupta/driftlens/actions/runs/30644972229/job/91205134402) succeeded                                              |
| Manifest bug fix        | `ad6ef9c0f1c3a9c2320e0d405b316fd54e2cbc6a` | `2a607f91d61dda9f59650a52ad89da6299149bb7` | [Main run 30647119074](https://github.com/RGCsAGupta/driftlens/actions/runs/30647119074): [verify](https://github.com/RGCsAGupta/driftlens/actions/runs/30647119074/job/91211124347) and [private release](https://github.com/RGCsAGupta/driftlens/actions/runs/30647119074/job/91211657316) succeeded                                              |
| Earlier #12 preparation | `eef7b684278db771a15456ad35dabe803afb0f1f` | PENDING                                    | Draft PR [#19](https://github.com/RGCsAGupta/driftlens/pull/19); historical [run 30642477534](https://github.com/RGCsAGupta/driftlens/actions/runs/30642477534) and [verify 91195600838](https://github.com/RGCsAGupta/driftlens/actions/runs/30642477534/job/91195600838) passed; current exact-head CI is required after this evidence correction |

The main-run private-release jobs prove immutable publication, private deploy,
health, readiness, exact-version smoke, and transient credential cleanup. The
separate [public-route checkpoint](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5145385301)
proves the dedicated Tunnel, firewall isolation, exact-main public endpoints,
and failed direct-origin bypass.

Formal-gate exception: user direction in [#12](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5143389244)
makes trusted exact-head CI authoritative for lint, type, unit, build, audit,
scanner, and secret gates. Local full-suite duplication is intentionally
omitted. Missing or red exact-head CI still blocks readiness.

## Active-development ledger

Only implementation, correction, and verification activity counts. Planning,
read-only review, approval waits, CI waits, idle time, and wall-clock gaps do
not count.

| Lane |            Active time | Status/source                                                            |
| ---- | ---------------------: | ------------------------------------------------------------------------ |
| #9   | approximately `61m02s` | Final corrected issue comment; includes approved OpenAPI amendment       |
| #10  |               `24m05s` | Final issue-owner checkpoint; delivered through protected main           |
| #11  | approximately `10m00s` | Delivered through protected main; final ledger source still reconciles   |
| #17  |               `24m00s` | Final acceptance checkpoint; original combined cap was `32m00s`          |
| #12  |               `47m19s` | Includes `18m33s` correction/export segment; exact-head CI wait excluded |
| #8   |              RECONCILE | Exact active-only total not yet consolidated here                        |
| #13  |              RECONCILE | Exact active-only total not yet consolidated here                        |

Do not infer missing totals from commit timestamps or PR age. Final ledger must
sum authoritative issue-owner handoffs against the 240-active-minute ceiling.
The parent records one `65m39s` implementation/review window spanning #8
completion while #13 was active, with parallel work counted once; it is not a
defensible per-issue total. The original target was `12m00s` for each lane.
The correction/export segment ran
`2026-07-31T17:23:00Z–2026-07-31T17:41:33Z` = `18m33s`, including mandatory
evidence reconciliation and local gates. The combined #17/#12 record is now
`71m19s`, exceeding its original `32m00s` cap by `39m19s`. The continuation was
explicitly authorized, but this overrun remains a blocking fact in the final
240-active-minute reconciliation. Git publication and CI wait after this
ledger stop are excluded from active correction time.

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

## Completed integrated proof

- Public API/history `IN_SYNC`: scan
  `406322e7-bc33-466b-a548-95f0e94632f8` resolved exact main
  `2a607f91d61dda9f59650a52ad89da6299149bb7`, completed every stage, and had
  no supported differences. [Evidence](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5145550670)
- Its manual AI explanation was saved once without changing deterministic
  truth. [Evidence](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5145633536)
- User UI proof shows exact-main `IN_SYNC` scan
  `f9601e7b-7bfe-4080-a433-02caae17795f` with full stage history.
  [Evidence](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5145640616)
- Exact-main scan `7704379a-1037-4d46-bc6b-80d010b7db68` completed `DRIFTED`:
  desired/live replicas `1`/`2` and different immutable image digests for
  container `web`. Its advisory AI analysis reached `SAVED`, names the same two
  differences, and preserves deterministic truth.
  [Evidence](https://github.com/RGCsAGupta/driftlens/issues/12#issuecomment-5145777012)

The screenshots passed visual secret review. Their SHA-256 values are
`e03d81eec26db27170bd9ffd5dedc08bdd4dbd9aa0920f6750a43dbf76eba345`
and `c5ad72765460c8dda9e1dc2268711e7349483ae16afd9d3734acedae83c7212c`.
These passes do not substitute for bounded final `MISSING_LIVE`,
access-failure/recovery, or final RBAC proof.

## Bounded demo runbook

Run only after final configuration and the server-side OpenAI preflight are
reconciled and the go/no-go table passes.

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
10. After approved main merge, retain exact private and public-domain
    health/readiness/version proof. Confirm direct-origin bypass is unavailable.
11. Tear down only the named disposable cluster after evidence is retained.

Retain for each scenario: frozen SHA, start request, terminal scan identifier,
stage history, deterministic outcome or safe error code, and one secret-reviewed
UI/API proof. The repository now prepares a public desired manifest plus
bounded, idempotent scenario and named teardown commands. The public manifest
is now delivered through #22, but all scenarios remain unproven against the
live demo cluster. Other blockers are the live OpenAI preflight and final
configuration values.

Official operator references: [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/),
[kubectl auth can-i](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_auth/kubectl_auth_can-i/),
and [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## Git-history evidence

History through #22 shows separate conventional commits for scope, governance,
architecture, application foundation, delivery controls, demo-cluster setup,
scan implementation, API documentation, operator UI, CI/E2E corrections, and
merge boundaries, AI explanation, and the isolated manifest bug fix. Final
audit must verify:

- every implementation issue maps to one bounded PR and merge;
- corrective commits remain visible instead of being erased;
- no unrelated or secret-bearing file appears in the submitted history;
- final feature, evidence-only, and release SHAs are distinguished;
- #12 and parent #3 links are added after final merge and proof.

## AI interaction inventory

The [machine index](../ai-interactions/index.json) and [human
manifest](../ai-interactions/manifest.md) are authoritative:

- 23 stable persisted sessions have full redacted JSONL copies with matching
  line counts, SHA-256 checksums, redaction reports, and `finalReview: pass`;
- the primary coordinator, #12 owner, and current #12 coordinator-review
  sessions remain held active for closure;
- five exact IDs have unavailable local sources and no invented transcript;
- #8 and the requested read-only #12 delegated review remain explicitly
  pending exact-session reconciliation; and
- the interrupted duplicate #12 task has no completion claim.

Complete export remains blocked until held sessions close and unavailable or
parent-captured records are reconciled against the final app/account archive.

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

| Artifact               | Current gap                                                                                                                                                                  | Final owner/action                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `AGENTS.md`            | No #12 amendment; PR #19 leaves the approved collaboration contract unchanged                                                                                                | None in this PR                                           |
| `README.md`            | Public-source, arbitrary-cluster, least-privilege, AI, local setup, switching, troubleshooting, agent, and dedicated-route contracts are prepared; execution proof pending   | Run clean-clone proof from frozen source                  |
| Setup                  | Human/agent clean-clone sequence and local `kind` path are documented but not yet executed from the frozen functional SHA                                                    | Execute and retain terminal proof after feature freeze    |
| `docs/architecture.md` | Approved baseline status and dedicated app-server Tunnel topology are reconciled; final route proof remains external evidence                                                | Verify topology during final public-domain proof          |
| Design decisions       | Decisions are split across PRD/architecture/issues; reviewer-facing rationale and trade-offs lack one index                                                                  | Add links, not duplicate architecture prose               |
| Next steps             | PRD and architecture enumerate Extended/Future scope; no concise reviewer-facing production-hardening index                                                                  | Finalize outline below only after Core gates              |
| OpenAPI                | Scan and #11 explanation contracts exist; operational health/ready/version routes remain outside the current file and require final scope audit                              | Validate routes and failure shapes at freeze              |
| Delivery               | Actual dedicated connector/private-interface topology and completed public route, firewall, exact-main, and bypass proof documented; final rollback evidence remains pending | Retain proof; do not publish private values               |
| AI evidence            | 23 stable full JSONL copies pass line/checksum/report/final-review gates; active and unavailable sources remain explicit                                                     | Finish held sessions and archive reconciliation at freeze |

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

- PR #19 is based on exact main
  `2a607f91d61dda9f59650a52ad89da6299149bb7`; its corrected head must pass
  exact-head CI and remain draft until final gates pass.
- The dedicated public Tunnel, app-host connector, firewall isolation,
  exact-main route, and failed direct-origin bypass are complete. The route has
  no Cloudflare Access, shared reverse proxy, or router forwarding.
- Server-side OpenAI configuration preflight remains pending; no value was
  inspected or exposed.
- The access-failure/recovery scenario is blocked. The fixed RoleBinding was
  verified absent after the desired workload was restored, but scans
  `f3bacceb-edcc-43b3-9148-07b10a0ba4a9` and
  `a9f49c4e-042c-4f50-88b1-ea852e0fdc47` both completed `IN_SYNC`. Binding
  restoration was requested; no access failure, recovery, or restored-binding
  result is claimed.
- The repository demo manifest is delivered through #22. Bounded scenario
  orchestration and named teardown remain unproven; clean-clone execution and
  final live demo evidence still require the frozen source.
- A 2026-07-31 15:02 UTC scan reached `LOADING_DESIRED` and failed safely with
  `GITHUB_FILE_NOT_FOUND` because canonical main did not contain the configured
  public manifest path. Preserve its history and, after secret review, a
  cropped screenshot as failure-step evidence; never publish the private
  origin.
- #8/#13 active-only totals require authoritative reconciliation.
- The combined #17/#12 active record exceeds its original cap as detailed in
  the ledger; final assessment-time reconciliation remains blocking evidence.
- Rolling chat export retains 23 stable complete copies with reconciled line
  counts, checksums, redaction reports, and `pass` review state. Three active
  sessions, five unavailable sources, two exact-session mappings, and final
  freeze reconciliation remain incomplete.
- Historical trusted-delivery run
  [30613165928](https://github.com/RGCsAGupta/driftlens/actions/runs/30613165928)
  failed on an intermediate #13 correction. Later exact-head and main runs
  passed; preserve the failure in the assessment history.
