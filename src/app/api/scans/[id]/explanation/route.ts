import { explainScanResponse, scanErrorResponse } from "@/server/scans/api";
import { getExplanationService } from "@/server/scans/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return context.params.then(({ id }) => {
    try {
      return explainScanResponse(id, getExplanationService());
    } catch (error) {
      return scanErrorResponse(error);
    }
  });
}
