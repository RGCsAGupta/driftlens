import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateDeploymentPolicy } from "../scripts/deployment-policy.mjs";

const deploymentRoot = new URL("../ops/deployment/v1/", import.meta.url);
const commonPath = fileURLToPath(new URL("common.sh", deploymentRoot));
const validRuntimeEnvironment = [
  "NODE_ENV=production",
  "DRIFTLENS_DATA_DIR=/data",
  "DRIFTLENS_KUBECONFIG_PATH=/run/driftlens/kubeconfig",
  "DRIFTLENS_GITHUB_REPOSITORY=example/repository",
  "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
  "DRIFTLENS_KUBECONTEXT=example/context:west",
  "",
].join("\n");
const validKubeconfig = [
  "apiVersion: v1",
  "kind: Config",
  "clusters: []",
  "contexts: []",
  "users: []",
  "",
].join("\n");

function privateAddress(first, second, third, fourth) {
  return [first, second, third, fourth].join(".");
}

function runContentValidation({
  runtimeEnvironment = validRuntimeEnvironment,
  kubeconfig = validKubeconfig,
  originAddress = privateAddress("10", "250", "0", "1"),
} = {}) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "driftlens-policy-"));
  const runtimePath = join(fixtureRoot, "runtime.env");
  const kubeconfigPath = join(fixtureRoot, "kubeconfig");
  const originPath = join(fixtureRoot, "origin-address");

  writeFileSync(runtimePath, runtimeEnvironment);
  writeFileSync(kubeconfigPath, kubeconfig);
  writeFileSync(originPath, `${originAddress}\n`);

  const validation = spawnSync(
    "sh",
    [
      "-c",
      `
        fail() { printf '%s\\n' "$1" >&2; exit 1; }
        . "$1"
        runtime_env_file=$2
        kubeconfig_file=$3
        origin_address_file=$4
        validate_runtime_environment
        validate_kubeconfig_content
        validate_origin_address
      `,
      "deployment-policy",
      commonPath,
      runtimePath,
      kubeconfigPath,
      originPath,
    ],
    { encoding: "utf8" },
  );

  rmSync(fixtureRoot, { force: true, recursive: true });
  return validation;
}

async function deploymentScripts() {
  const [common, bootstrap, release, smoke] = await Promise.all(
    ["common.sh", "bootstrap.sh", "release.sh", "smoke.sh"].map((name) =>
      readFile(new URL(name, deploymentRoot), "utf8"),
    ),
  );

  return { common, bootstrap, release, smoke };
}

async function runReleaseWithFailedPull() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "driftlens-release-"));
  const mockBin = join(fixtureRoot, "bin");
  const stateRoot = join(fixtureRoot, "state");
  const repositoryPath = join(fixtureRoot, "image-repository");
  const registryAuthParent = join(fixtureRoot, "registry-auth");
  const dockerLog = join(fixtureRoot, "docker.log");
  const releasePath = join(fixtureRoot, "release.sh");
  const registry = "registry.example.test";
  const repository = `${registry}/driftlens`;
  const username = "release-user";
  const password = "not-a-real-secret";
  const digest = `${repository}@sha256:${"a".repeat(64)}`;
  const revision = "b".repeat(40);

  mkdirSync(mockBin);
  writeFileSync(repositoryPath, `${repository}\n`, { mode: 0o600 });
  writeFileSync(
    join(mockBin, "docker"),
    `#!/bin/sh
set -eu
printf '%s|%s\\n' "$1" "$DOCKER_CONFIG" >>"$MOCK_DOCKER_LOG"
case "$1" in
  login)
    supplied_password=$(cat)
    test "$supplied_password" = "$EXPECTED_REGISTRY_PASSWORD"
    install -m 0600 /dev/null "$DOCKER_CONFIG/config.json"
    ;;
  pull)
    exit 41
    ;;
  logout)
    test -f "$DOCKER_CONFIG/config.json"
    ;;
  *)
    exit 42
    ;;
esac
`,
  );
  chmodSync(join(mockBin, "docker"), 0o755);

  const release = (
    await readFile(new URL("release.sh", deploymentRoot), "utf8")
  )
    .replace(
      "PATH=/usr/sbin:/usr/bin:/sbin:/bin",
      `PATH=${mockBin}:/usr/sbin:/usr/bin:/sbin:/bin`,
    )
    .replace("state_root=/var/lib/driftlens", `state_root=${stateRoot}`)
    .replace(
      "repository_file=/etc/driftlens/image-repository",
      `repository_file=${repositoryPath}`,
    )
    .replace(
      "registry_auth_parent=/run/driftlens",
      `registry_auth_parent=${registryAuthParent}`,
    )
    .replace(
      ". /usr/local/libexec/driftlens/v1/common.sh",
      "validate_runtime_files() { :; }",
    );
  writeFileSync(releasePath, release, { mode: 0o700 });

  const result = spawnSync("sh", [releasePath, digest, revision], {
    encoding: "utf8",
    env: {
      ...process.env,
      EXPECTED_REGISTRY_PASSWORD: password,
      MOCK_DOCKER_LOG: dockerLog,
    },
    input: `${username}\n${password}\n`,
  });
  const dockerCalls = await readFile(dockerLog, "utf8");
  const authEntries = readdirSync(registryAuthParent);

  rmSync(fixtureRoot, { force: true, recursive: true });
  return {
    authEntries,
    dockerCalls,
    password,
    result,
    username,
  };
}

test("content validator accepts bounded private runtime fixtures", () => {
  for (const originAddress of [
    privateAddress("10", "250", "0", "1"),
    privateAddress("172", "31", "250", "1"),
    privateAddress("192", "168", "250", "1"),
  ]) {
    assert.equal(runContentValidation({ originAddress }).status, 0);
  }
});

