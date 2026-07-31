import { describe, expect, it } from "vitest";

import {
  healthStatus,
  readinessStatus,
  versionStatus,
} from "./operational-status";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98";

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
        },
        SHA,
      ),
    ).toEqual({
      checks: { configuration: "pass" },
      issues: [],
      service: "driftlens",
      status: "ready",
    });
  });

  it("returns actionable issue codes for invalid configuration", () => {
    expect(readinessStatus({ NODE_ENV: "production" }, undefined)).toEqual({
      checks: { configuration: "fail" },
      issues: ["BUILD_SHA_REQUIRED"],
      service: "driftlens",
      status: "not_ready",
    });
  });

  it("returns a safe issue code for an unknown runtime mode", () => {
    const readiness = readinessStatus({ NODE_ENV: "preview" }, SHA);

    expect(readiness).toEqual({
      checks: { configuration: "fail" },
      issues: ["RUNTIME_MODE_INVALID"],
      service: "driftlens",
      status: "not_ready",
    });
    expect(JSON.stringify(readiness)).not.toContain("preview");
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
