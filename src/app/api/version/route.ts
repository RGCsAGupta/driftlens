import { NextResponse } from "next/server";

import { versionStatus } from "@/server/operational-status";

export function GET(): NextResponse {
  return NextResponse.json(versionStatus(), {
    status: 200,
  });
}
