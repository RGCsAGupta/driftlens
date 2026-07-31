import type { ScanRecord } from "@/server/scans/contracts";
import { historyLimitSchema, startScanSchema } from "@/server/scans/contracts";
import { ScanExecutionError } from "@/server/scans/errors";
import type { ScanService } from "@/server/scans/service";

type Scheduler = (task: () => Promise<void>) => void;
const MAX_REQUEST_BYTES = 1_024;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function scanErrorResponse(error: unknown): Response {
  if (!(error instanceof ScanExecutionError)) {
    return json(
      { error: new ScanExecutionError("INTERNAL_ERROR").toSafeError() },
      500,
    );
  }

  const status =
    error.code === "SCAN_ACTIVE"
      ? 409
      : error.code === "SCAN_NOT_FOUND"
        ? 404
        : error.code.startsWith("STORAGE_")
          ? 503
          : error.code === "CONFIGURATION_INVALID"
            ? 503
            : 500;
  return json({ error: error.toSafeError() }, status);
}

function scanEnvelope(scan: ScanRecord): { scan: ScanRecord } {
  return { scan };
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > MAX_REQUEST_BYTES
  ) {
    return null;
  }
  if (request.body === null) {
    return "";
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      return text + decoder.decode();
    }
    totalBytes += chunk.value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
}

export async function startScanResponse(
  request: Request,
  service: ScanService,
  schedule: Scheduler,
): Promise<Response> {
  try {
    const text = await readBoundedBody(request);
    if (text === null) {
      return json(
        { error: { code: "INVALID_REQUEST", message: "Request is invalid." } },
        400,
      );
    }
    const parsed = startScanSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return json(
        { error: { code: "INVALID_REQUEST", message: "Request is invalid." } },
        400,
      );
    }

    const scan = service.start(parsed.data.ref);
    schedule(() => service.run(scan.id));
    return json(scanEnvelope(scan), 202);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json(
        { error: { code: "INVALID_REQUEST", message: "Request is invalid." } },
        400,
      );
    }
    return scanErrorResponse(error);
  }
}

export function listScansResponse(
  request: Request,
  service: ScanService,
): Response {
  try {
    const rawLimit = new URL(request.url).searchParams.get("limit") ?? "20";
    const limit = historyLimitSchema.safeParse(rawLimit);
    if (!limit.success) {
      return json(
        { error: { code: "INVALID_LIMIT", message: "Limit is invalid." } },
        400,
      );
    }
    return json({ scans: service.list(limit.data) });
  } catch (error) {
    return scanErrorResponse(error);
  }
}

export function getScanResponse(id: string, service: ScanService): Response {
  try {
    const scan = service.get(id);
    if (!scan) {
      throw new ScanExecutionError("SCAN_NOT_FOUND");
    }
    return json(scanEnvelope(scan));
  } catch (error) {
    return scanErrorResponse(error);
  }
}

export function sourceResponse(service: ScanService): Response {
  return json({ source: service.source() });
}
