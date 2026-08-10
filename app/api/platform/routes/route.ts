import { NextResponse } from "next/server";
import { platformRoutes } from "@/lib/platform";

export function GET() {
  return NextResponse.json({ count: platformRoutes.length, routes: platformRoutes });
}
