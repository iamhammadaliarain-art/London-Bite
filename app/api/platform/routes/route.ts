import { NextResponse } from "next/server";
import { platformRoutes, primaryNavigationRoutes } from "@/lib/platform";

export function GET() {
  return NextResponse.json({
    count: platformRoutes.length,
    primaryCount: primaryNavigationRoutes.length,
    routes: platformRoutes,
    primaryRoutes: primaryNavigationRoutes,
  });
}
