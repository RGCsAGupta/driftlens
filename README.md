# DriftLens

DriftLens is a focused operator tool for comparing the desired state of one
Kubernetes `apps/v1` Deployment with its live cluster state. The current API
starts one read-only scan, exposes persisted progress and history, and reports
exact replica and regular-container image differences.

## Prerequisites

- Node.js `24.15.0`
- npm `11`
- Docker for the production-container check

## Local setup

```bash
export DRIFTLENS_GITHUB_REPOSITORY=owner/public-repository
export DRIFTLENS_MANIFEST_PATH=path/to/deployment.yaml
export DRIFTLENS_KUBECONFIG_PATH=/absolute/path/to/read-only.kubeconfig
# Optional: export DRIFTLENS_KUBECONTEXT=explicit-context

npm ci
npm run dev
```

Open `http://localhost:3000`.

The configured GitHub repository must be public. The manifest path must be a
safe relative path to one plain-YAML `apps/v1` Deployment with explicit
`metadata.name` and `metadata.namespace`. The kubeconfig identity must have
only the namespaced Deployment `get` permission needed for the target.

## Scan API

| Endpoint             | Success | Purpose                                      |
| -------------------- | ------- | -------------------------------------------- |
| `GET /api/source`    | `200`   | Non-secret repository and manifest metadata  |
| `POST /api/scans`    | `202`   | Persist and schedule one scan                |
| `GET /api/scans`     | `200`   | Newest-first history, default 20, maximum 50 |
| `GET /api/scans/:id` | `200`   | Status, stages, target, result, safe failure |

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
bootstraps schema version 1 idempotently and uses prepared statements for every
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
npm run test:scanner
npm run build
npm run audit
npm run secret:scan
```

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

## Current limitations

- One configured public GitHub source and one Deployment per application
  instance.
- One active in-process scan; no concurrency, cancellation, automatic retry,
  overall workflow timeout, or restart resumability.
- Replicas and regular-container images only.
- Read-only namespaced Deployment lookup only; no list, watch, or write.
- No operator scan UI yet.
- No AI explanation yet.
- No private Git, configuration CRUD, live `kind` proof, or infrastructure
  changes in this slice.

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
