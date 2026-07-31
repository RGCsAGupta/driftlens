import { getScanResponse, scanErrorResponse } from "@/server/scans/api";
import { getScanService } from "@/server/scans/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return context.params.then(({ id }) => {
    try {
      return getScanResponse(id, getScanService());
    } catch (error) {
      return scanErrorResponse(error);
    }
  });
}
