# DriftLens

DriftLens is a focused operator tool for comparing the desired state of one
Kubernetes `apps/v1` Deployment with its live cluster state. The current API
starts one read-only scan, exposes persisted progress and history, and reports
exact replica and regular-container image differences.

It is for a platform engineer, reviewer, or automation agent who can provide
one Deployment manifest in a **public GitHub repository** and one **read-only
Kubernetes kubeconfig/context** that can reach the matching live Deployment.
DriftLens reads both sides and reports drift; it never applies or remediates
desired state.

One running instance targets one repository/path and one cluster/context.
Restart with different configuration, or run another isolated instance, to
analyze another target.

## Documentation map

| Audience or task                | Start here                                         |
| ------------------------------- | -------------------------------------------------- |
| Human local operator            | Prerequisites, target preparation, and local setup |
| Automation or coding agent      | `AGENTS.md`, then the agent setup contract below   |
| API consumer                    | `docs/openapi.yaml` and the Scan API section       |
| Disposable `kind` demonstration | `docs/demo-cluster.md`                             |
| Architecture and trade-offs     | `docs/architecture.md` and `docs/PRD.md`           |
| AI evidence reviewer            | `docs/ai-interaction-evidence.md` and its manifest |
| Private deployment operator     | `docs/delivery.md`                                 |

## Prerequisites

- Git and outbound HTTPS access to the configured public GitHub repository.
- Node.js `24.15.0`; `.node-version`, `.nvmrc`, `package.json`, CI, and the
  container pin Node 24.
- npm `11` and the checked-in `package-lock.json`.
- `kubectl` for target/RBAC validation. DriftLens uses the Kubernetes
  JavaScript client and does not shell out to `kubectl`.
- Network reachability from the DriftLens process to the Kubernetes API.
- Docker only for the disposable `kind` demo, production-container check, or
  containerized run.

