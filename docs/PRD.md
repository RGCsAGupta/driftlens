# DriftLens MVP Product Scope

Status: approved project scope
Timebox: 2–4 hours for MVP Core
Primary users: platform engineers and site reliability engineers (SREs)

## 1. Purpose

DriftLens helps an operator determine whether one desired Kubernetes
`apps/v1` Deployment still matches its live cluster configuration.

The operator uses the configured Git source and one Deployment manifest,
starts an on-demand scan, observes its progress, and receives:

- a deterministic comparison result;
- exact supported field differences;
- persistent scan history; and
- a manually requested AI explanation.

DriftLens is read-only. It never changes Kubernetes resources.

## 2. Problem

Deployment configuration can diverge from Git because of manual changes,
automation, or operational intervention. Operators need a focused way to:

- compare declared configuration with the live Deployment;
- identify supported differences without full-object diff noise;
- understand scan progress and failures;
- retain evidence from previous scans; and
- request a concise explanation of the result.

MVP does not attempt to replace a GitOps controller or provide remediation.

## 3. Product principles

- Deterministic comparison remains source of truth.
- AI explains results but never determines drift.
- One polished workflow takes priority over broad Kubernetes coverage.
- Kubernetes and Git credentials remain outside browser and persisted product
  data.
- Read-only cluster access remains mandatory.
- Explicit limitations are preferable to unreliable generic behavior.

## 4. Scope tiers

### 4.1 MVP Core — required within 2–4 hours

- One application instance connected to one Kubernetes cluster.
- DriftLens runs outside the Kubernetes cluster and connects through a
  server-configured kubeconfig.
- One deployment-configured public GitHub repository and Deployment target.
- One YAML file containing exactly one `apps/v1` Deployment.
- Git branch or commit SHA input; record resolved immutable commit SHA.
- Target identity derived from manifest `apiVersion`, `kind`,
  `metadata.namespace`, and `metadata.name`.
- Explicit `metadata.namespace` required.
- On-demand scan for one Deployment.
- Visible basic scan stages and actionable failure feedback.
- Deterministic comparison of:
  - replicas;
  - container images.
- All desired regular containers matched by name.
- Persistent scan state, result, explanation, and history.
- Manual AI explanation request for every completed scan outcome.
- Focused operator UI.
- Backend API capabilities required by UI and independently accessible.
- Local runnable demonstration with DriftLens outside `kind` and one simple
  Deployment inside the demo cluster.
- Tests and submission documentation required by assessment.

MVP Core does not include frontend or API management of repository and target
configuration.

### 4.2 MVP Extended — starts only after MVP Core passes

- Add frontend/API configuration of one public and one deployment-authorized
  private GitHub repository.
- Full repository and Deployment-target create, read, update, and delete
  workflows.
- Compare CPU and memory requests and limits for every desired regular
  container.
- Compare Kubernetes resource quantities semantically.
- Detailed operator-visible scan event log.
- Overall timeout handling.
- User cancellation.
- Manual scan retry linked to original scan.
- Independent explanation retry.
- Optional in-cluster ServiceAccount mode as a post-Core deployment
  enhancement; it is not required for the demo.
- C-lite live discovery:
  - operator provides one namespace;
  - DriftLens lists Deployments in that namespace;
  - no namespace discovery, pagination, or bulk selection.
- Hosted demo with DriftLens outside Kubernetes on pve1 or pve2, protected by
  Cloudflare, and a private demo Kubernetes cluster on the selected node.

### 4.3 Future

- Git-to-cluster inventory drift.
- Additional Kubernetes resource kinds.
- Bidirectional container-set comparison.
- Configurable ignored containers and injected-sidecar rules.
- Multiple clusters and tenants.
- Scheduled or continuous scans.
- Alerts and notifications.
- Automatic remediation.
- Secure desired/live manifest snapshots.
- Encryption, retention policies, access controls, and audit logs.
- Interactive AI chat.
- Monitoring analytics and trends.
- Production high availability and horizontal scaling.

## 5. Expected operator workflow

1. Operator starts an on-demand scan for the deployment-configured Git source
   and Deployment target.
2. DriftLens validates the manifest and derives Deployment identity.
3. DriftLens reports progress while loading desired state, reading live state,
   comparing supported fields, and saving result.
