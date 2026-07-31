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
  pinned SSH trust, and deployment identity. The deployment runner sends the
  registry username and password only through the pinned SSH command's standard
  input. Secret values, internal addresses, and identity names never belong in
  repository content or logs.
- The dedicated application target runs DriftLens with Docker only. The
  separate demo-cluster host is not an application deployment target.

No host or identity beyond this approved dedicated topology, registry change,
Cloudflare account, tunnel, access policy, hostname, public route, or router
forwarding is part of this revision.

## Target bootstrap contract

The versioned scripts live in `ops/deployment/v1`. An operator runs
`bootstrap.sh` once on the dedicated application target. The bootstrap:

- requires Docker, a pre-existing deployment user, and a root-owned approved
  repository configuration; no registry credential is persisted on the target;
- requires a root-owned mode-`0600` runtime environment file containing
  `NODE_ENV=production`, `DRIFTLENS_DATA_DIR=/data`, the fixed in-container
  kubeconfig path, `DRIFTLENS_GITHUB_REPOSITORY`,
  `DRIFTLENS_MANIFEST_PATH`, and an optional
  `DRIFTLENS_KUBECONTEXT`;
- requires a root-owned, container-group-readable mode-`0440` kubeconfig that
  is self-contained/flattened, uses no external credential files or exec
  plugins, and is mounted read-only at `/run/driftlens/kubeconfig`;
- requires a root-owned mode-`0600` private origin address containing one
  strict RFC1918 IPv4 address reachable by the existing proxy path;
- creates no user and performs no persistent registry login or registry
  configuration;
- installs versioned `release.sh` and `smoke.sh` implementations behind the
  stable `/usr/local/sbin/driftlens-release` and
  `/usr/local/sbin/driftlens-smoke` command paths; and
- validates a narrow `sudoers` rule before installation.

These target files live under `/etc/driftlens`; their values never enter the
repository or workflow logs. Runtime validation rejects duplicate or malformed
environment keys, GitHub owner/repository values outside the application
bounds, unsafe or over-500-character manifest paths, kubecontexts over 253
characters, immutable build/runtime overrides, ownership or mode drift,
external kubeconfig references, and non-private origin addresses. The existing
deployment user must be non-root, outside privileged groups, and must not share
the container UID or GID. The numeric container UID/GID must also have no host
passwd or group mapping. Bootstrap fails before installation on any collision;
it does not create network bindings or change proxy, registry, or Cloudflare
controls. Re-running the same version is idempotent.

## Immutable release contract

The release command accepts exactly:

1. an image reference pinned by `sha256` digest; and
2. the matching 40-character Git commit SHA.

The publisher also tags the image with the full Git SHA. `latest` is forbidden.
The target release command must reject any digest or revision mismatch, retain
the previous immutable image and release metadata, and keep persistent data
outside the replaceable image lifecycle.

The target pulls only from its root-owned approved repository configuration.
For each release, the workflow streams the existing environment-scoped
registry username and password over the pinned SSH standard-input channel. The
root release command uses them only with `docker login --password-stdin` and a
root-only temporary `DOCKER_CONFIG`. It logs out and removes that authentication
material after the verified pull and on every failure path. The target has no
persistent registry credential prerequisite.

It passes the validated runtime environment, mounts the validated kubeconfig
read-only, and runs the image as numeric non-root user `10001:10001` with all
capabilities dropped, `no-new-privileges`, a read-only root filesystem, a
bounded temporary mount, and one persistent data bind mount. The candidate is
unpublished. The stable container publishes only on the preprovisioned private
origin address required by the existing separate proxy path. Scripts do not
print that address or change Cloudflare or public routing.

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
- [Docker login reference](https://docs.docker.com/reference/cli/docker/login/)
- [Docker CLI configuration files](https://docs.docker.com/reference/cli/docker/#configuration-files)