This repository uses the exact Node 24 patch for reproducibility and
`node:sqlite`. See the official
[Node release schedule](https://nodejs.org/en/about/previous-releases) and
[Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation).

## Prepare a desired-state repository

DriftLens reads GitHub through server-side commit and repository-content REST
APIs. It does **not** read the local checkout. Commit and push a manifest before
asking DriftLens to resolve it.

The source contract is:

- public `owner/repository`; private-repository credentials are unsupported;
- a safe relative path such as `deployments/api.yaml`;
- one plain YAML document, not Helm, Kustomize, Jsonnet, or a YAML list;
- one `apps/v1` `Deployment`; and
- explicit `metadata.name` and `metadata.namespace`.

The repository contains [a minimal example](demo/deployment.yaml). For your own
repository, commit and push an equivalent manifest:

```bash
git add path/to/deployment.yaml
git commit -m "docs(kubernetes): add desired deployment"
git push origin YOUR_BRANCH
git rev-parse HEAD
```

The UI accepts `YOUR_BRANCH` or the full 40-character commit SHA. DriftLens
resolves that ref to an immutable SHA before retrieving the configured file.
GitHub's official [repository-contents endpoint](https://docs.github.com/en/rest/repos/contents#get-repository-content)
defines this upstream lookup.

## Prepare any Kubernetes cluster

The cluster may be local `kind`, a development cluster, or another authorized
cluster reachable from the machine running DriftLens. The desired manifest's
namespace and name determine the exact live read.

Use a dedicated kubeconfig identity. The minimum recommended Role is
namespace-scoped and restricts `get` to the target Deployment:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: driftlens-reader
  namespace: YOUR_NAMESPACE
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    resourceNames: ["YOUR_DEPLOYMENT"]
    verbs: ["get"]
```

An authorized administrator must bind that Role to a dedicated user or
ServiceAccount and deliver its kubeconfig outside the repository. Credential
creation differs by provider. Do not give DriftLens an administrator
kubeconfig merely to simplify setup. Follow the official
[RBAC good practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/)
and [kubeconfig guidance](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/).

Validate the selected credential without printing its content:

```bash
export DRIFTLENS_KUBECONFIG_PATH=/absolute/path/to/read-only.kubeconfig
export DRIFTLENS_KUBECONTEXT=your-read-only-context
export TARGET_NAMESPACE=your-namespace
export TARGET_DEPLOYMENT=your-deployment

kubectl --kubeconfig "$DRIFTLENS_KUBECONFIG_PATH" \
  --context "$DRIFTLENS_KUBECONTEXT" \
  auth can-i get "deployment/$TARGET_DEPLOYMENT" \
  --namespace "$TARGET_NAMESPACE"

kubectl --kubeconfig "$DRIFTLENS_KUBECONFIG_PATH" \
  --context "$DRIFTLENS_KUBECONTEXT" \
  auth can-i create deployments.apps \
  --namespace "$TARGET_NAMESPACE"

kubectl --kubeconfig "$DRIFTLENS_KUBECONFIG_PATH" \
  --context "$DRIFTLENS_KUBECONTEXT" \
  auth can-i get secrets \
  --namespace "$TARGET_NAMESPACE"
```

Expected results: the named Deployment read is `yes`; Deployment creation and
Secret reads are `no`. Also deny list, watch, update, patch, and delete. The
official [`kubectl auth can-i` reference](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_auth/kubectl_auth_can-i/)
documents these non-mutating authorization checks.

For a self-contained disposable target, follow the
[pinned `kind` bootstrap, scenario, verification, and teardown guide](docs/demo-cluster.md).

## Local setup

Clone and install the lockfile-defined dependencies:

```bash
git clone https://github.com/RGCsAGupta/driftlens.git
cd driftlens
node --version
npm --version
npm ci
```

Create a local ignored configuration file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
DRIFTLENS_GITHUB_REPOSITORY=owner/public-repository
DRIFTLENS_MANIFEST_PATH=path/to/deployment.yaml
DRIFTLENS_KUBECONFIG_PATH=/absolute/path/to/read-only.kubeconfig
DRIFTLENS_KUBECONTEXT=explicit-read-only-context

# Optional until manual AI analysis is required. Both values are required
# together; keep the key server-side and never commit it.
OPENAI_API_KEY=replace-locally
OPENAI_MODEL=gpt-5.6
```

Never commit or print `.env.local`. It may contain the server-side OpenAI key
and a kubeconfig **path**; it must never contain kubeconfig content,
certificates, or unrelated credentials.

Start the long-lived local server:

```bash
npm run dev
```

Open `http://localhost:3000`, or validate the machine-readable endpoints:

```bash
curl --fail-with-body http://localhost:3000/api/health
curl --fail-with-body http://localhost:3000/api/ready
curl --fail-with-body http://localhost:3000/api/source
```

Health proves the process is alive. Readiness proves configuration and SQLite
writeability. `/api/source` returns public repository/path metadata, never
kubeconfig information.

The configured GitHub repository must be public. The manifest path must be a
safe relative path to one plain-YAML `apps/v1` Deployment with explicit
`metadata.name` and `metadata.namespace`. The kubeconfig identity must have
only the namespaced Deployment `get` permission needed for the target.

## Run and interpret a scan

1. Open the operator console.
2. Enter a pushed branch or full commit SHA from the configured repository.
3. Choose **Run scan**.
4. Retain the resolved SHA, target identity, stages, terminal status, and safe
   result/error when collecting evidence.

| Outcome        | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `IN_SYNC`      | Supported desired/live replicas and images match exactly          |
| `DRIFTED`      | A supported replica or regular-container image differs            |
| `MISSING_LIVE` | Desired Deployment exists in GitHub but not in the target cluster |

GitHub, YAML, Kubernetes authorization/availability, timeout, and storage
problems are failed executions, not drift. Correct the cause and start a new
scan; DriftLens does not automatically retry.

## Switch repositories or clusters

Configuration is process-wide. To inspect another target:

1. stop the local process;
2. change repository/path and kubeconfig/context in `.env.local`;
3. optionally set a separate absolute `DRIFTLENS_DATA_DIR` so histories do not
   mix;
4. restart the process; and
5. re-run health, readiness, source, and RBAC validation.

Do not change configuration while a scan is active. Core has no multi-cluster,
multi-repository, tenant, or configuration-UI abstraction.

## Agent setup contract

An agent can reproduce a target without hidden machine context when given:

| Input             | Required value                                          |
| ----------------- | ------------------------------------------------------- |
| Source repository | Public `owner/repository`                               |
| Manifest path     | Safe relative path to one supported Deployment          |
| Git ref           | Pushed branch or full commit SHA                        |
| Kubeconfig path   | Absolute path supplied out of band                      |
| Kube context      | Explicit read-only context when more than one exists    |
| Expected target   | Namespace and Deployment name from the desired manifest |
| Data directory    | Optional isolated absolute path                         |

Agent completion checks:

```text
1. Exact repository and branch/worktree state recorded.
2. Pinned Node/npm prerequisites and npm ci pass.
3. Desired file exists in public GitHub at the requested ref.
4. Named Deployment get is allowed; mutation and Secret reads are denied.
5. Health, readiness, and source endpoints pass without sensitive output.
6. One scan reaches a terminal state with a resolved immutable SHA.
7. No credential, kubeconfig content, private endpoint, or raw upstream body is logged.
```

Agents must not search for credentials, print kubeconfig content, substitute an
administrator identity, guess a private endpoint, or mutate a non-disposable
cluster. A required missing value is a blocker, not permission to infer one.

## Operator console

Open `http://localhost:3000`, enter one branch or full commit SHA, and choose
**Run scan**. The action stays unavailable while that browser session is
following an active scan. After a reload, the backend still rejects a
duplicate start with the safe `SCAN_ACTIVE` conflict.

The console shows the configured public repository and manifest path, every
Core stage, the resolved commit and Deployment identity, deterministic
outcomes, exact replica/image differences, safe failures, and newest-first
history. Selecting history updates the `scan` query parameter, so a selected
result survives reload without browser storage.

`IN_SYNC`, `DRIFTED`, `MISSING_LIVE`, and failed execution always include text
and do not rely on color. Failed scans are terminal; correct the reported issue
and start a new scan. There is no cancellation, retry, raw manifest/log view,
configuration UI, monitoring dashboard, or automatic explanation.

For any completed outcome, choose **Explain result** to make one manual AI
analysis request. The saved structured response is secondary to deterministic
truth and cannot alter scan status, outcome, or differences. Saved
explanations survive restart and are returned without another provider call.
A failed explanation is terminal and has no manual or automatic retry.

The UI renders only the API's bounded projection and safe error contract. It
never requests or displays GitHub credentials, kubeconfig content, tokens,
complete manifests, or raw upstream errors.

## Scan API

The formal, machine-readable contract for these routes is
[OpenAPI 3.1](docs/openapi.yaml). It also records the current authentication
and exposure boundary.

| Endpoint                          | Success | Purpose                                      |
| --------------------------------- | ------- | -------------------------------------------- |
| `GET /api/source`                 | `200`   | Non-secret repository and manifest metadata  |
| `POST /api/scans`                 | `202`   | Persist and schedule one scan                |
| `GET /api/scans`                  | `200`   | Newest-first history, default 20, maximum 50 |
| `GET /api/scans/:id`              | `200`   | Status, stages, target, result, safe failure |
| `POST /api/scans/:id/explanation` | `200`   | Request or reuse AI analysis                 |

Start and poll a scan:

```bash
curl --fail-with-body \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"ref":"main"}' \
  http://localhost:3000/api/scans

curl --fail-with-body http://localhost:3000/api/scans/SCAN_ID
curl --fail-with-body 'http://localhost:3000/api/scans?limit=20'
```

The request accepts one branch or commit SHA. DriftLens resolves the input
through the GitHub commits API and records the immutable 40-character SHA
before reading the configured file at that exact revision. A second start
while one in-process scan is active returns `409 SCAN_ACTIVE` without creating
another scan.

Stages are `QUEUED`, `LOADING_DESIRED`, `READING_LIVE`, `COMPARING`,
`SAVING_RESULT`, then `COMPLETED` or `FAILED`. Execution status is
`QUEUED`, `RUNNING`, `COMPLETED`, or `FAILED`.

### Comparison semantics

- Omitted desired replicas default to `1`.
- Desired regular containers match live regular containers by name.
- Image strings compare exactly.
- Missing desired containers report drift with a `null` live value.
- Extra live-only containers are ignored.
- Init, ephemeral, runtime-owned, and unrelated fields are ignored.
- Results are only `IN_SYNC`, `DRIFTED`, or `MISSING_LIVE`.

Git, manifest, Kubernetes authorization/availability, transport timeout, and
storage failures are execution errors, never drift. Public errors use stable
codes and safe messages without upstream bodies, credentials, kubeconfig
content, or complete manifests.

## Persistence

`DRIFTLENS_DATA_DIR` contains `driftlens.sqlite`. Node 24 `node:sqlite`
keeps rollback-compatible schema version 1 while adding explanation columns
idempotently. The previous immutable image ignores those additive columns and
can still pass storage readiness after rollback. Prepared statements bind every
dynamic value. The database retains only requested/resolved revisions,
supported projections and differences, target identity, timestamps, stages,
outcomes, and safe errors. It never stores complete manifests or kubeconfig
content.

One process owns one SQLite connection and one in-memory active-scan marker.
Restart preserves existing history but clears the marker. Stale `QUEUED` or
`RUNNING` records remain unchanged as evidence; Core does not resume, repair,
or delete them. If a later history write fails, the current process exposes a
non-durable safe storage failure without claiming that terminal state was
persisted. Non-durable terminal overlays are bounded; if that bound is
exceeded, new scans, history, and readiness fail closed with
`STORAGE_UNAVAILABLE` rather than exposing an older durable state as current
truth.

Structured scan logs contain only a generated scan identifier, stage or safe
error code, severity, and durability flag. They exclude refs, repository paths,
manifest content, kubeconfig data, credentials, and upstream error bodies.

## AI explanation boundary

The server uses the official OpenAI TypeScript SDK Responses API with Zod
Structured Outputs. `OPENAI_API_KEY` never reaches the browser or persistence;
`OPENAI_MODEL` must be configured, with `gpt-5.6` documented as the initial
value. Missing or blank key/model configuration becomes a safe terminal
explanation failure. The adapter sets `store: false`, one 12-second timeout,
`maxRetries: 0`, and a bounded output budget. Provider cost and availability
affect only a manual explanation, never scanning.

The provider receives only outcome, desired/live replica and regular-container
image projections, and deterministic field differences. DriftLens excludes
repository refs and authorization, commit SHA, target identity, manifests,
kubeconfig, history, raw errors/logs, secrets, and unrelated Kubernetes fields.
Refusal, incomplete or invalid output, timeout, missing configuration, and
provider failures become fixed safe persisted errors. There is no chat,
streaming, external retrieval, root-cause confirmation, remediation, provider
fallback, or retry.

## Operational endpoints

| Endpoint           | Success        | Purpose                                                |
| ------------------ | -------------- | ------------------------------------------------------ |
| `GET /api/health`  | `200`          | Process liveness independent of external configuration |
| `GET /api/ready`   | `200` or `503` | Configuration readiness with safe issue codes          |
| `GET /api/version` | `200`          | Embedded build commit SHA                              |

Successful responses use these stable shapes:

```json
{"service":"driftlens","status":"ok"}
{"checks":{"configuration":"pass","persistence":"pass"},"issues":[],"service":"driftlens","status":"ready"}
{"buildSha":"0123456789abcdef0123456789abcdef01234567","service":"driftlens"}
```

Readiness failures return `503`, set `status` to `not_ready`, set the
configuration or persistence check to `fail`, and report only safe issue codes:

Each readiness request performs a rolled-back SQLite write probe. The probe
verifies current write capability without retaining a scan or stage record.

| Issue code                   | Action                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `RUNTIME_MODE_INVALID`       | Set `NODE_ENV` to `development`, `test`, or `production`  |
| `BUILD_SHA_REQUIRED`         | Inject a full commit SHA when building a production app   |
| `BUILD_SHA_INVALID`          | Use exactly 40 lowercase hexadecimal characters           |
| `DATA_DIR_INVALID`           | Use an absolute, null-byte-free production data directory |
| `GITHUB_REPOSITORY_REQUIRED` | Configure one public GitHub `owner/repository`            |
| `GITHUB_REPOSITORY_INVALID`  | Use a valid GitHub `owner/repository` identifier          |
| `MANIFEST_PATH_REQUIRED`     | Configure one relative Deployment YAML path               |
| `MANIFEST_PATH_INVALID`      | Remove absolute, empty, dot, or parent segments           |
| `KUBECONFIG_PATH_REQUIRED`   | Configure an absolute kubeconfig path                     |
| `KUBECONFIG_PATH_INVALID`    | Use an absolute, null-byte-free path                      |
| `KUBECONTEXT_INVALID`        | Use a bounded context without control characters          |
| `CONFIGURATION_INVALID`      | Verify the configured kubeconfig is readable and valid    |
| `STORAGE_UNAVAILABLE`        | Verify the data directory and SQLite file are writable    |

Local development defaults to build version `development`. Production requires
`DRIFTLENS_BUILD_SHA` at build time as a lowercase, full 40-character Git SHA.
The value is embedded during `next build` and cannot be changed through the
runtime environment. A missing or invalid production value leaves health
successful but makes readiness fail.

`NODE_ENV` must be exactly `development`, `test`, or `production`. A missing or
unknown value leaves liveness successful but fails readiness with the safe
`RUNTIME_MODE_INVALID` code.

`DRIFTLENS_DATA_DIR` selects the directory containing the current
`driftlens.sqlite` scan-history database. It defaults to `.driftlens` locally
and `/data` in production. A production override must be an absolute path.

## Troubleshooting

| Symptom or safe code                      | Check                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Readiness is `not_ready`                  | Use its issue codes and the configuration table above             |
| `GITHUB_REF_NOT_FOUND`                    | Push the entered branch/SHA to the configured public repository   |
| `GITHUB_FILE_NOT_FOUND`                   | Confirm the configured relative path exists at that pushed ref    |
| `MANIFEST_INVALID`                        | Parse the YAML and add explicit Deployment name and namespace     |
| `MANIFEST_UNSUPPORTED`                    | Use one plain `apps/v1` Deployment document                       |
| `KUBERNETES_FORBIDDEN`                    | Re-run the named `auth can-i get` check with the exact context    |
| `KUBERNETES_TIMEOUT`                      | Check API reachability from the DriftLens host and client timeout |
| `KUBERNETES_UNAVAILABLE`                  | Check kubeconfig/context validity and API availability            |
| `STORAGE_UNAVAILABLE`                     | Check data-directory existence, permissions, and available space  |
| Scan remains queued/running after restart | Core does not resume it; retain it and start a new scan           |

Do not paste upstream response bodies, kubeconfig content, cluster endpoints,
or credentials into an issue when diagnosing these codes. The safe public code
and retained stage history are the intended first evidence.

## Quality gates

```bash
npm run verify
```

The command runs formatting, lint, strict type checking, unit coverage,
production build, production-dependency audit, and a bounded secret-pattern
scan. Unit tests do not use the network.

Individual commands are also available:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
npm run test:scanner
npm run build
npm run audit
npm run secret:scan
```

Chromium is required for the operator flow. The dedicated CI runner is
preprovisioned with the operating-system libraries
required by headless Chromium. The workflow installs the lockfile-pinned
headless browser payload with `npx playwright install chromium`; local
environments that need the operating-system libraries may use
`npx playwright install --with-deps chromium`. The
test runs with one worker, zero retries, and controlled same-origin API
adapters; it does not contact GitHub or Kubernetes.

## Production container

Build with the exact source revision:

```bash
docker build \
  --build-arg DRIFTLENS_BUILD_SHA="$(git rev-parse HEAD)" \
  -t driftlens:"$(git rev-parse HEAD)" .
```

Run with a persistent data volume:

```bash
docker run --rm \
  --publish 3000:3000 \
  --volume driftlens-data:/data \
  --volume /absolute/path/to/read-only.kubeconfig:/run/secrets/driftlens-kubeconfig:ro \
  --env DRIFTLENS_GITHUB_REPOSITORY=owner/public-repository \
  --env DRIFTLENS_MANIFEST_PATH=path/to/deployment.yaml \
  --env DRIFTLENS_KUBECONFIG_PATH=/run/secrets/driftlens-kubeconfig \
  driftlens:"$(git rev-parse HEAD)"
```

The final image runs as an unprivileged user. Validate it with:

```bash
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
curl --fail http://localhost:3000/api/version
```

The versioned private-target bootstrap, release, smoke, and rollback contract
is documented in [docs/delivery.md](docs/delivery.md).

## Public assessment route

The approved parent-issue release topology makes `nayanse.com` intentionally
public through one dedicated remotely managed Cloudflare Tunnel. The
outbound-only `cloudflared` connector runs on the same host as DriftLens and
routes to the existing private-interface application origin on port `3000`.

This route uses no Cloudflare Access application or policy, no shared reverse
proxy, and no router port-forward. Host firewall controls permit only the
same-host connector path and the dedicated deployment runner to reach port
`3000`; unrelated private-network clients are denied. Public proof has already
confirmed the exact deployed commit and failed direct-origin bypass. Local
setup does not require or create this route.

## Current limitations

- One configured public GitHub source and one Deployment per application
  instance.
- One active in-process scan; no concurrency, cancellation, automatic retry,
  overall workflow timeout, or restart resumability.
- Replicas and regular-container images only.
- Read-only namespaced Deployment lookup only; no list, watch, or write.
- AI analysis is manual, single-attempt, provider-dependent, and limited to the
  supported deterministic projection.
- No private Git, configuration UI, cancellation, retry, monitoring dashboard,
  or multi-user behavior.
- Live demo scenarios and release evidence are retained in issues #12 and #3.

Implementation follows the official
[Next.js `after()` contract](https://nextjs.org/docs/app/api-reference/functions/after),
[GitHub commit](https://docs.github.com/en/rest/commits/commits#get-a-commit)
and
[repository-content](https://docs.github.com/en/rest/repos/contents#get-repository-content)
APIs, the
[Kubernetes JavaScript client](https://github.com/kubernetes-client/javascript),
and [Node SQLite](https://nodejs.org/api/sqlite.html).

See [the PRD](docs/PRD.md), [architecture overview](docs/architecture.md), and
[AI evidence procedure](docs/ai-interaction-evidence.md).
