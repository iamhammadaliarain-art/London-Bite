import { NextRequest, NextResponse } from "next/server";
import { evaluateCheckIn, evaluateCheckout } from "@/lib/business-rules";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action === "checkout" ? "checkout" : "checkin";
    const distanceMeters = Number(body.distanceMeters);

    if (action === "checkout") {
      return NextResponse.json(evaluateCheckout(String(body.checkOut ?? body.time), distanceMeters));
    }

    return NextResponse.json(evaluateCheckIn(String(body.checkIn ?? body.time), distanceMeters));
  } catch {
    return NextResponse.json({ error: "Invalid attendance payload." }, { status: 400 });
  }
}
