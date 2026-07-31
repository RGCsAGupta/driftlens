import type { SafeScanError, ScanErrorCode } from "@/server/scans/contracts";

const SAFE_MESSAGES: Record<ScanErrorCode, string> = {
  CONFIGURATION_INVALID: "Scan service configuration is invalid.",
  GITHUB_FILE_NOT_FOUND: "Configured manifest file was not found.",
  GITHUB_REF_NOT_FOUND: "Requested Git reference was not found.",
  GITHUB_RESPONSE_INVALID: "GitHub returned an invalid response.",
  GITHUB_TIMEOUT: "GitHub request timed out.",
  GITHUB_UNAVAILABLE: "GitHub is unavailable.",
  INTERNAL_ERROR: "Scan failed unexpectedly.",
  KUBERNETES_FORBIDDEN: "Kubernetes denied the Deployment read.",
  KUBERNETES_TIMEOUT: "Kubernetes Deployment read timed out.",
  KUBERNETES_UNAVAILABLE: "Kubernetes is unavailable.",
  MANIFEST_INVALID: "Configured manifest is invalid.",
  MANIFEST_UNSUPPORTED: "Configured manifest must be one apps/v1 Deployment.",
  SCAN_ACTIVE: "Another scan is active.",
  SCAN_NOT_FOUND: "Scan was not found.",
  STORAGE_UNAVAILABLE: "Scan history storage is unavailable.",
  STORAGE_WRITE_FAILED: "Scan progress could not be saved.",
};

export class ScanExecutionError extends Error {
  readonly code: ScanErrorCode;

  constructor(code: ScanErrorCode, options?: ErrorOptions) {
    super(SAFE_MESSAGES[code], options);
    this.name = "ScanExecutionError";
    this.code = code;
  }

  toSafeError(): SafeScanError {
    return { code: this.code, message: this.message };
  }
}

export function safeScanError(error: unknown): SafeScanError {
  if (error instanceof ScanExecutionError) {
    return error.toSafeError();
  }

  return new ScanExecutionError("INTERNAL_ERROR").toSafeError();
}
