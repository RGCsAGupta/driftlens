import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readRuntimeEnvironment,
  resolveRuntimeConfiguration,
} from "./runtime-config";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const SCAN_ENVIRONMENT = {
  DRIFTLENS_GITHUB_REPOSITORY: "RGCsAGupta/driftlens",
  DRIFTLENS_KUBECONFIG_PATH: "/tmp/kubeconfig",
  DRIFTLENS_MANIFEST_PATH: "demo/deployment.yaml",
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveRuntimeConfiguration", () => {
  it("reads the runtime mode dynamically from the process environment", () => {
    vi.stubEnv("NODE_ENV", "preview");

    expect(readRuntimeEnvironment().NODE_ENV).toBe("preview");
  });

  it("accepts production configuration with an immutable build SHA", () => {
    expect(
      resolveRuntimeConfiguration({
        NODE_ENV: "production",
        DRIFTLENS_BUILD_SHA: SHA,
        DRIFTLENS_DATA_DIR: "/data",
        ...SCAN_ENVIRONMENT,
      }),
    ).toEqual({
      buildSha: SHA,
      dataDirectory: "/data",
      issues: [],
      mode: "production",
      ready: true,
      scan: {
        kubeconfigPath: "/tmp/kubeconfig",
        manifestPath: "demo/deployment.yaml",
        repository: "RGCsAGupta/driftlens",
      },
    });
  });

  it("uses safe local defaults with valid required scan configuration", () => {
    expect(
      resolveRuntimeConfiguration({
        NODE_ENV: "development",
        ...SCAN_ENVIRONMENT,
      }),
    ).toEqual({
      buildSha: "development",
      dataDirectory: ".driftlens",
      issues: [],
      mode: "development",
      ready: true,
      scan: {
        kubeconfigPath: "/tmp/kubeconfig",
        manifestPath: "demo/deployment.yaml",
        repository: "RGCsAGupta/driftlens",
      },
    });
  });

  it("accepts explicit test mode without production-only requirements", () => {
    expect(
      resolveRuntimeConfiguration({ NODE_ENV: "test", ...SCAN_ENVIRONMENT }),
    ).toMatchObject({
      buildSha: "development",
      dataDirectory: ".driftlens",
      issues: [],
      mode: "test",
      ready: true,
    });
  });

  it("fails readiness safely when required production configuration is absent", () => {
    expect(
      resolveRuntimeConfiguration({
        NODE_ENV: "production",
        ...SCAN_ENVIRONMENT,
      }),
    ).toMatchObject({
      buildSha: "unavailable",
      dataDirectory: "/data",
      issues: ["BUILD_SHA_REQUIRED"],
      mode: "production",
      ready: false,
    });
  });

  it("fails closed when the runtime mode is absent", () => {
    expect(resolveRuntimeConfiguration(SCAN_ENVIRONMENT)).toMatchObject({
      buildSha: "unavailable",
      dataDirectory: "unavailable",
      issues: ["RUNTIME_MODE_INVALID"],
      mode: "invalid",
      ready: false,
    });
  });

  it("rejects an unknown runtime mode without echoing it", () => {
    const configuration = resolveRuntimeConfiguration(
      {
        NODE_ENV: "preview",
        DRIFTLENS_DATA_DIR: "/data",
        ...SCAN_ENVIRONMENT,
      },
      SHA,
    );

    expect(configuration).toMatchObject({
      buildSha: SHA,
      dataDirectory: "unavailable",
      issues: ["RUNTIME_MODE_INVALID"],
      mode: "invalid",
      ready: false,
    });
    expect(JSON.stringify(configuration)).not.toContain("preview");
  });

  it("rejects malformed values without echoing them", () => {
    const configuration = resolveRuntimeConfiguration({
      NODE_ENV: "production",
      DRIFTLENS_BUILD_SHA: "not-a-sha",
      DRIFTLENS_DATA_DIR: "relative-path",
      DRIFTLENS_GITHUB_REPOSITORY: "invalid",
      DRIFTLENS_KUBECONFIG_PATH: "relative",
      DRIFTLENS_KUBECONTEXT: "bad\0context",
      DRIFTLENS_MANIFEST_PATH: "../secret.yaml",
    });

    expect(configuration).toMatchObject({
      buildSha: "unavailable",
      dataDirectory: "unavailable",
      issues: [
        "BUILD_SHA_INVALID",
        "DATA_DIR_INVALID",
        "GITHUB_REPOSITORY_INVALID",
        "MANIFEST_PATH_INVALID",
        "KUBECONFIG_PATH_INVALID",
        "KUBECONTEXT_INVALID",
      ],
      ready: false,
    });
    expect(JSON.stringify(configuration)).not.toContain("not-a-sha");
    expect(JSON.stringify(configuration)).not.toContain("relative-path");
    expect(JSON.stringify(configuration)).not.toContain("secret.yaml");
  });
});