4. Operator sees execution status and comparison outcome.
5. Operator may explicitly request an AI explanation.
6. Operator reviews current or previous scan details.

MVP Extended adds frontend/API source and target configuration, cancellation,
timeouts, detailed events, and manual retry. There are no automatic retries or
restart resumability.

## 6. MVP inputs

### Git source

MVP Core receives one deployment-configured public GitHub source and target.
MVP Extended lets the operator manage:

- Repository display name.
- GitHub repository URL or owner/name identifier.
- Public or deployment-authorized private source classification.
- Branch or commit SHA.
- Relative YAML manifest path.

Private repository credentials:

- are configured in deployment runtime;
- are never entered through UI;
- are never returned by API;
- are never persisted with repository metadata; and
- are never written to logs or AI interaction records.

Exact private Git credential mechanism is an implementation decision.

Source boundary:

- GitHub repositories only.
- No embedded credentials in repository metadata.
- No local or `file://` repository sources.
- No arbitrary Git hosts or unsafe transports.
- Private source must match the repository authorized by deployment runtime.

Exact validation and transport behavior remain implementation decisions.

### Kubernetes source

- One server-configured, read-only kubeconfig.
- One cluster per DriftLens instance.
- No kubeconfig upload or browser credential entry.

In-cluster ServiceAccount support belongs to MVP Extended. DriftLens itself
does not need to run in Kubernetes for MVP Core or the hosted demo.

### Manifest contract

- Plain YAML.
- Exactly one document.
- Exactly one `apps/v1` Deployment.
- Explicit Deployment name and namespace.
- No Helm, Kustomize, Jsonnet, templating, or directory scanning.

## 7. Kubernetes comparison contract

### Supported resource

- `apps/v1` Deployment only.

### Supported fields

MVP Core:

- `spec.replicas`;
- `spec.template.spec.containers[*].image`.

MVP Extended:

- `resources.requests.cpu`;
- `resources.requests.memory`;
- `resources.limits.cpu`;
- `resources.limits.memory`.

### Comparison semantics

- Omitted desired replicas are treated as Kubernetes default `1`.
- Images use exact declared-string comparison.
- Equivalent Kubernetes CPU or memory quantities compare equal.
- Missing versus configured resource request or limit reports drift.
- Desired regular containers match live regular containers by name, not array
  position.
- A desired container missing from live Deployment reports drift.
- Extra live-only containers are ignored to avoid injected-sidecar false
  positives.
- Init and ephemeral containers are excluded.
- Runtime-owned and unrelated fields are ignored.

## 8. Scan lifecycle

### Core stages

- queued;
- loading desired manifest;
- reading live Deployment;
- comparing supported fields;
- saving result;
- completed or failed.

### Extended operational behavior

- per-stage timestamp and message;
- detailed event log;
- cancellation;
- overall timeout;
- manual retry linked to original scan.

No automatic retry. No restart resumability. An active scan interrupted by
application restart receives no Core recovery guarantee. MVP Extended records
it as interrupted.

### Execution statuses

- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `CANCELLED` — MVP Extended
- `TIMED_OUT` — MVP Extended
- `INTERRUPTED` — MVP Extended

### Comparison outcomes

- `IN_SYNC`
- `DRIFTED`
- `MISSING_LIVE`

Invalid manifest, unsupported resource, Git failure, Kubernetes authorization
failure, unavailable cluster, or internal failure produce actionable execution
errors rather than drift outcomes.

## 9. AI explanation

- Explanation is a must-have MVP capability.
- Operator must request it manually.
- It is available for `IN_SYNC`, `DRIFTED`, and `MISSING_LIVE`.
- It receives sanitized deterministic comparison data, not credentials or full
  manifests.
- It provides short structured operator analysis:
  - summary;
  - important differences;
  - likely operational implications;
  - suggested investigation checks;
  - limitations and uncertainty.
- It does not claim confirmed root cause.
- It does not perform remediation.
- Explanation failure never changes deterministic scan status or outcome.
- Exact model and final presentation are implementation-time decisions.
- No interactive chat or AI-generated charts.

## 10. UI capabilities

Focused operator console:

- identify the configured repository and Deployment target;
- start one scan;
- observe progress;
- view deterministic outcome and field differences;
- request and view explanation;
- browse scan history and details;
- display actionable failures.

