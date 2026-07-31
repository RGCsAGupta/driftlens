import { describe, expect, it, vi } from "vitest";

import { StructuredScanLogger } from "@/server/scans/log";

describe("StructuredScanLogger", () => {
  it("emits only allowlisted stage correlation fields", () => {
    const sink = vi.fn();
    new StructuredScanLogger(sink).stage("scan-1", "READING_LIVE");

    expect(sink).toHaveBeenCalledWith(
      '{"component":"scan","event":"scan.stage","level":"info","scanId":"scan-1","stage":"READING_LIVE"}',
    );
  });

  it("emits safe error class and durability without upstream detail", () => {
    const sink = vi.fn();
    new StructuredScanLogger(sink).failed(
      "scan-1",
      "KUBERNETES_FORBIDDEN",
      true,
    );

    const line = sink.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toEqual({
      component: "scan",
      durable: true,
      errorCode: "KUBERNETES_FORBIDDEN",
      event: "scan.failed",
      level: "error",
      scanId: "scan-1",
    });
    expect(line).not.toContain("kubeconfig");
    expect(line).not.toContain("manifest");
  });

  it("replaces an unsafe correlation identifier instead of echoing it", () => {
    const sink = vi.fn();
    new StructuredScanLogger(sink).stage("secret/value", "QUEUED");

    expect(sink.mock.calls[0]?.[0]).toContain('"scanId":"invalid"');
    expect(sink.mock.calls[0]?.[0]).not.toContain("secret/value");
  });

  it("does not let a log-sink failure alter workflow control", () => {
    const logger = new StructuredScanLogger(() => {
      throw new Error("sink unavailable");
    });

    expect(() => logger.stage("scan-1", "QUEUED")).not.toThrow();
  });
});
