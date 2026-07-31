import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const bootstrap = resolve("ops/demo-cluster/v1/bootstrap.sh");
const verify = resolve("ops/demo-cluster/v1/verify.sh");
const scenario = resolve("ops/demo-cluster/v1/scenario.sh");
const teardown = resolve("ops/demo-cluster/v1/teardown.sh");
const manifest = resolve("demo/deployment.yaml");
const validEnvironment = {
  ...process.env,
  DRIFTLENS_KIND_API_ADDRESS: "192.0.2.10",
};

interface FakeCluster {
  adminKubeconfig: string;
  environment: NodeJS.ProcessEnv;
  log: string;
  remove: () => void;
}

function createFakeCluster(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): FakeCluster {
  const directory = mkdtempSync(join(tmpdir(), "driftlens-demo-contract-"));
  const binaryDirectory = join(directory, "bin");
  const adminKubeconfig = join(directory, "admin.kubeconfig");
  const log = join(directory, "calls.log");

  mkdirSync(binaryDirectory);
  writeFileSync(adminKubeconfig, "test-only\n", { mode: 0o600 });
  writeFileSync(log, "", { mode: 0o600 });
  writeFileSync(
    join(binaryDirectory, "kubectl"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_CLUSTER_LOG"
if [[ "$*" == *"config current-context"* ]]; then
  printf '%s\\n' "\${FAKE_CONTEXT:-kind-driftlens-demo}"
fi
`,
    { mode: 0o700 },
  );
  writeFileSync(
    join(binaryDirectory, "kind"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'kind %s\\n' "$*" >> "$FAKE_CLUSTER_LOG"
if [[ "\${1:-}" == "get" && "\${2:-}" == "clusters" && "\${FAKE_CLUSTER_PRESENT:-1}" == "1" ]]; then
  printf '%s\\n' driftlens-demo
fi
`,
    { mode: 0o700 },
  );

  return {
    adminKubeconfig,
    environment: {
      ...process.env,
      PATH: `${binaryDirectory}:${process.env.PATH ?? ""}`,
      FAKE_CLUSTER_LOG: log,
      ...overrides,
      NODE_ENV: process.env.NODE_ENV ?? "test",
    },
    log,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
}

describe("demo-cluster delivery contract", () => {
  it("accepts the bounded public configuration without contacting a cluster", () => {
    expect(() =>
      execFileSync(
        bootstrap,
        ["/tmp/driftlens.kubeconfig", "--validate-only"],
        {
          env: validEnvironment,
        },
      ),
    ).not.toThrow();
  });

  it("rejects an address that could inject kind configuration", () => {
    const result = spawnSync(
      bootstrap,
      ["/tmp/driftlens.kubeconfig", "--validate-only"],
      {
        env: {
          ...validEnvironment,
          DRIFTLENS_KIND_API_ADDRESS: "127.0.0.1\nextraPortMappings:",
        },
      },
    );

    expect(result.status).toBe(2);
    expect(result.stderr.toString()).toContain("explicit IP literal");
  });

  it("pins one node image and checks the complete deny matrix", () => {
    const bootstrapSource = readFileSync(bootstrap, "utf8");
    const verifySource = readFileSync(verify, "utf8");

    expect(bootstrapSource).toContain("kindest/node:v1.35.5@sha256:");
    expect(bootstrapSource).toContain('verbs: ["get"]');
    expect(verifySource).toContain('get deployment "$READ_PROBE_DEPLOYMENT"');
    for (const denied of [
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
      "secrets",
    ]) {
      expect(verifySource).toContain(denied);
    }
  });

  it("defines one public, pinned, non-privileged Deployment", () => {
    const deployment = parse(readFileSync(manifest, "utf8"));
    const container = deployment.spec.template.spec.containers[0];

    expect(deployment.apiVersion).toBe("apps/v1");
    expect(deployment.kind).toBe("Deployment");
    expect(deployment.metadata).toMatchObject({
      name: "driftlens-demo",
      namespace: "driftlens-demo",
    });
    expect(deployment.spec.replicas).toBe(1);
    expect(container.name).toBe("web");
    expect(container.image).toMatch(
      /^registry\.k8s\.io\/pause@sha256:[a-f0-9]{64}$/,
    );
    expect(deployment.spec.template.spec.automountServiceAccountToken).toBe(
      false,
    );
    expect(container.securityContext).toMatchObject({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      runAsNonRoot: true,
      runAsUser: 65534,
    });
  });

  it("creates the bounded drift scenario and waits for rollout", () => {
    const fake = createFakeCluster();
    try {
      execFileSync(scenario, [fake.adminKubeconfig, "drifted"], {
        env: fake.environment,
      });
      const calls = readFileSync(fake.log, "utf8");

      expect(calls).toContain(`apply -f ${manifest}`);
      expect(calls).toContain("scale deployment/driftlens-demo");
      expect(calls).toContain("--replicas=2");
      expect(calls).toContain("set image deployment/driftlens-demo");
      expect(calls).toContain("web=registry.k8s.io/pause@sha256:");
      expect(calls).toContain("rollout status deployment/driftlens-demo");
    } finally {
      fake.remove();
    }
  });

  it("makes missing-live and access-failure safe to repeat", () => {
    const fake = createFakeCluster();
    try {
      for (const action of ["missing-live", "access-failure"]) {
        execFileSync(scenario, [fake.adminKubeconfig, action], {
          env: fake.environment,
        });
        execFileSync(scenario, [fake.adminKubeconfig, action], {
          env: fake.environment,
        });
      }
      const calls = readFileSync(fake.log, "utf8");

      expect(calls.match(/delete deployment\/driftlens-demo/g)).toHaveLength(2);
      expect(calls.match(/delete rolebinding\/driftlens-reader/g)).toHaveLength(
        2,
      );
      expect(calls.match(/--ignore-not-found=true/g)).toHaveLength(4);
    } finally {
      fake.remove();
    }
  });

  it("rejects unknown scenarios and the wrong cluster context", () => {
    const fake = createFakeCluster({ FAKE_CONTEXT: "kind-unrelated" });
    try {
      expect(
        spawnSync(scenario, [fake.adminKubeconfig, "unknown"], {
          env: fake.environment,
        }).status,
      ).toBe(2);
      expect(
        spawnSync(scenario, [fake.adminKubeconfig, "in-sync"], {
          env: fake.environment,
        }).status,
      ).toBe(2);
    } finally {
      fake.remove();
    }
  });

  it("tears down only the named workload unless cluster deletion is explicit", () => {
    const fake = createFakeCluster();
    try {
      execFileSync(teardown, [fake.adminKubeconfig], {
        env: fake.environment,
      });
      execFileSync(teardown, [fake.adminKubeconfig, "--delete-cluster"], {
        env: fake.environment,
      });
      const calls = readFileSync(fake.log, "utf8");

      expect(calls).toContain("delete deployment/driftlens-demo");
      expect(calls).toContain("kind delete cluster --name driftlens-demo");
    } finally {
      fake.remove();
    }
  });

  it("treats an already-absent named cluster as successful teardown", () => {
    const fake = createFakeCluster({ FAKE_CLUSTER_PRESENT: "0" });
    try {
      expect(() =>
        execFileSync(teardown, [fake.adminKubeconfig, "--delete-cluster"], {
          env: fake.environment,
        }),
      ).not.toThrow();
      expect(readFileSync(fake.log, "utf8")).not.toContain(
        "kind delete cluster",
      );
    } finally {
      fake.remove();
    }
  });

  it("refuses teardown through an unrelated cluster context", () => {
    const fake = createFakeCluster({ FAKE_CONTEXT: "kind-unrelated" });
    try {
      expect(
        spawnSync(teardown, [fake.adminKubeconfig], {
          env: fake.environment,
        }).status,
      ).toBe(2);
      expect(readFileSync(fake.log, "utf8")).not.toContain(
        "delete deployment/driftlens-demo",
      );
    } finally {
      fake.remove();
    }
  });
});
