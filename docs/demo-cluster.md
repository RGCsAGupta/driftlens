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

For a local-only disposable demo, bind the `kind` API to loopback and keep both
kubeconfigs under the ignored `.driftlens` directory:

```bash
repository_root="$(pwd)"
ops/demo-cluster/v1/install-tools.sh "$repository_root/.driftlens/bin"
export PATH="$repository_root/.driftlens/bin:$PATH"
export DRIFTLENS_KIND_API_ADDRESS=127.0.0.1

ops/demo-cluster/v1/bootstrap.sh \
  "$repository_root/.driftlens/demo-reader.kubeconfig"
kind get kubeconfig --name driftlens-demo \
  >"$repository_root/.driftlens/demo-admin.kubeconfig"
chmod 0600 "$repository_root/.driftlens/demo-admin.kubeconfig"

ops/demo-cluster/v1/scenario.sh \
  "$repository_root/.driftlens/demo-admin.kubeconfig" in-sync
ops/demo-cluster/v1/verify.sh \
  "$repository_root/.driftlens/demo-reader.kubeconfig"
```

Configure DriftLens with public repository path `demo/deployment.yaml`, the
absolute reader-kubeconfig path, and reader context `driftlens-demo`. Enter a
pushed ref that contains the manifest. The administrator kubeconfig is only
for explicit scenario setup/teardown and must never be supplied to DriftLens.

Optional `DRIFTLENS_KIND_CLUSTER_NAME`, `DRIFTLENS_DEMO_NAMESPACE`, and
`DRIFTLENS_KIND_API_PORT` overrides are validated before use. Re-running the
bootstrap reuses the named cluster only when it is single-node and uses the
expected pinned image; Kubernetes resources are applied idempotently.

The generated kubeconfig is mode `0400`, embeds the cluster CA and service
account token, selects an explicit context, and contains no exec plugin or
external credential file. Transfer and target installation use the private
binding mechanism from issue #13; never paste the file into GitHub or AI
evidence.

## Desired workload and scenarios

`demo/deployment.yaml` is the public desired state used by DriftLens. It
contains one namespaced `apps/v1` Deployment with a digest-pinned public image.
Scenario mutations require the local `kind` administrator kubeconfig; never use
the DriftLens read-only kubeconfig for mutation.

```bash
ops/demo-cluster/v1/scenario.sh /secure/private/kind-admin.kubeconfig in-sync
ops/demo-cluster/v1/scenario.sh /secure/private/kind-admin.kubeconfig drifted
ops/demo-cluster/v1/scenario.sh /secure/private/kind-admin.kubeconfig missing-live
ops/demo-cluster/v1/scenario.sh /secure/private/kind-admin.kubeconfig access-failure
ops/demo-cluster/v1/scenario.sh /secure/private/kind-admin.kubeconfig restore-access
```

The script accepts only the fixed `driftlens-demo` cluster, namespace,
Deployment, container, and reader RoleBinding. Each action uses bounded waits;
deletion ignores an already-absent target. Repeating an action is safe. For
failure recovery, run `access-failure`, retain the failed scan, run
`restore-access`, then start a new scan. This is a new workflow execution, not
an automatic retry.

The 2026-07-31 15:02 UTC scan that reached `LOADING_DESIRED` and ended with
`GITHUB_FILE_NOT_FOUND` is valid failure-history evidence for the previously
missing repository manifest, not evidence of an application outage. Retain a
screenshot only after secret review and crop any private origin or topology.

The scenario commands follow the official Kubernetes references for
[`kubectl apply`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/),
[`kubectl scale`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_scale/),
and [`kubectl set image`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_set/kubectl_set_image/).

## Verification and recovery

`verify.sh` proves a real Deployment read request and the authorization matrix:
Deployment `get` is allowed while list, watch, mutation, and Secret reads are
denied. It prints only a sanitized summary.

If bootstrap fails before kubeconfig installation, correct the prerequisite
and rerun.

## Teardown

The default removes only the named workload and retains the cluster and
read-only RBAC for another scenario:

```bash
ops/demo-cluster/v1/teardown.sh /secure/private/kind-admin.kubeconfig
```

Delete the named disposable cluster only after evidence retention, using the
explicit flag:

```bash
ops/demo-cluster/v1/teardown.sh /secure/private/kind-admin.kubeconfig --delete-cluster
```

Both modes are idempotent. The script does not delete kubeconfig files and
prints neither configuration contents nor API endpoints. Cluster deletion uses
the official [kind named-cluster procedure](https://kind.sigs.k8s.io/docs/user/quick-start/#deleting-a-cluster).
