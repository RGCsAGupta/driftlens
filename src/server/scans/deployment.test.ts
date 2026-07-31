import { describe, expect, it } from "vitest";

import {
  compareDeployments,
  parseDesiredDeployment,
} from "@/server/scans/deployment";
function manifest(
  replicas = "replicas: 2",
  containers = `
        - name: api
          image: example/api:1
        - name: worker
          image: example/worker:1`,
): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: driftlens-demo
  namespace: demo
spec:
  ${replicas}
  template:
    spec:
      containers:
${containers}
`;
}

describe("Deployment projection and comparison", () => {
  it("parses one supported Deployment and compares matching replicas/images", () => {
    const desired = parseDesiredDeployment(manifest());

    expect(desired.target).toEqual({
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "driftlens-demo",
      namespace: "demo",
    });
    expect(compareDeployments(desired.projection, desired.projection)).toEqual({
      differences: [],
      outcome: "IN_SYNC",
    });
  });

  it("defaults omitted desired replicas to one", () => {
    expect(parseDesiredDeployment(manifest("")).projection.replicas).toBe(1);
  });

  it("matches reordered containers by name and ignores live-only sidecars", () => {
    const desired = parseDesiredDeployment(manifest()).projection;
    const result = compareDeployments(desired, {
      containers: [
        { image: "sidecar:9", name: "injected" },
        { image: "example/worker:1", name: "worker" },
        { image: "example/api:1", name: "api" },
      ],
      replicas: 2,
    });

    expect(result).toEqual({ differences: [], outcome: "IN_SYNC" });
  });

  it("reports replica, image, and missing desired-container differences", () => {
    const desired = parseDesiredDeployment(manifest()).projection;
    const result = compareDeployments(desired, {
      containers: [{ image: "example/api:2", name: "api" }],
      replicas: 3,
    });

    expect(result).toEqual({
      differences: [
        { desired: 2, field: "spec.replicas", live: 3 },
        {
          desired: "example/api:1",
          field: "spec.template.spec.containers[name=api].image",
          live: "example/api:2",
        },
        {
          desired: "example/worker:1",
          field: "spec.template.spec.containers[name=worker].image",
          live: null,
        },
      ],
      outcome: "DRIFTED",
    });
  });

  it("classifies a missing live Deployment without inventing differences", () => {
    const desired = parseDesiredDeployment(manifest()).projection;
    expect(compareDeployments(desired, null)).toEqual({
      differences: [],
      outcome: "MISSING_LIVE",
    });
  });

  it.each([
    ["malformed YAML", "apiVersion: [", "MANIFEST_INVALID"],
    [
      "multiple documents",
      `${manifest()}\n---\n${manifest()}`,
      "MANIFEST_INVALID",
    ],
    [
      "real Pod resource",
      `apiVersion: v1
kind: Pod
metadata:
  name: driftlens-demo
  namespace: demo
spec:
  containers:
    - name: api
      image: example/api:1
`,
      "MANIFEST_UNSUPPORTED",
    ],
    [
      "malformed supported Deployment",
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: driftlens-demo
  namespace: demo
spec:
  containers: []
`,
      "MANIFEST_INVALID",
    ],
    [
      "duplicate containers",
      manifest(
        "replicas: 1",
        `
        - name: api
          image: one
        - name: api
          image: two`,
      ),
      "MANIFEST_INVALID",
    ],
    [
      "missing namespace",
      manifest().replace("  namespace: demo\n", ""),
      "MANIFEST_INVALID",
    ],
    [
      "invalid Kubernetes identity",
      manifest().replace("name: driftlens-demo", "name: Invalid Name"),
      "MANIFEST_INVALID",
    ],
  ])("rejects %s safely", (_name, yaml, code) => {
    expect(() => parseDesiredDeployment(yaml)).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});
