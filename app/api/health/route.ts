import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "london-bite-platform",
    deployment: "vercel",
    source: "github",
    timestamp: new Date().toISOString(),
  });
}
