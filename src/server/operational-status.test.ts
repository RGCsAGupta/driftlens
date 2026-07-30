import { describe, expect, it } from "vitest";

import {
  healthStatus,
  readinessStatus,
  versionStatus,
} from "./operational-status";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("operational status", () => {
  it("reports liveness independently from configuration readiness", () => {
    expect(healthStatus()).toEqual({
      service: "driftlens",
      status: "ok",
    });
  });

  it("reports ready for valid production configuration", () => {
    expect(
      readinessStatus({
        NODE_ENV: "production",
        DRIFTLENS_BUILD_SHA: SHA,
      }),
    ).toEqual({
      checks: { configuration: "pass" },
      issues: [],
      service: "driftlens",
      status: "ready",
    });
  });

  it("returns actionable issue codes for invalid configuration", () => {
    expect(readinessStatus({ NODE_ENV: "production" })).toEqual({
      checks: { configuration: "fail" },
      issues: ["BUILD_SHA_REQUIRED"],
      service: "driftlens",
      status: "not_ready",
    });
  });

  it("reports the exact immutable build SHA", () => {
    expect(
      versionStatus({
        NODE_ENV: "production",
        DRIFTLENS_BUILD_SHA: SHA,
      }),
    ).toEqual({
      buildSha: SHA,
      service: "driftlens",
    });
  });
});
