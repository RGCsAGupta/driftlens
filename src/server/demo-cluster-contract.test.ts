import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const bootstrap = resolve("ops/demo-cluster/v1/bootstrap.sh");
const verify = resolve("ops/demo-cluster/v1/verify.sh");
const validEnvironment = {
  ...process.env,
  DRIFTLENS_KIND_API_ADDRESS: "192.0.2.10",
};

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
});
