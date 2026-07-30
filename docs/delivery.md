# Trusted delivery foundation

DriftLens uses one canonical-repository, push-only GitHub Actions workflow.
Trusted owner pushes run verification on the isolated CI identity. A protected
`main` push continues on the separate deployment identity only after
verification succeeds.

No pull-request, fork, comment, schedule, dependency-bot, reusable, or manual
event can schedule this repository's self-hosted jobs. External changes require
owner review and a new trusted branch in the canonical repository.

## Public-safe prerequisites

- Existing isolated CI and deployment identities receive repository-scoped
  DriftLens runner registrations with distinct `driftlens-ci` and
  `driftlens-deploy` labels.
- The `private-demo` GitHub environment permits protected `main` only.
- Environment secrets bind the existing least-privilege registry publisher,
  pinned SSH trust, and deployment identity. Secret values, internal addresses,
  and identity names never belong in repository content or logs.
- The private target preinstalls `/usr/local/sbin/driftlens-release` and
  `/usr/local/sbin/driftlens-smoke`. Its `sudoers` rule permits only those
  commands for the deployment identity.

No new runner host, OS identity, Proxmox environment, registry authority,
Cloudflare account, tunnel, access policy, hostname, public route, or router
forwarding is part of this foundation.

## Immutable release contract

The release command accepts exactly:

1. an image reference pinned by `sha256` digest; and
2. the matching 40-character Git commit SHA.

The publisher also tags the image with the full Git SHA. `latest` is forbidden.
The target release command must reject any digest or revision mismatch, retain
the previous immutable image and release metadata, and keep persistent data
outside the replaceable image lifecycle.

The target runs the image as its non-root image user with
`no-new-privileges`, a read-only root filesystem, a bounded temporary mount,
and one explicitly configured persistent data mount. It binds only to the
preconfigured private origin. It must not change Cloudflare or public routing.

After release, the deployment runner calls the private origin directly and
requires:

- `/api/health`: service `driftlens`, status `ok`;
- `/api/ready`: ready status, passing configuration, no issues; and
- `/api/version`: the exact merged 40-character Git SHA.

Any request, payload, readiness, or version mismatch fails delivery. The smoke
command reads its preconfigured private origin without printing it.

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
node --test tests/workflow-policy.test.mjs
```

The workflow policy test covers the trusted happy path, non-cancelling
deployment edge, mutable-tag failure, and exact-version smoke failure without
network access.

## Official references

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Secure use of GitHub Actions](https://docs.github.com/en/actions/concepts/security/secure-use)
- [Managing deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Adding self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [Protected branches REST API](https://docs.github.com/en/rest/branches/branch-protection)
