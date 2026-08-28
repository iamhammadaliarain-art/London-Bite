export type PaymentMethod = "cash" | "online";

export type QuoteInput = {
  subtotal: number;
  paymentMethod: PaymentMethod;
  membershipPercent?: number;
  placedAt?: Date;
};

export type QuoteResult = {
  subtotal: number;
  discountPercent: number;
  discountLabel: string;
  discountAmount: number;
  total: number;
  eligibleDiscounts: { label: string; percent: number }[];
};

const money = (value: number) => Math.round(value * 100) / 100;

export function quoteOrder(input: QuoteInput): QuoteResult {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const placedAt = input.placedAt ?? new Date();
  const dateKey = placedAt.toISOString().slice(0, 10);
  const membership = Math.min(10, Math.max(0, Number(input.membershipPercent) || 0));

  const eligibleDiscounts: { label: string; percent: number }[] = [];
  if (membership > 0) eligibleDiscounts.push({ label: "Membership", percent: membership });
  if (input.paymentMethod === "online") eligibleDiscounts.push({ label: "Online payment", percent: 2 });
  if (subtotal >= 1500 && dateKey >= "2026-08-09" && dateKey <= "2026-08-14") {
    eligibleDiscounts.push({ label: "Azadi Offer", percent: 14 });
  }

  const selected = eligibleDiscounts.sort((a, b) => b.percent - a.percent)[0] ?? { label: "No discount", percent: 0 };
  const discountAmount = money((subtotal * selected.percent) / 100);

  return {
    subtotal: money(subtotal),
    discountPercent: selected.percent,
    discountLabel: selected.label,
    discountAmount,
    total: money(subtotal - discountAmount),
    eligibleDiscounts,
  };
}

const minutesFromClock = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export type AttendanceResult = {
  accepted: boolean;
  status: "on-time" | "late-200" | "late-500" | "full-shift-cut" | "outside-geofence" | "too-early";
  fine: number | "full-shift";
  reason: string;
};

const STAFF_GEOFENCE_METERS = 50;

export function evaluateCheckIn(checkIn: string, distanceMeters: number): AttendanceResult {
  if (!Number.isFinite(distanceMeters) || distanceMeters > STAFF_GEOFENCE_METERS) {
    return {
      accepted: false,
      status: "outside-geofence",
      fine: 0,
      reason: `Attendance requires the employee to be within ${STAFF_GEOFENCE_METERS} metres of London Bite.`,
    };
  }

  const time = minutesFromClock(checkIn);
  const open = minutesFromClock("14:50");
  const onTimeEnd = minutesFromClock("15:00");
  const fine200End = minutesFromClock("16:00");
  const fine500End = minutesFromClock("17:00");

  if (time < open) {
    return { accepted: false, status: "too-early", fine: 0, reason: "Check-in window opens at 2:50 PM." };
  }
  if (time <= onTimeEnd) {
    return { accepted: true, status: "on-time", fine: 0, reason: "Check-in accepted on time (2:50 PM–3:00 PM)." };
  }
  if (time <= fine200End) {
    return { accepted: true, status: "late-200", fine: 200, reason: "Arrival after 3:00 PM automatically triggers a Rs 200 late fine." };
  }
  if (time <= fine500End) {
    return { accepted: true, status: "late-500", fine: 500, reason: "Arrival after 4:00 PM automatically triggers a Rs 500 late fine." };
  }
  return {
    accepted: true,
    status: "full-shift-cut",
    fine: "full-shift",
    reason: "Arrival after 5:00 PM automatically triggers a full-shift wage cut.",
  };
}

export function evaluateCheckout(checkOut: string, distanceMeters = 0): AttendanceResult {
  if (!Number.isFinite(distanceMeters) || distanceMeters > STAFF_GEOFENCE_METERS) {
    return {
      accepted: false,
      status: "outside-geofence",
      fine: 0,
      reason: `Checkout requires the employee to be within ${STAFF_GEOFENCE_METERS} metres of London Bite.`,
    };
  }

  const time = minutesFromClock(checkOut);
  const open = minutesFromClock("03:20");
  const onTimeEnd = minutesFromClock("04:00");

  if (time < open) {
    return { accepted: false, status: "too-early", fine: 0, reason: "Checkout window opens at 3:20 AM." };
  }
  if (time <= onTimeEnd) {
    return { accepted: true, status: "on-time", fine: 0, reason: "Checkout accepted on time (3:20 AM–4:00 AM)." };
  }
  return {
    accepted: true,
    status: "late-200",
    fine: 200,
    reason: "Checkout after 4:00 AM automatically triggers a Rs 200 late checkout fine.",
  };
}

export function evaluateRiderKpi(orderCount: number, minutes: number) {
  const thresholds: Record<number, number> = { 1: 15, 2: 20, 3: 27, 4: 29 };
  const target = thresholds[Math.min(4, Math.max(1, orderCount))] ?? 29;
  const late = minutes > target;
  return { targetMinutes: target, actualMinutes: minutes, late, fine: late ? 200 : 0 };
}
