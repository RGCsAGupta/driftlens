import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readRuntimeEnvironment,
  resolveRuntimeConfiguration,
} from "./runtime-config";

const SHA = "0123456789abcdef0123456789abcdef01234567";

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

  it("accepts explicit test mode without production-only requirements", () => {
    expect(resolveRuntimeConfiguration({ NODE_ENV: "test" })).toEqual({
      buildSha: "development",
      dataDirectory: ".driftlens",
      issues: [],
      mode: "test",
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

  it("fails closed when the runtime mode is absent", () => {
    expect(resolveRuntimeConfiguration({})).toEqual({
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
      },
      SHA,
    );

    expect(configuration).toEqual({
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
