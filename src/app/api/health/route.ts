import { NextResponse } from "next/server";

import { healthStatus } from "@/server/operational-status";

export function GET(): NextResponse {
  return NextResponse.json(healthStatus(), {
    status: 200,
  });
}
