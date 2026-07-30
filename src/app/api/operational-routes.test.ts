import { beforeEach, describe, expect, it, vi } from "vitest";

const operationalStatus = vi.hoisted(() => ({
  healthStatus: vi.fn(),
  readinessStatus: vi.fn(),
  versionStatus: vi.fn(),
}));

vi.mock("@/server/operational-status", () => operationalStatus);

import { GET as getHealth } from "./health/route";
import { GET as getReadiness } from "./ready/route";
import { GET as getVersion } from "./version/route";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("operational API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the liveness contract with HTTP 200", async () => {
    const body = {
      service: "driftlens",
      status: "ok",
    } as const;
    operationalStatus.healthStatus.mockReturnValue(body);

    const response = getHealth();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns the ready contract with HTTP 200", async () => {
    const body = {
      checks: { configuration: "pass" },
      issues: [],
      service: "driftlens",
      status: "ready",
    } as const;
    operationalStatus.readinessStatus.mockReturnValue(body);

    const response = getReadiness();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns a safe readiness failure with HTTP 503", async () => {
    const body = {
      checks: { configuration: "fail" },
      issues: ["DATA_DIR_INVALID"],
      service: "driftlens",
      status: "not_ready",
    } as const;
    operationalStatus.readinessStatus.mockReturnValue(body);

    const response = getReadiness();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns the immutable version contract with HTTP 200", async () => {
    const body = {
      buildSha: SHA,
      service: "driftlens",
    } as const;
    operationalStatus.versionStatus.mockReturnValue(body);

    const response = getVersion();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
  });
});
