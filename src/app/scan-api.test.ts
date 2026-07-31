import { describe, expect, it, vi } from "vitest";

import { createScanApi, ScanApiError } from "@/app/scan-api";

const ID = "196cdf62-4da8-49cb-a47c-6e717523af48";
const RECORD = {
  completedAt: null,
  createdAt: "2026-07-31T12:00:00.000Z",
  desired: null,
  differences: [],
  durable: true,
  error: null,
  explanation: {
    analysis: null,
    error: null,
    requestedAt: null,
    savedAt: null,
    state: "NOT_REQUESTED",
  },
  id: ID,
  live: null,
  outcome: null,
  requestedRef: "main",
  resolvedSha: null,
  stage: "QUEUED",
  stages: [{ at: "2026-07-31T12:00:00.000Z", stage: "QUEUED" }],
  status: "QUEUED",
  target: null,
  updatedAt: "2026-07-31T12:00:00.000Z",
};

describe("scan API client", () => {
  it("returns allowlisted source metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        source: { manifestPath: "deploy/app.yaml", repository: "owner/repo" },
      }),
    );

    await expect(createScanApi(fetcher).getSource()).resolves.toEqual({
      manifestPath: "deploy/app.yaml",
      repository: "owner/repo",
    });
  });

  it("encodes scan identifiers before requesting details", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ scan: RECORD }));
    await createScanApi(fetcher).getScan("a/b");
    expect(fetcher).toHaveBeenCalledWith("/api/scans/a%2Fb", undefined);
  });

  it("surfaces only the stable public error contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: { code: "SCAN_ACTIVE", message: "Another scan is active." },
        },
        { status: 409 },
      ),
    );

    await expect(createScanApi(fetcher).startScan("main")).rejects.toEqual(
      new ScanApiError("SCAN_ACTIVE", "Another scan is active."),
    );
  });

  it("maps transport and malformed responses to bounded errors", async () => {
    const offline = createScanApi(
      vi.fn<typeof fetch>().mockRejectedValue(new Error("private detail")),
    );
    await expect(offline.listScans()).rejects.toMatchObject({
      code: "TRANSPORT_ERROR",
    });

    const malformed = createScanApi(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ scans: "no" })),
    );
    await expect(malformed.listScans()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects malformed scan members and non-allowlisted public errors", async () => {
    const malformedMember = createScanApi(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ scans: [{ id: ID }] })),
    );
    await expect(malformedMember.listScans()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const unsafeError = createScanApi(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code: "UPSTREAM_SECRET", message: "unsafe detail" } },
            { status: 500 },
          ),
        ),
    );
    await expect(unsafeError.startScan("main")).rejects.toEqual(
      new ScanApiError(
        "INVALID_RESPONSE",
        "The scan service returned an invalid response.",
      ),
    );
  });
});
