# Trusted delivery foundation

DriftLens uses one canonical-repository, push-only GitHub Actions workflow.
Trusted owner pushes run verification on the isolated CI identity. A protected
`main` push continues on the separate deployment identity only after
verification succeeds.

No pull-request, fork, comment, schedule, dependency-bot, reusable, or manual
event can schedule this repository's self-hosted jobs. External changes require
owner review and a new trusted branch in the canonical repository.

## Public-safe prerequisites

- Dedicated private hosts isolate the Docker application runtime, private demo
  cluster, and self-hosted runner services.
- The runner host uses distinct non-sudo CI and deployment services
  with repository-scoped registrations and separate labels. Former shared
  services remain disabled; retained registrations are rollback-only.
- The `private-demo` GitHub environment permits protected `main` only.
- Environment secrets bind the existing least-privilege registry publisher,
  pinned SSH trust, and deployment identity. Secret values, internal addresses,
  and identity names never belong in repository content or logs.
- The dedicated application target runs DriftLens with Docker only. The
  separate demo-cluster host is not an application deployment target.

No host or identity beyond this approved dedicated topology, registry change,
Cloudflare account, tunnel, access policy, hostname, public route, or router
forwarding is part of this revision.

## Target bootstrap contract

The versioned scripts live in `ops/deployment/v1`. An operator runs
`bootstrap.sh` once on the dedicated application target. The bootstrap:

- requires Docker, a pre-existing deployment user, existing private-registry
  authentication, and a root-owned approved repository configuration;
- creates no user and performs no registry login or registry configuration;
- installs versioned `release.sh` and `smoke.sh` implementations behind the
  stable `/usr/local/sbin/driftlens-release` and
  `/usr/local/sbin/driftlens-smoke` command paths; and
- validates a narrow `sudoers` rule before installation.

The repository deliberately contains no target identifier, registry endpoint,
credential, or internal address. Re-running the same version is idempotent.

## Immutable release contract

The release command accepts exactly:

1. an image reference pinned by `sha256` digest; and
2. the matching 40-character Git commit SHA.

The publisher also tags the image with the full Git SHA. `latest` is forbidden.
The target release command must reject any digest or revision mismatch, retain
the previous immutable image and release metadata, and keep persistent data
outside the replaceable image lifecycle.

The target pulls only from its root-owned approved repository configuration.
It runs the image as numeric non-root user `1001:1001` with all capabilities
dropped, `no-new-privileges`, a read-only root filesystem, a bounded temporary
mount, and one persistent data bind mount. The container publishes only on
loopback. It must not change Cloudflare or public routing.

After release, the target smoke command performs a bounded local readiness wait
inside the container and requires:

- `/api/health`: service `driftlens`, status `ok`;
- `/api/ready`: ready status, passing configuration, no issues; and
- `/api/version`: the exact merged 40-character Git SHA.

Any request, payload, hardening, readiness, or version mismatch fails delivery.
The release stops the current private origin before starting an isolated
candidate, so deployment has a bounded downtime window. A failed candidate or
stable-origin smoke removes the unverified container and leaves the origin
stopped for explicit manual rollback. Only a successful stable-origin smoke
promotes candidate metadata to current.

## Rollback

Rollback is manual. The operator invokes the same fixed release command with
the last-known-good immutable digest and its matching full Git SHA, then reruns
the private health, readiness, and version smoke.

Do not delete the failed artifact, candidate state, or last-known-good release
until failure evidence is retained. Repository settings, runner bindings,
environment bindings, credentials, Proxmox resources, and Cloudflare controls
require explicit authority before removal or reversion.

## Local policy checks

```bash
node --test \
  tests/workflow-policy.test.mjs \
  tests/deployment-policy.test.mjs
sh -n ops/deployment/v1/*.sh
```

The policy tests cover trusted workflow execution, non-cancelling deployment,
rollback metadata, immutable images, container hardening, and exact-version
smoke failure without network access.

## Official references

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Secure use of GitHub Actions](https://docs.github.com/en/actions/concepts/security/secure-use)
- [Managing deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Adding self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [Protected branches REST API](https://docs.github.com/en/rest/branches/branch-protection)
- [Docker run reference](https://docs.docker.com/reference/cli/docker/container/run/)
- [Docker CLI configuration files](https://docs.docker.com/reference/cli/docker/#configuration-files)
