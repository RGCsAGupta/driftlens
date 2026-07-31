import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseDesiredDeployment } from "@/server/scans/deployment";

describe("public demo manifest contract", () => {
  it("loads the configured path as the dedicated demo Deployment", () => {
    const manifest = readFileSync(resolve("demo/deployment.yaml"), "utf8");

    expect(parseDesiredDeployment(manifest)).toEqual({
      projection: {
        containers: [
          {
            image:
              "registry.k8s.io/pause@sha256:e5b941ef8f71de54dc3a13398226c269ba217d06650a21bd3afcf9d890cf1f41",
            name: "web",
          },
        ],
        replicas: 1,
      },
      target: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "driftlens-demo",
        namespace: "driftlens-demo",
      },
    });
  });
});
