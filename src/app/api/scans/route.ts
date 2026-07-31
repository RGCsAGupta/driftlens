import { after } from "next/server";

import {
  listScansResponse,
  scanErrorResponse,
  startScanResponse,
} from "@/server/scans/api";
import { getScanService } from "@/server/scans/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  try {
    return listScansResponse(request, getScanService());
  } catch (error) {
    return scanErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await startScanResponse(request, getScanService(), after);
  } catch (error) {
    return scanErrorResponse(error);
  }
}
