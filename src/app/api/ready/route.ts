import { NextResponse } from "next/server";

import { readinessStatus } from "@/server/operational-status";

export function GET(): NextResponse {
  const readiness = readinessStatus();

  return NextResponse.json(readiness, {
    status: readiness.status === "ready" ? 200 : 503,
  });
}
