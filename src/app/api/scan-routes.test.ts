import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getScanResponse: vi.fn(),
  getScanService: vi.fn(),
  listScansResponse: vi.fn(),
  scanErrorResponse: vi.fn(),
  service: {},
  sourceResponse: vi.fn(),
  startScanResponse: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/server/scans/api", () => ({
  getScanResponse: mocks.getScanResponse,
  listScansResponse: mocks.listScansResponse,
  scanErrorResponse: mocks.scanErrorResponse,
  sourceResponse: mocks.sourceResponse,
  startScanResponse: mocks.startScanResponse,
}));
vi.mock("@/server/scans/runtime", () => ({
  getScanService: mocks.getScanService,
}));

import { GET as listScans, POST as startScan } from "@/app/api/scans/route";
import { GET as getScan } from "@/app/api/scans/[id]/route";
import { GET as getSource } from "@/app/api/source/route";

describe("scan Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getScanService.mockReturnValue(mocks.service);
  });

  it("delegates history and source reads to the shared process service", () => {
    const historyResponse = Response.json({ scans: [] });
    const sourceResult = Response.json({ source: {} });
    const request = new Request("http://localhost/api/scans");
    mocks.listScansResponse.mockReturnValue(historyResponse);
    mocks.sourceResponse.mockReturnValue(sourceResult);

    expect(listScans(request)).toBe(historyResponse);
    expect(getSource()).toBe(sourceResult);
    expect(mocks.listScansResponse).toHaveBeenCalledWith(
      request,
      mocks.service,
    );
    expect(mocks.sourceResponse).toHaveBeenCalledWith(mocks.service);
  });

  it("delegates scan start with Next after scheduling", async () => {
    const expected = Response.json({ scan: {} }, { status: 202 });
    const request = new Request("http://localhost/api/scans", {
      body: '{"ref":"main"}',
      method: "POST",
    });
    mocks.startScanResponse.mockResolvedValue(expected);

    await expect(startScan(request)).resolves.toBe(expected);
    expect(mocks.startScanResponse).toHaveBeenCalledWith(
      request,
      mocks.service,
      mocks.after,
    );
  });

  it("awaits dynamic route params before retrieving one scan", async () => {
    const expected = Response.json({ scan: { id: "scan-1" } });
    mocks.getScanResponse.mockReturnValue(expected);

    await expect(
      getScan(new Request("http://localhost/api/scans/scan-1"), {
        params: Promise.resolve({ id: "scan-1" }),
      }),
    ).resolves.toBe(expected);
    expect(mocks.getScanResponse).toHaveBeenCalledWith("scan-1", mocks.service);
  });

  it("maps runtime bootstrap failure through the safe API contract", async () => {
    const expected = Response.json(
      { error: { code: "CONFIGURATION_INVALID" } },
      { status: 503 },
    );
    const error = new Error("unsafe configuration detail");
    mocks.getScanService.mockImplementation(() => {
      throw error;
    });
    mocks.scanErrorResponse.mockReturnValue(expected);

    expect(listScans(new Request("http://localhost/api/scans"))).toBe(expected);
    expect(getSource()).toBe(expected);
    await expect(
      getScan(new Request("http://localhost/api/scans/id"), {
        params: Promise.resolve({ id: "id" }),
      }),
    ).resolves.toBe(expected);
    await expect(
      startScan(
        new Request("http://localhost/api/scans", {
          body: '{"ref":"main"}',
          method: "POST",
        }),
      ),
    ).resolves.toBe(expected);
    expect(mocks.scanErrorResponse).toHaveBeenCalledTimes(4);
    expect(mocks.scanErrorResponse).toHaveBeenCalledWith(error);
  });
});
