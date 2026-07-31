import {
  scanStageSchema,
  type ScanErrorCode,
  type ScanStage,
} from "@/server/scans/contracts";

export interface ScanLogger {
  failed(scanId: string, errorCode: ScanErrorCode, durable: boolean): void;
  stage(scanId: string, stage: ScanStage): void;
}

export const noOpScanLogger: ScanLogger = {
  failed: () => undefined,
  stage: () => undefined,
};

function safeScanId(scanId: string): string {
  if (
    scanId.length < 1 ||
    scanId.length > 64 ||
    !/^[A-Za-z0-9-]+$/.test(scanId)
  ) {
    return "invalid";
  }
  return scanId;
}

export class StructuredScanLogger implements ScanLogger {
  constructor(private readonly sink: (line: string) => void) {}

  stage(scanId: string, stage: ScanStage): void {
    this.emit({
      component: "scan",
      event: "scan.stage",
      level: "info",
      scanId: safeScanId(scanId),
      stage: scanStageSchema.parse(stage),
    });
  }

  failed(scanId: string, errorCode: ScanErrorCode, durable: boolean): void {
    this.emit({
      component: "scan",
      durable,
      errorCode,
      event: "scan.failed",
      level: "error",
      scanId: safeScanId(scanId),
    });
  }

  private emit(record: Record<string, unknown>): void {
    try {
      this.sink(JSON.stringify(record));
    } catch {
      // Observability failure must not change deterministic workflow state.
    }
  }
}
