import { NextRequest, NextResponse } from "next/server";
import { quoteOrder } from "@/lib/business-rules";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = quoteOrder({
      subtotal: Number(body.subtotal),
      paymentMethod: body.paymentMethod === "online" ? "online" : "cash",
      membershipPercent: Number(body.membershipPercent ?? 0),
      placedAt: body.placedAt ? new Date(body.placedAt) : new Date(),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid order quote payload." }, { status: 400 });
  }
}