MVP Extended adds repository and target configuration management,
cancellation, detailed events, retry controls, and concurrent public/private
repository configuration.

No monitoring dashboard, analytics charts, bulk actions, or multi-user
experience.

## 11. Backend API capabilities

Product-level capabilities:

- validate the configured source and target;
- start one scan;
- retrieve status, basic stages, result, and explanation;
- list scan history and retrieve scan detail;
- request AI explanation;
- return health/readiness state;
- return structured errors;
- never expose Git or Kubernetes credentials.

MVP Extended adds repository and target configuration management, detailed
events, scan cancellation, manual scan retry, and independent explanation
retry.

Endpoint paths, schemas, transport, polling versus streaming, and internal
service boundaries are intentionally undecided.

## 12. Persistence

Persist server-side in MVP Core:

- resolved Git revision;
- scan status, stages, and timestamps;
- supported desired/live field values;
- field-level differences;
- explanation or explanation error;
- execution errors;
- scan history.

MVP Extended also persists non-secret repository metadata, Deployment targets,
detailed events, and retry linkage.

Do not persist:

- Git credentials;
- kubeconfig content;
- complete desired or live manifests;
- unrelated Kubernetes fields.

No browser local storage. History remains indefinitely for assessment lifetime.
Production retention and forensic records require future security and audit
specifications.

Persistence technology and data model remain undecided.

## 13. User stories

1. As a platform engineer or SRE, I can start an on-demand scan for one
   deployment-configured Deployment.
2. I can observe scan progress and understand failure.
3. I can see exact desired/live values for supported fields.
4. I can manually request an operator-focused AI explanation.
5. I can browse history and inspect earlier scans.
6. I can trust that DriftLens uses read-only Kubernetes access and never
   exposes Git or cluster credentials.

MVP Extended adds repository/target management, cancellation, and manual retry
stories.

## 14. Demo scenarios

Compact end-to-end demo:

Demo precondition: one simple `apps/v1` Deployment runs in the private demo
cluster. Its desired manifest lives in the configured Git source. DriftLens
runs outside that cluster.

1. **In sync:** desired and live Deployment match.
2. **Drift detected:** replica and image changes produce exact differences and
   a manually requested explanation. MVP Extended also demonstrates a resource
   request or limit difference.
3. **Missing live:** desired manifest exists but matching Deployment does not.
4. **Failure and recovery:** invalid source or cluster-access failure produces
   an actionable error and appears in history; MVP Extended demonstrates manual
   retry.

Explanation-failure behavior should be covered by Core tests rather than the
primary live demo. MVP Extended tests cover cancellation and timeout.

## 15. Delivery and project governance

- Public GitHub repository: `RGCsAGupta/driftlens`.
- GitHub Issues hold specifications and project work.
- Meaningful incremental Git history is required.
- Full AI interaction logs are required and must contain no secrets.
- GitHub Actions use self-hosted runners on pve1.
- Self-hosted runners accept trusted repository branches and authorized
  collaborator activity only.
- Public fork code must never execute on home-lab self-hosted runners.
- If pve1 hosts both CI and demo workloads, their runtime and credentials must
  remain isolated.
- Local execution on an operator laptop or server is required.
- Local mode must remain on an operator-controlled machine or private network
  and must not be exposed publicly without external access control.
- DriftLens is not required to be deployed as a Kubernetes application.
- Hosted demo target:
  - DriftLens runs outside Kubernetes on pve1 or pve2;
  - one simple demo Deployment runs inside a private Kubernetes cluster on
    the selected node;
  - pve1 is currently a viable small-app and virtualization host;
  - Cloudflare-protected UI and API;
  - direct origin access must not bypass Cloudflare protection;
  - domain selected later.
- Hosted and local modes use the same product scope.

### Optional pve2 placement prerequisite

pve2 has sufficient capacity but hardware virtualization is not currently
available. If VM-based placement is selected, a demo Kubernetes cluster
requires:

1. enable Intel VT-x in BIOS;
2. reboot pve2;
3. verify CPU virtualization flags and `/dev/kvm`;
4. recheck placement readiness.

No VM-based pve2 demo-cluster work begins until this prerequisite passes.
pve1 provides a viable hosted-demo path, so pve2 readiness does not block MVP
delivery.

## 16. Assessment deliverables and evidence

