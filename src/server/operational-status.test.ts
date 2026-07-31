import { describe, expect, it } from "vitest";

import {
  healthStatus,
  readinessStatus,
  versionStatus,
} from "./operational-status";
import { ScanExecutionError } from "./scans/errors";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98";
const SCAN_ENVIRONMENT = {
  DRIFTLENS_GITHUB_REPOSITORY: "RGCsAGupta/driftlens",
  DRIFTLENS_KUBECONFIG_PATH: "/tmp/kubeconfig",
  DRIFTLENS_MANIFEST_PATH: "demo/deployment.yaml",
} as const;

describe("operational status", () => {
  it("reports liveness independently from configuration readiness", () => {
    expect(healthStatus()).toEqual({
      service: "driftlens",
      status: "ok",
    });
  });

  it("reports ready for valid production configuration", () => {
    expect(
      readinessStatus(
        {
          NODE_ENV: "production",
          ...SCAN_ENVIRONMENT,
        },
        SHA,
        () => undefined,
      ),
    ).toEqual({
      checks: { configuration: "pass", persistence: "pass" },
      issues: [],
      service: "driftlens",
      status: "ready",
    });
  });

  it("returns actionable issue codes for invalid configuration", () => {
    expect(
      readinessStatus(
        { NODE_ENV: "production", ...SCAN_ENVIRONMENT },
        undefined,
        () => undefined,
      ),
    ).toEqual({
      checks: { configuration: "fail", persistence: "fail" },
      issues: ["BUILD_SHA_REQUIRED"],
      service: "driftlens",
      status: "not_ready",
    });
  });

  it("returns a safe issue code for an unknown runtime mode", () => {
    const readiness = readinessStatus(
      { NODE_ENV: "preview", ...SCAN_ENVIRONMENT },
      SHA,
      () => undefined,
    );

    expect(readiness).toEqual({
      checks: { configuration: "fail", persistence: "fail" },
      issues: ["RUNTIME_MODE_INVALID"],
      service: "driftlens",
      status: "not_ready",
    });
    expect(JSON.stringify(readiness)).not.toContain("preview");
  });

  it("fails readiness safely when persistence bootstrap is unavailable", () => {
    expect(
      readinessStatus(
        { NODE_ENV: "production", ...SCAN_ENVIRONMENT },
        SHA,
        () => {
          throw new ScanExecutionError("STORAGE_UNAVAILABLE");
        },
      ),
    ).toEqual({
      checks: { configuration: "pass", persistence: "fail" },
      issues: ["STORAGE_UNAVAILABLE"],
      service: "driftlens",
      status: "not_ready",
    });
  });

  it("reports the exact immutable build SHA", () => {
    expect(
      versionStatus(
        {
          NODE_ENV: "production",
        },
        SHA,
      ),
    ).toEqual({
      buildSha: SHA,
      service: "driftlens",
    });
  });

  it("reports the embedded build SHA instead of a runtime override", () => {
    expect(
      versionStatus(
        {
          NODE_ENV: "production",
          DRIFTLENS_BUILD_SHA: OTHER_SHA,
        },
        SHA,
      ),
    ).toEqual({
      buildSha: SHA,
      service: "driftlens",
    });
  });
});
