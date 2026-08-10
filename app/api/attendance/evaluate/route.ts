import { NextRequest, NextResponse } from "next/server";
import { evaluateCheckIn } from "@/lib/business-rules";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(evaluateCheckIn(String(body.checkIn), Number(body.distanceMeters)));
  } catch {
    return NextResponse.json({ error: "Invalid attendance payload." }, { status: 400 });
  }
}