test("content validator accepts exact application configuration bounds", () => {
  const runtimeEnvironment = validRuntimeEnvironment
    .replace(
      "DRIFTLENS_GITHUB_REPOSITORY=example/repository",
      `DRIFTLENS_GITHUB_REPOSITORY=${"a".repeat(39)}/${"r".repeat(100)}`,
    )
    .replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      `DRIFTLENS_MANIFEST_PATH=${"a".repeat(495)}.yaml`,
    )
    .replace(
      "DRIFTLENS_KUBECONTEXT=example/context:west",
      `DRIFTLENS_KUBECONTEXT=${"c".repeat(253)}`,
    );

  assert.equal(runContentValidation({ runtimeEnvironment }).status, 0);
});

test("content validator accepts #9-safe manifest characters", () => {
  const runtimeEnvironment = validRuntimeEnvironment.replace(
    "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
    "DRIFTLENS_MANIFEST_PATH=deploy manifests/example target",
  );

  assert.equal(runContentValidation({ runtimeEnvironment }).status, 0);
});

test("content validator rejects public, wildcard, loopback, and malformed origins", () => {
  for (const originAddress of [
    privateAddress("203", "0", "113", "9"),
    privateAddress("0", "0", "0", "0"),
    privateAddress("127", "0", "0", "1"),
    privateAddress("10", "999", "0", "1"),
    privateAddress("10", "01", "0", "1"),
    ["10", "0", "1"].join("."),
    `${privateAddress("10", "250", "0", "1")}.`,
    "[fd00::1]",
    "not-an-address",
  ]) {
    assert.notEqual(runContentValidation({ originAddress }).status, 0);
  }
});

test("content validator rejects malformed, duplicate, and reserved runtime settings", () => {
  const invalidEnvironments = [
    `${validRuntimeEnvironment}malformed setting\n`,
    `${validRuntimeEnvironment}NODE_ENV=production\n`,
    `${validRuntimeEnvironment}PORT=3000\n`,
    validRuntimeEnvironment.replace(
      "DRIFTLENS_GITHUB_REPOSITORY=example/repository\n",
      "",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_GITHUB_REPOSITORY=example/repository",
      "DRIFTLENS_GITHUB_REPOSITORY=-example/repository",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_GITHUB_REPOSITORY=example/repository",
      `DRIFTLENS_GITHUB_REPOSITORY=${"a".repeat(40)}/repository`,
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_GITHUB_REPOSITORY=example/repository",
      `DRIFTLENS_GITHUB_REPOSITORY=example/${"r".repeat(101)}`,
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      "DRIFTLENS_MANIFEST_PATH=../unsafe.yaml",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      "DRIFTLENS_MANIFEST_PATH=./deploy.yaml",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      "DRIFTLENS_MANIFEST_PATH=deploy/./example.yaml",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      "DRIFTLENS_MANIFEST_PATH=deploy//example.yaml",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml/",
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_MANIFEST_PATH=deploy/example.yaml",
      `DRIFTLENS_MANIFEST_PATH=${"a".repeat(496)}.yaml`,
    ),
    validRuntimeEnvironment.replace(
      "DRIFTLENS_KUBECONTEXT=example/context:west",
      `DRIFTLENS_KUBECONTEXT=${"c".repeat(254)}`,
    ),
  ];

  for (const runtimeEnvironment of invalidEnvironments) {
    assert.notEqual(runContentValidation({ runtimeEnvironment }).status, 0);
  }
});

test("content validator rejects external, quoted, and flow-style kubeconfig references", () => {
  for (const unsafeEntry of [
    "    client-key: external-key\n",
    '    "exec": command\n',
    "    user: {exec: command}\n",
    "? exec\n: command\n",
    "--- # second document\n",
  ]) {
    const kubeconfig = `${validKubeconfig}${unsafeEntry}`;
    assert.notEqual(runContentValidation({ kubeconfig }).status, 0);
  }
});

test("versioned target scripts satisfy the private Docker contract", async () => {
  const scripts = await deploymentScripts();

  assert.doesNotThrow(() => validateDeploymentPolicy(scripts));
});

test("failed image pulls remove transient target registry authentication", async () => {
  const { authEntries, dockerCalls, password, result, username } =
    await runReleaseWithFailedPull();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /image pull failed/);
  assert.deepEqual(
    dockerCalls
      .trim()
      .split("\n")
      .map((entry) => entry.split("|", 1)[0]),
    ["login", "pull", "logout"],
  );
  assert.deepEqual(authEntries, []);
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}${dockerCalls}`,
    new RegExp(username),
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}${dockerCalls}`,
    new RegExp(password),
  );
});

test("missing transient registry cleanup fails the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.release = scripts.release.replace(
    'rm -f "$docker_config/config.json"',
    ":",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
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

test("missing runtime environment binding fails the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.release = scripts.release.replace(
    '--env-file "$runtime_env_file"',
    "",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("writable kubeconfig mounts fail the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.smoke = scripts.smoke.replace(
    "target=$container_kubeconfig,readonly",
    "target=$container_kubeconfig",
  );

  assert.throws(() => validateDeploymentPolicy(scripts));
});

test("loopback origin publication fails the deployment policy", async () => {
  const scripts = await deploymentScripts();
  scripts.smoke = scripts.smoke.replace(
    '"$origin_address:3000:3000"',
    "127.0.0.1:3000:3000",
  );

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

test("host identity collisions fail the bootstrap policy", async () => {
  const scripts = await deploymentScripts();
  scripts.bootstrap = scripts.bootstrap.replace(
    "getent passwd 1001",
    "getent passwd 1002",
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
