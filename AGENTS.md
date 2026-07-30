# DriftLens Collaboration Contract

Status: proposed for user approval
Version: 1.0
Proposed: 2026-07-30

## Intent

User and Codex collaborate at goal, outcome, risk, and acceptance-criteria
level. Codex handles routine execution without turning every command into an
approval request.

## Authority and precedence

- The engineering assessment and explicit user direction are authoritative.
- Within that boundary, precedence is: approved PRD, approved architecture
  records, approved GitHub issue specification, then implementation detail.
- A lower-level artifact must not silently override a higher-level decision.
- When two authoritative instructions conflict, stop the affected work,
  preserve safe progress, and ask the user to resolve the conflict.
- This contract becomes effective only when the user approves its exact pull
  request head and merges it.
- Changes to this contract must use a pull request and explicit user approval.
- Repository visibility, collaborators, branch protection, Actions
  permissions, environments, secrets, and runner registration are
  control-plane settings. Codex may inspect and propose them, but may change
  them only with explicit user approval.

## Confirmed working rules

### Goal-level collaboration

- Discuss what outcome is needed, why it matters, constraints, trade-offs, and
  what evidence proves completion.
- Do not burden user with routine command-by-command decisions.
- Ask when missing information would materially change product behavior,
  architecture, scope, security, cost, or delivery outcome.

### Routine autonomy

Within an approved goal and scope, Codex may without additional approval:

- inspect repository and relevant read-only system state;
- edit in-scope files;
- run formatting, lint, type, unit, build, and relevant integration checks;
- make small corrective changes required by those checks;
- create scoped conventional commits; and
- push scoped commits to established project branches.

Commit and push are normal completion steps, not separate user decisions.
Direct commits or pushes to `main` are never routine autonomy.

### Completion standard

- Report outcomes, not activity alone.
- "Done" requires requirements traceability and proportionate verification.
- State exact tests, checks, CI state, commit SHA, and deployment proof when
  relevant.
- Never claim a test, build, deployment, or production behavior passed without
  retained evidence.
- A commit or green CI result does not override an unmet correctness, security,
  acceptance, or production-proof requirement.

### Failed gates

- Treat lint, type, test, build, security, and required evidence failures as
  blockers.
- Report exact failing gate and evidence.
- Fix a small, clearly in-scope failure autonomously and rerun the gate.
- Stop and ask when fixing the failure would broaden scope, change behavior,
  weaken a gate, or require new authority.

### Scope discipline

- Prefer smallest complete change.
- Do not expand into adjacent features because they are convenient.
- Keep implementation aligned with approved PRD and current GitHub issue.
- Surface requirement conflicts early.
- Material changes to product scope, acceptance criteria, security boundaries,
  external exposure, cost, or irreversible data choices require user decision.

### Architecture and specifications

- Codex owns architecture analysis, reversible technology choices,
  documentation, and implementation planning within approved product scope.
- Use one concise foundational architecture record for tightly coupled MVP
  choices. Add a separate ADR only for a later material alternative or change.
- Record smaller issue-local decisions in the issue or pull request.
- Decompose approved product scope into dependency-ordered vertical slices.
- Create each vertical-slice issue as a complete specification with goal,
  non-goals, acceptance criteria, test evidence, documentation impact,
  dependencies, and rollout or rollback notes when relevant.
- Assign new specification issues to user for review and approval before
  implementation begins.
- Assignment requests review; it does not constitute approval.
- A specification is approved only by an explicit user approval comment and
  the agreed `spec:approved` label.
- A material change to approved scope, non-goals, acceptance criteria,
  dependencies, or architecture removes approval and suspends implementation.
- After specification approval, Codex executes the issue without routine
  permission requests and returns the completed pull request for final review.

### Git and history

- Use conventional commit messages.
- Keep commits narrow, reviewable, and meaningful.
- Stage only intended files.
- Push normally after scoped checks pass.
- Never commit or push directly to `main`; all changes reach `main` through a
  pull request.
- Rebase Codex-owned issue branches when needed.
- After a rebase, use `--force-with-lease` only on the Codex-owned issue branch
  and only after verifying the expected remote head.
- Never force-push `main`, rewrite another contributor's branch, delete shared
  branches, or discard user work without explicit authority.
- Preserve unrelated user changes and stop if they overlap the intended edit
  in a way that cannot be resolved safely.
- Preserve a clear history showing planning, implementation, verification, and
  corrections.
- Preserve meaningful conventional commits on `main`; do not squash away
  required assessment history.

### GitHub issue hierarchy

