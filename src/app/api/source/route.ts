import { scanErrorResponse, sourceResponse } from "@/server/scans/api";
import { getScanService } from "@/server/scans/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  try {
    return sourceResponse(getScanService());
  } catch (error) {
    return scanErrorResponse(error);
  }
}
