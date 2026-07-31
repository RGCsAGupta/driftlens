import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateDeploymentPolicy } from "../scripts/deployment-policy.mjs";

const deploymentRoot = new URL("../ops/deployment/v1/", import.meta.url);

async function deploymentScripts() {
  const [bootstrap, release, smoke] = await Promise.all(
    ["bootstrap.sh", "release.sh", "smoke.sh"].map((name) =>
      readFile(new URL(name, deploymentRoot), "utf8"),
    ),
  );

  return { bootstrap, release, smoke };
}

test("versioned target scripts satisfy the private Docker contract", async () => {
  const scripts = await deploymentScripts();

  assert.doesNotThrow(() => validateDeploymentPolicy(scripts));
});

test("last-known-good metadata is required for rollback", async () => {
  const scripts = await deploymentScripts();
  scripts.release = scripts.release.replace(
    'cp -p "$release_root/current"',
    'cp -p "$release_root/candidate"',
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("mutable image references fail the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.release = scripts.release.replace(
    "@sha256:[0-9a-f]{64}",
    ":[A-Za-z0-9._-]+",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("writable container roots fail the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.smoke = scripts.smoke.replace("--read-only", "--read-write");

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("repository permission drift fails the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.release = scripts.release.replace("stat -c '%a'", "stat -c '%A'");

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("privileged deployment accounts fail the bootstrap policy", async () => {
  const scripts = await deploymentScripts();
  scripts.bootstrap = scripts.bootstrap.replace(
    "deployment user must be non-root",
    "deployment user may be root",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("unbounded endpoint requests fail the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.smoke = scripts.smoke.replace(
    "AbortSignal.timeout(3000)",
    "undefined",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("failed stable smoke must stop the unverified origin", async () => {
  const scripts = await deploymentScripts();
  scripts.smoke = scripts.smoke.replace(
    "trap cleanup_unverified_origin EXIT INT TERM",
    "trap - EXIT INT TERM",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("version smoke must compare the exact build SHA", async () => {
  const scripts = await deploymentScripts();
  scripts.smoke = scripts.smoke.replace(
    "result.version.buildSha !== expected",
    "result.version.buildSha === expected",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});
