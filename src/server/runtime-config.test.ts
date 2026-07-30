import { describe, expect, it } from "vitest";

import { resolveRuntimeConfiguration } from "./runtime-config";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("resolveRuntimeConfiguration", () => {
  it("accepts production configuration with an immutable build SHA", () => {
    expect(
      resolveRuntimeConfiguration({
        NODE_ENV: "production",
        DRIFTLENS_BUILD_SHA: SHA,
        DRIFTLENS_DATA_DIR: "/data",
      }),
    ).toEqual({
      buildSha: SHA,
      dataDirectory: "/data",
      issues: [],
      mode: "production",
      ready: true,
    });
  });

  it("uses safe local defaults when optional configuration is absent", () => {
    expect(resolveRuntimeConfiguration({ NODE_ENV: "development" })).toEqual({
      buildSha: "development",
      dataDirectory: ".driftlens",
      issues: [],
      mode: "development",
      ready: true,
    });
  });

  it("fails readiness safely when required production configuration is absent", () => {
    expect(resolveRuntimeConfiguration({ NODE_ENV: "production" })).toEqual({
      buildSha: "unavailable",
      dataDirectory: "/data",
      issues: ["BUILD_SHA_REQUIRED"],
      mode: "production",
      ready: false,
    });
  });

  it("rejects malformed values without echoing them", () => {
    const configuration = resolveRuntimeConfiguration({
      NODE_ENV: "production",
      DRIFTLENS_BUILD_SHA: "not-a-sha",
      DRIFTLENS_DATA_DIR: "relative-path",
    });

    expect(configuration).toMatchObject({
      buildSha: "unavailable",
      dataDirectory: "unavailable",
      issues: ["BUILD_SHA_INVALID", "DATA_DIR_INVALID"],
      ready: false,
    });
    expect(JSON.stringify(configuration)).not.toContain("not-a-sha");
    expect(JSON.stringify(configuration)).not.toContain("relative-path");
  });
});
