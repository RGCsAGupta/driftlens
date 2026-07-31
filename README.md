# DriftLens

DriftLens is a focused operator tool for comparing the desired state of one
Kubernetes `apps/v1` Deployment with its live cluster state. The current
foundation provides the application shell and operational contracts; scan
behavior arrives in the next approved vertical slice.

## Prerequisites

- Node.js `24.15.0`
- npm `11`
- Docker for the production-container check

## Local setup

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Operational endpoints

| Endpoint           | Success        | Purpose                                                |
| ------------------ | -------------- | ------------------------------------------------------ |
| `GET /api/health`  | `200`          | Process liveness independent of external configuration |
| `GET /api/ready`   | `200` or `503` | Configuration readiness with safe issue codes          |
| `GET /api/version` | `200`          | Embedded build commit SHA                              |

Successful responses use these stable shapes:

```json
{"service":"driftlens","status":"ok"}
{"checks":{"configuration":"pass"},"issues":[],"service":"driftlens","status":"ready"}
{"buildSha":"0123456789abcdef0123456789abcdef01234567","service":"driftlens"}
```

Readiness failures return `503`, set `status` to `not_ready`, set the
configuration check to `fail`, and report only safe issue codes:

| Issue code             | Action                                                    |
| ---------------------- | --------------------------------------------------------- |
| `RUNTIME_MODE_INVALID` | Set `NODE_ENV` to `development`, `test`, or `production`  |
| `BUILD_SHA_REQUIRED`   | Inject a full commit SHA when building a production app   |
| `BUILD_SHA_INVALID`    | Use exactly 40 lowercase hexadecimal characters           |
| `DATA_DIR_INVALID`     | Use an absolute, null-byte-free production data directory |

Local development defaults to build version `development`. Production requires
`DRIFTLENS_BUILD_SHA` at build time as a lowercase, full 40-character Git SHA.
The value is embedded during `next build` and cannot be changed through the
runtime environment. A missing or invalid production value leaves health
successful but makes readiness fail.

`NODE_ENV` must be exactly `development`, `test`, or `production`. A missing or
unknown value leaves liveness successful but fails readiness with the safe
`RUNTIME_MODE_INVALID` code.

`DRIFTLENS_DATA_DIR` reserves the persistent-data location for the later SQLite
slice. It defaults to `.driftlens` locally and `/data` in production. A
production override must be an absolute path.

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
  driftlens:"$(git rev-parse HEAD)"
```

The final image runs as an unprivileged user. Validate it with:

```bash
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
curl --fail http://localhost:3000/api/version
```

## Current limitations

- No scan workflow or Kubernetes access yet.
- No persistence yet.
- No AI explanation yet.
- No CI, Proxmox, Cloudflare, or domain configuration in this application
  foundation.

See [the PRD](docs/PRD.md), [architecture overview](docs/architecture.md), and
[AI evidence procedure](docs/ai-interaction-evidence.md).
