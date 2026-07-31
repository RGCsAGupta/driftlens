# Demo cluster bootstrap

Issue #17 uses one disposable, single-node `kind` cluster and one namespaced
service account. The repository contains no endpoint, credential, VM identity,
or other private topology value.

## Pinned contract

- `kind` v0.32.0 (Linux amd64 binary SHA-256 pinned in the installer)
- `kubectl` v1.35.5 (Linux amd64 binary SHA-256 pinned in the installer)
- `kindest/node` v1.35.5 pinned by digest
- one `driftlens-demo` cluster and `driftlens-demo` namespace by default
- only `get` on namespaced `apps/v1` Deployments

The versions follow the official [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/)
and [kubectl Linux installation](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/)
download contracts.

## Bootstrap

Run on the approved demo-cluster host. Keep the address and generated
kubeconfig outside logs and source control.

```bash
sudo ops/demo-cluster/v1/install-tools.sh /usr/local/bin
export DRIFTLENS_KIND_API_ADDRESS='<approved-private-IP>'
ops/demo-cluster/v1/bootstrap.sh /secure/private/driftlens.kubeconfig
ops/demo-cluster/v1/verify.sh /secure/private/driftlens.kubeconfig
```

Optional `DRIFTLENS_KIND_CLUSTER_NAME`, `DRIFTLENS_DEMO_NAMESPACE`, and
`DRIFTLENS_KIND_API_PORT` overrides are validated before use. Re-running the
bootstrap reuses the named cluster only when it is single-node and uses the
expected pinned image; Kubernetes resources are applied idempotently.

The generated kubeconfig is mode `0400`, embeds the cluster CA and service
account token, selects an explicit context, and contains no exec plugin or
external credential file. Transfer and target installation use the private
binding mechanism from issue #13; never paste the file into GitHub or AI
evidence.

## Verification and recovery

`verify.sh` proves a real Deployment read request and the authorization matrix:
Deployment `get` is allowed while list, watch, mutation, and Secret reads are
denied. It prints only a sanitized summary.

If bootstrap fails before kubeconfig installation, correct the prerequisite
and rerun. Teardown remains part of issue #12 so the named demo cluster is not
deleted accidentally during this prerequisite.
