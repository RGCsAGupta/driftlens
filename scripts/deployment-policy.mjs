import assert from "node:assert/strict";

export function validateDeploymentPolicy({ bootstrap, release, smoke }) {
  assert.match(bootstrap, /install_root=\/usr\/local\/libexec\/driftlens\/v1/);
  assert.match(bootstrap, /test "\$#" -eq 1/);
  assert.match(bootstrap, /deployment user must already exist/);
  assert.match(bootstrap, /deployment user must be non-root/);
  assert.match(bootstrap, /\(docker\|sudo\|wheel\)/);
  assert.doesNotMatch(bootstrap, /\b(?:adduser|useradd)\b/);
  assert.match(bootstrap, /image-repository/);
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
  assert.match(smoke, /--publish 127\.0\.0\.1:3000:3000/);
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