Every assessment requirement must map to reviewable evidence. Product
completion without submission evidence is incomplete.

| Assessment requirement | Required evidence | Status |
| --- | --- | --- |
| Public GitHub repository | Public repository URL and final submitted commit SHA | Repository ready; final SHA pending |
| Working application | UI, backend API, and real Git-to-cluster scan running together | Planned |
| Web UI | Proof of scan initiation, progress, result, history, explanation, and failure feedback | Planned |
| Backend APIs | Reviewable API behavior for scan execution, state, results, history, and explanation | Planned |
| State and failure handling | Proof that scan state/history persist and failures remain actionable | Planned |
| Local development setup | Clean-clone setup instructions and a successful local `kind` demonstration | Planned |
| Comprehensive README | Setup, use-case rationale, demo, design decisions, trade-offs, and limitations | Planned |
| Architecture overview | UI/API/backend boundaries, workflow state, persistence, security boundaries, and trade-offs | Deferred until architecture is selected |
| Next-work writeup | MVP Extended, Future scope, known limitations, and production hardening | Seeded by this PRD |
| Meaningful Git history | Incremental, scoped commits showing planning, workflow, UI, tests, and documentation | Scope document ready as first commit |
| Complete AI interaction logs | Full exported conversations from initial planning through delivery | In progress; this conversation is required |
| Required AI usage | Logs show prompts, decisions, corrections, verification, and human direction | In progress |
| Engineering quality | Passing lint, type, unit, build, and relevant integration gates with CI evidence | Planned |
| Pragmatic scope | Traceability from MVP Core acceptance to explicit deferrals and trade-offs | Defined in this PRD |

Supporting evidence should also include:

- exact test and CI commands with results;
- GitHub Actions run URLs tied to exact commit SHAs;
- read-only Kubernetes permission proof;
- demo inputs and expected outcomes;
- screenshots or a short demo recording where useful;
- hosted URL if hosted demo is completed;
- known blockers and failed gates, not only successful output; and
- implementation timebox start, stop, and scope-cut record.

### Evidence collection rules

- Collect evidence during work, not retrospectively at submission time.
- Preserve exact commit SHAs and the source state used for every final proof.
- Export every AI conversation in full; a summary is not a substitute.
- Include this planning conversation in the AI interaction log.
- Never place tokens, deploy keys, kubeconfigs, secrets, or sensitive
  infrastructure values in Git history, logs, screenshots, or AI exports.
- If redaction is required, use an explicit redaction marker and state why.
- Do not claim a test, deployment, or demo passed without retained evidence.
- Run a final deliverables audit before submission; any missing required item
  blocks completion.

## 17. Explicit exclusions

- Kubernetes mutation or remediation.
- Kubernetes deployment of DriftLens in MVP Core.
- Scheduling, continuous monitoring, alerts, or notifications.
- Multiple clusters, tenants, or application-managed authentication.
- Resources other than `apps/v1` Deployment.
- Multi-document or directory manifest processing.
- Helm, Kustomize, Jsonnet, or CRD support.
- Arbitrary private-repository credential onboarding.
- Cluster-wide discovery.
- Live-only container drift.
- Automatic retries or restart resumability.
- Full-manifest forensic persistence or audit logging.
- Monitoring dashboard, analytics charts, or interactive AI chat.
- Production HA and horizontal scaling.

## 18. MVP Core acceptance

MVP Core is complete when:

- local setup works from documented steps;
- UI initiates a real read-only scan through backend API;
- progress and actionable failure are visible;
- `IN_SYNC`, `DRIFTED`, and `MISSING_LIVE` are demonstrated;
- replica and image differences are exact and deterministic;
- scan state and history persist;
- operator can request an explanation for every completed outcome;
- happy, edge, and failure tests pass;
- lint and type checks pass;
- README, architecture overview, trade-offs, next-work writeup, meaningful
  commits, and complete secret-safe AI interaction logs are present.

Delivery priority:

1. deterministic Git-to-cluster scan and backend API;
2. focused UI with progress and result;
3. persisted scan state and history;
4. manual AI explanation;
5. tests and required submission documentation.

All five priorities remain Core acceptance gates. If the timebox expires before
they pass, stop with an incomplete Core rather than starting Extended work.
MVP Extended starts only after every MVP Core acceptance item passes.