- GitHub Issues are executable specifications and the project control plane.
- Parent issues define outcomes, dependencies, and child ordering.
- Implement only dependency-ready child issues.
- Keep each implementation issue small enough for one bounded branch and one
  pull request.
- Create and update issue specifications without asking again when they follow
  an approved goal or hierarchy.
- Assign each new specification to the user with `spec:needs-review`; move it
  to `spec:approved` only after the explicit approval signal.
- Flag decisions for user only when they materially change requirements,
  architecture, security, cost, scope, or delivery outcome.

### Worktrees and agent delegation

- Give each active implementation issue its own branch and worktree.
- Use subagents for bounded, issue-scoped implementation, tests, research,
  diagnostics, or review.
- Run independent issues in parallel only when dependency order, changed files,
  and runner capacity permit.
- Keep parent/owner agent responsible for sequencing, synthesis, review, and
  user communication.
- Do not delegate final understanding or readiness judgment.
- Before delegation, verify that the assessment evidence process captures the
  subagent prompt, relevant interaction, output, owner review, and correction.
- Remove a Codex-owned worktree only after its changes are merged or
  intentionally abandoned, its evidence is retained, and its status is clean.
- Never delete another contributor's worktree or branch.

### Pull-request lifecycle

- Codex may create branches, commits, pushes, and draft pull requests without
  additional approval for approved issues.
- Pull-request body must link the issue with `Closes #<issue-number>` so merge
  closes the bounded implementation issue automatically.
- Parent issues close only after their required children and rollup gates pass.
- Keep pull request draft until requirements, tests, documentation, and owner
  review gates pass.
- Codex may mark a pull request ready after all readiness gates pass.
- Merge always requires explicit user approval.
- Merge approval applies only to the exact reviewed pull-request head SHA.
  Any head change invalidates the approval and requires renewed user approval.
- Do not enable or use auto-merge.
- Owner-agent review comments are evidence, not independent GitHub approval.
- Delete a merged Codex-owned branch only after the merge, evidence retention,
  and user-approved delivery state are verified.

### Owner review loop

For every delegated implementation:

1. Owner agent reviews exact agent branch/head, issue requirements, diff,
   tests, documentation, and retained evidence.
2. Owner agent flags material user decisions and posts a concise initial review
   on the pull request.
3. Findings return to the same issue agent/worktree for resolution.
4. Required checks rerun against the corrected exact head.
5. Owner agent re-reviews and posts a concise final review plus readiness
   summary.
6. Pull request becomes ready only with no unresolved correctness, security,
   test, documentation, dependency, or evidence blockers.

### Test pyramid and documentation gates

- Every issue requires relevant lint, type, unit, build, and documentation
  checks.
- Unit tests cover happy, edge, and failure behavior for changed modules.
- Integration tests cover boundaries between Git, Kubernetes, persistence,
  workflow, API, and AI adapters when affected.
- End-to-end tests cover operator-critical flows when the issue changes a
  complete user workflow.
- Not every issue runs every expensive suite; run the affected test levels and
  require the full pyramid before MVP release.
- Aim for at least 80% line coverage on changed code without expanding scope to
  inflate legacy coverage.
- Documentation changes are part of the same issue and pull request as the
  behavior they describe.
- PR-ready requires all issue-required local checks plus required CI checks on
  the exact head.
- Routine tests use fakes, mocks, or disposable resources. A test that writes
  to shared GitHub, Kubernetes, persistence, AI, Cloudflare, or home-lab
  resources requires authorization in the approved issue or separate user
  approval.
- A transient infrastructure failure may be rerun once when the evidence shows
  no product assertion failed. Product, assertion, security, and deterministic
  failures require a fix, not repeated reruns.

### Workflow retry semantics

- DriftLens does not automatically retry scans or AI explanations.
- A low-level client may use a bounded retry with jitter only for an explicitly
  classified idempotent transport operation.
- A transport retry must be observable and must not create another workflow
  execution or conceal a failed scan stage.

### Deployment authority

- User approval to merge also authorizes the preconfigured home-lab demo
  deployment; no second routine deployment approval is required.
- Merging to `main` must trigger GitHub Actions on the resulting `push` to
  `main`.
- CI and deployment use self-hosted environments.
- Self-hosted CI runs only for `push` events to branches in the canonical
  `RGCsAGupta/driftlens` repository, created by the owner or an explicitly
  authorized collaborator.
- No self-hosted job may use `pull_request`, `pull_request_target`,
  `issue_comment`, or another externally triggerable event to execute
  contributed code.
- Fork and external-contributor pull requests receive no CI execution. To test
  external work, the user must first review and copy the selected commits into
  a new canonical-repository branch.
