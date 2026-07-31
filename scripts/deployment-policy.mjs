import assert from "node:assert/strict";

export function validateDeploymentPolicy({
  common,
  bootstrap,
  release,
  smoke,
}) {
  assert.match(common, /runtime_env_file=\/etc\/driftlens\/runtime\.env/);
  assert.match(common, /kubeconfig_file=\/etc\/driftlens\/kubeconfig/);
  assert.match(common, /origin_address_file=\/etc\/driftlens\/origin-address/);
  assert.match(common, /require_config_file "runtime environment".*0 0 600/);
  assert.match(common, /require_config_file "kubeconfig".*0 1001 440/);
  assert.match(common, /DRIFTLENS_KUBECONFIG_PATH=\$container_kubeconfig/);
  assert.match(common, /DRIFTLENS_GITHUB_REPOSITORY/);
  assert.match(common, /DRIFTLENS_MANIFEST_PATH/);
  assert.match(common, /DRIFTLENS_KUBECONTEXT/);
  assert.match(common, /runtime environment contains duplicate keys/);
  assert.match(common, /DRIFTLENS_BUILD_SHA\|HOSTNAME\|PORT/);
  assert.match(common, /kubeconfig must use flattened block-style YAML/);
  assert.match(common, /validate_runtime_environment/);
  assert.match(common, /validate_kubeconfig_content/);
  assert.match(common, /validate_private_ipv4/);
  assert.match(common, /validate_origin_address/);
  assert.match(common, /test "\$octet" -le 255/);
  assert.match(common, /test "\$2" -ge 16 && test "\$2" -le 31/);
  assert.match(common, /private origin address is invalid/);

  assert.match(bootstrap, /install_root=\/usr\/local\/libexec\/driftlens\/v1/);
  assert.match(bootstrap, /test "\$#" -eq 1/);
  assert.match(bootstrap, /deployment user must already exist/);
  assert.match(bootstrap, /deployment user must be non-root/);
  assert.match(
    bootstrap,
    /deployment user must not share the container identity/,
  );
  assert.match(bootstrap, /deployment user must not share the container group/);
  assert.match(bootstrap, /getent passwd 1001/);
  assert.match(bootstrap, /getent group 1001/);
  assert.match(bootstrap, /container UID must not map to a host account/);
  assert.match(bootstrap, /container GID must not map to a host group/);
  assert.match(bootstrap, /\(docker\|sudo\|wheel\)/);
  assert.doesNotMatch(bootstrap, /\b(?:adduser|useradd)\b/);
  assert.match(bootstrap, /image-repository/);
  assert.match(bootstrap, /install .*"\$script_root\/common\.sh"/);
  assert.match(bootstrap, /visudo -cf/);
  assert.match(bootstrap, /driftlens-release \*/);
  assert.match(bootstrap, /driftlens-smoke \*/);

  assert.match(release, /test "\$#" -eq 2/);
  assert.match(release, /@sha256:\[0-9a-f\]\{64\}/);
  assert.match(release, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(release, /stat -c '%u' "\$repository_file"/);
  assert.match(release, /stat -c '%a' "\$repository_file"/);
  assert.match(release, /approved image repository is invalid/);
  assert.match(release, /"\$\{image_digest%%@\*\}" = "\$repository"/);
  assert.match(release, /docker pull "\$image_digest"/);
  assert.match(
    release,
    /docker pull "\$image_digest" >\/dev\/null 2>&1 \|\| fail/,
  );
  assert.doesNotMatch(release, /docker login|(^|[^a-z])latest([^a-z]|$)/i);
  assert.match(release, /cp -p "\$release_root\/current"/);
  assert.match(release, /"\$release_root\/previous"/);
  assert.match(release, /"\$release_root\/candidate"/);
  assert.match(release, /--read-only/);
  assert.match(release, /--security-opt no-new-privileges/);
  assert.match(release, /--cap-drop ALL/);
  assert.match(release, /--user 1001:1001/);
  assert.match(release, /--tmpfs \/tmp:rw,noexec,nosuid,nodev,size=64m/);
  assert.match(release, /type=bind,source=\$data_root,target=\/data/);
  assert.match(release, /candidate_name=driftlens-candidate/);
  assert.doesNotMatch(release, /--publish/);
  assert.match(release, /--env-file "\$runtime_env_file"/);
  assert.match(
    release,
    /source=\$kubeconfig_file,target=\$container_kubeconfig,readonly/,
  );
  assert.match(release, /release candidate failed to start/);

  assert.match(smoke, /test "\$#" -eq 1/);
  assert.match(smoke, /test "\$candidate_revision" = "\$expected_revision"/);
  assert.match(smoke, /ReadonlyRootfs/);
  assert.match(smoke, /no-new-privileges/);
  assert.match(smoke, /CapDrop/);
  assert.match(smoke, /AbortSignal\.timeout\(2000\)/);
  assert.match(smoke, /AbortSignal\.timeout\(3000\)/);
  assert.match(smoke, /test "\$attempt" -lt 10/);
  assert.match(smoke, /\["health", "ready", "version"\]/);
  assert.match(smoke, /result\.version\.buildSha !== expected/);
  assert.match(smoke, /--read-only/);
  assert.match(smoke, /--env-file "\$runtime_env_file"/);
  assert.match(
    smoke,
    /source=\$kubeconfig_file,target=\$container_kubeconfig,readonly/,
  );
  assert.match(smoke, /--publish "\$origin_address:3000:3000"/);
  assert.doesNotMatch(smoke, /--publish (?:127\.0\.0\.1|0\.0\.0\.0)/);
  assert.match(smoke, /isolated release candidate smoke failed/);
  assert.match(smoke, /private origin smoke failed/);
  assert.match(smoke, /cleanup_unverified_origin/);
  assert.match(smoke, /trap cleanup_unverified_origin EXIT INT TERM/);
  assert.match(smoke, /stable_pending=0/);
  assert.match(
    smoke,
    /mv -f "\$release_root\/candidate" "\$release_root\/current"/,
  );
}
