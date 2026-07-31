import type { ScanRecord, SourceMetadata } from "@/server/scans/contracts";

export interface PublicApiError {
  code: string;
  message: string;
}

export class ScanApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScanApiError";
  }
}

export interface ScanApi {
  getScan(id: string): Promise<ScanRecord>;
  getSource(): Promise<SourceMetadata>;
  listScans(): Promise<ScanRecord[]>;
  startScan(ref: string): Promise<ScanRecord>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function publicError(value: unknown): PublicApiError | null {
  if (!isObject(value) || !isObject(value.error)) return null;
  const { code, message } = value.error;
  return typeof code === "string" && typeof message === "string"
    ? { code, message }
    : null;
}

async function requestJson(
  fetcher: typeof fetch,
  input: string,
  init?: RequestInit,
) {
  let response: Response;
  try {
    response = await fetcher(input, init);
  } catch {
    throw new ScanApiError(
      "TRANSPORT_ERROR",
      "DriftLens could not reach the scan service.",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ScanApiError(
      "INVALID_RESPONSE",
      "The scan service returned an invalid response.",
    );
  }

  if (!response.ok) {
    const error = publicError(body);
    throw new ScanApiError(
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The scan service could not complete the request.",
    );
  }
  return body;
}

function scanEnvelope(value: unknown): ScanRecord {
  if (
    !isObject(value) ||
    !isObject(value.scan) ||
    typeof value.scan.id !== "string"
  ) {
    throw new ScanApiError(
      "INVALID_RESPONSE",
      "The scan service returned an invalid response.",
    );
  }
  return value.scan as unknown as ScanRecord;
}

export function createScanApi(fetcher: typeof fetch = fetch): ScanApi {
  return {
    async getScan(id) {
      return scanEnvelope(
        await requestJson(fetcher, `/api/scans/${encodeURIComponent(id)}`),
      );
    },
    async getSource() {
      const body = await requestJson(fetcher, "/api/source");
      if (
        !isObject(body) ||
        !isObject(body.source) ||
        typeof body.source.repository !== "string" ||
        typeof body.source.manifestPath !== "string"
      ) {
        throw new ScanApiError(
          "INVALID_RESPONSE",
          "The scan service returned an invalid response.",
        );
      }
      return body.source as unknown as SourceMetadata;
    },
    async listScans() {
      const body = await requestJson(fetcher, "/api/scans?limit=20");
      if (!isObject(body) || !Array.isArray(body.scans)) {
        throw new ScanApiError(
          "INVALID_RESPONSE",
          "The scan service returned an invalid response.",
        );
      }
      return body.scans as ScanRecord[];
    },
    async startScan(ref) {
      return scanEnvelope(
        await requestJson(fetcher, "/api/scans", {
          body: JSON.stringify({ ref }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
    },
  };
}