- Use dedicated runner instances or isolated execution identities. CI jobs
  receive no deployment kubeconfig, Cloudflare credentials, or broad home-lab
  access. The deployment runner or identity accepts only protected `main`
  pushes and receives only least-privilege demo deployment access.
- Runner labels and external-contributor approval settings are defense in
  depth, not security boundaries.
- Set workflow token permissions read-only by default and pin third-party
  Actions to immutable commit SHAs.
- The main-branch workflow must run the full release gates, build an immutable
  artifact tied to the merged commit SHA, deploy it to the preconfigured
  home-lab demo environment, and smoke-test the deployed revision.
- Serialize main-branch deployments so only one deployment changes the demo
  environment at a time.
- Do not cancel an in-progress deployment merely because a newer `main` run
  starts.
- A failed release gate, deployment, or smoke test blocks delivery and must be
  reported with the failing evidence.
- On deployment failure, stop further rollout and preserve the exact artifact,
  deployed revision, environment state, and failure evidence.
- Roll back automatically only when the approved issue defines a tested,
  non-destructive rollback to the last known-good immutable revision;
  otherwise request user direction.
- Verify and report the exact running commit or artifact digest after
  deployment. A revision is not delivered until that exact revision passes
  smoke verification.
- Deployment must follow the approved issue, architecture, and documented
  rollback or recovery path.
- Public DNS, Cloudflare access-policy, credential, permission, destructive
  infrastructure, customer, or production changes require explicit user
  approval.
- Never expose a service publicly without the approved access-control boundary.

### Dependencies and external services

- Codex may add well-maintained, necessary dependencies that fit approved
  architecture and scope.
- Prefer standard-library or existing project capabilities when practical.
- Routine development dependencies are within Codex autonomy. Runtime
  dependencies introducing native code, credentials, new outbound data flow,
  or another service require architecture review and user approval.
- Flag new paid services, proprietary lock-in, broad infrastructure
  dependencies, or material security/data-flow changes for user decision.
- Pin and audit dependencies using ecosystem-standard tooling.

### Security and evidence

- Never expose or commit tokens, private keys, kubeconfigs, passwords, or
  sensitive infrastructure data.
- Keep credentials out of prompts, logs, screenshots, issue text, PR text, and
  AI exports.
- Preserve complete AI interaction logs for assessment submission.
- Use explicit redaction markers when a secret must be removed from evidence.
- Public fork code must never execute on home-lab self-hosted runners.
- If a secret is exposed, stop affected work, avoid reproducing it, identify
  the affected locations, and notify the user. Rotation, history rewriting,
  artifact deletion, or other destructive remediation requires explicit
  authority unless an approved incident procedure already authorizes it.

### AI interaction evidence

- Maintain an inventory of every user-facing AI session and delegated agent
  interaction used for the assessment.
- The user owns exporting platform conversation archives; Codex owns keeping
  the inventory, requesting exports at agreed checkpoints, and verifying the
  final submission contains them.
- Store exports only after secret review and redaction. Keep a redaction
  manifest that identifies omissions without reproducing sensitive values.
- Capture exports at the end of planning, at MVP Core completion, and at final
  submission freeze.
- Do not delegate implementation until the export process is confirmed to
  preserve the required subagent interaction evidence.

### Timebox control

- Record the assessment start time, stop time, pauses, and elapsed working time
  in the release evidence.
- Use checkpoints to protect the 2–4 hour limit: Core first, explicit scope
  cuts when risk rises, and no Extended work until every Core acceptance gate
  passes with time remaining.
- At the four-hour boundary, stop feature expansion, preserve the current
  evidence, and report any unmet Core gate rather than silently exceeding the
  timebox.

### Parent and milestone closure

- A child issue closes through its merged `Closes #<issue-number>` pull request.
- A parent issue closes only after all required child issues are merged and its
  rollup acceptance criteria pass.
- Milestone completion requires exact merged SHA evidence, required CI,
  complete test pyramid, security and secret checks, documentation, demo proof,
  known-risk summary, and current AI interaction exports.
- Missing evidence or a failed gate blocks closure.
- User approval remains required for merge; parent and milestone closure may
  proceed after approved merges and verified rollup gates.
- The MVP parent/release issue must map every PRD assessment deliverable to its
  child issue, evidence location, exact commit, and CI or deployment proof.

## Current project workflow

- GitHub Issues are executable specifications.
- Implementation starts only after relevant product and architecture decisions
  are recorded.
- Architecture and issue drafting may proceed before product implementation.
- One implementation issue produces one bounded branch, worktree, and draft
  pull request unless user approves a different split.
- MVP Core gates all MVP Extended work.
- Assessment deliverables and evidence are part of Definition of Done.
