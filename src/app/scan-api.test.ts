import { describe, expect, it, vi } from "vitest";

import { createScanApi, ScanApiError } from "@/app/scan-api";

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
      .mockResolvedValue(Response.json({ scan: { id: "a/b" } }));
    await createScanApi(fetcher).getScan("a/b");
    expect(fetcher).toHaveBeenCalledWith("/api/scans/a%2Fb", undefined);
  });

  it("surfaces only the stable public error contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: { code: "SCAN_ACTIVE", message: "Another scan is active." },
          unsafe: "secret",
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
});
