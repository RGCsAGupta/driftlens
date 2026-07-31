import assert from "node:assert/strict";

const FULL_SHA = "[0-9a-f]{40}";
const APPROVED_ACTIONS = new Map([
  ["actions/cache", "55cc8345863c7cc4c66a329aec7e433d2d1c52a9"],
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
]);
const FORBIDDEN_EVENTS = [
  "pull_request",
  "pull_request_target",
  "issue_comment",
  "workflow_dispatch",
  "workflow_call",
  "schedule",
];

function jobSlice(workflow, jobName, nextJobName) {
  const start = workflow.indexOf(`  ${jobName}:`);
  assert.notEqual(start, -1, `missing ${jobName} job`);

  if (!nextJobName) {
    return workflow.slice(start);
  }

  const end = workflow.indexOf(`  ${nextJobName}:`, start + 1);
  assert.notEqual(end, -1, `missing ${nextJobName} job`);
  return workflow.slice(start, end);
}

export function validateWorkflowPolicy(workflow) {
  assert.match(workflow, /^on:\n {2}push:\n {4}branches:\n {6}- "\*\*"$/m);
  for (const event of FORBIDDEN_EVENTS) {
    assert.doesNotMatch(workflow, new RegExp(`^  ${event}:`, "m"));
  }

  assert.match(workflow, /^permissions:\n {2}contents: read$/m);

  const actionReferences = [...workflow.matchAll(/^\s+uses:\s+([^\s#]+)$/gm)];
  assert.ok(actionReferences.length > 0, "workflow must use pinned actions");
  for (const [, reference] of actionReferences) {
    assert.match(reference, new RegExp(`^[^@]+@${FULL_SHA}$`));
    const [action, revision] = reference.split("@");
    assert.equal(
      APPROVED_ACTIONS.get(action),
      revision,
      `unapproved action reference: ${action}`,
    );
  }

  const verify = jobSlice(workflow, "verify", "release");
  assert.match(verify, /name: verify/);
  assert.match(verify, /github\.repository == 'RGCsAGupta\/driftlens'/);
  assert.match(verify, /github\.actor == github\.repository_owner/);
  assert.match(verify, /- driftlens-ci/);
  assert.match(verify, /timeout-minutes: 20/);
  assert.match(verify, /node --test/);
  assert.match(verify, /tests\/workflow-policy\.test\.mjs/);
  assert.match(verify, /tests\/deployment-policy\.test\.mjs/);
  assert.match(verify, /sh -n ops\/deployment\/v1\/\*\.sh/);
  assert.match(verify, /npm ci/);
  assert.match(verify, /npx playwright install chromium/);
  assert.match(verify, /npm run verify/);
  assert.doesNotMatch(verify, /REGISTRY_PASSWORD|DEPLOY_SSH_KEY/);

  const release = jobSlice(workflow, "release");
  assert.match(release, /github\.ref == 'refs\/heads\/main'/);
  assert.match(release, /- driftlens-deploy/);
  assert.match(release, /timeout-minutes: 30/);
  assert.match(release, /name: private-demo/);
  assert.match(release, /group: driftlens-private-deployment/);
  assert.match(release, /cancel-in-progress: false/);
  assert.match(release, /driftlens:\$\{GITHUB_SHA\}/);
  assert.match(release, /DRIFTLENS_BUILD_SHA=\$GITHUB_SHA/);
  assert.match(release, /image_digest/);
  assert.match(release, /repository="\$\{REGISTRY%\/\}\/driftlens"/);
  assert.match(release, /\$\{candidate%%@\*\}" = "\$repository"/);
  assert.doesNotMatch(release, /(^|[^a-z])latest([^a-z]|$)/i);
  assert.match(release, /BatchMode yes/);
  assert.match(release, /StrictHostKeyChecking yes/);
  assert.match(release, /UserKnownHostsFile /);
  assert.match(release, /echo "::add-mask::\$value"/);
  assert.match(
    release,
    /DOCKER_CONFIG: \$\{\{ runner\.temp \}\}\/driftlens-docker-config/,
  );
  assert.match(release, /install -m 0700 -d "\$DOCKER_CONFIG"/);
  assert.match(release, /rm -f "\$DOCKER_CONFIG\/config\.json"/);
  assert.match(
    release,
    /printf '%s\\n' "\$REGISTRY_USERNAME"[\s\S]*printf '%s\\n' "\$REGISTRY_PASSWORD"[\s\S]*ssh -F "\$RUNNER_TEMP\/driftlens-ssh\/config"/,
  );
  assert.match(
    release,
    /sudo --non-interactive \/usr\/local\/sbin\/driftlens-release/,
  );
  assert.match(
    release,
    /sudo --non-interactive \/usr\/local\/sbin\/driftlens-smoke\s+\\?\n\s+"\$GITHUB_SHA"/,
  );
  assert.match(release, /if: always\(\)/);
}
