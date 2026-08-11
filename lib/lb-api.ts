export const LB_SUPABASE_URL = "https://yaywauauqzfcmrzmbdkr.supabase.co";
export const LB_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlheXdhdWF1cXpmY21yem1iZGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTQ4MTQsImV4cCI6MjA3NzQ3MDgxNH0.IRA92oEpvvFBEOJaJ-w4v9XURjgg27ya9pk_xHcDb9A";

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: { id: string; email?: string };
};

export type LiveProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string | null;
  badge: string | null;
  is_available: boolean;
  sort_order: number;
};

export type CreatedOrder = {
  id: string;
  order_number: number;
  tracking_token: string;
  status: string;
  payment_status: string;
  subtotal: number;
  discount_label: string;
  discount_amount: number;
  total: number;
  created_at: string;
};

export type TrackedOrder = {
  id: string;
  order_number: number;
  tracking_token: string;
  status: string;
  payment_status: string;
  fulfilment: "delivery" | "pickup";
  total: number;
  created_at: string;
  items: { name: string; quantity: number; unit_price: number; line_total: number }[];
  events: { type: string; label: string; created_at: string }[];
};

export type ManagementDashboardData = {
  orders_today: number;
  sales_today: number;
  active_orders: number;
  staff_active: number;
  staff_on_shift: number;
  low_stock: number;
  pending_leave: number;
};

export type ManagementOrder = {
  id: string;
  order_number: number;
  name: string;
  phone: string;
  fulfilment: string;
  payment_method: string;
  payment_status: string;
  status: string;
  total: number;
  created_at: string;
};

export type OperationsOrderRecord = {
  id: string;
  order_number: number;
  status: "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
  fulfilment: "delivery" | "pickup";
  payment_status: string;
  total: number;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: { name: string; quantity: number }[];
};

export type ManagementEmployee = {
  id: string;
  employee_code: string;
  name: string;
  role: string;
  branch: string;
  station: string | null;
  phone: string | null;
  status: string;
  joined_on: string;
  linked_user: string | null;
};

export type StaffSnapshot = {
  role: string;
  employee: null | {
    id: string;
    employee_code: string;
    name: string;
    role: string;
    branch: string;
    station: string | null;
    joined_on: string;
  };
  shift?: null | {
    id: string;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    station: string | null;
    status: string;
  };
  tasks?: { id: string; title: string; detail: string; priority: string; status: string; due_at: string | null }[];
  announcements?: { id: string; title: string; body: string; created_at: string }[];
};

const jsonHeaders = (token?: string) => ({
  apikey: LB_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token ?? LB_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let value: unknown = null;
  try { value = text ? JSON.parse(text) : null; } catch { value = text; }
  if (!response.ok) {
    const message = typeof value === "object" && value && "message" in value ? String((value as { message: unknown }).message) : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return value as T;
}

function normalizeSession(session: AuthSession): AuthSession {
  if (session.expires_at || !session.expires_in) return session;
  return { ...session, expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in) };
}

export function readStoredLbSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("lb.auth.session") ?? "null") as AuthSession | null; } catch { return null; }
}

export function storeLbSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem("lb.auth.session");
  else localStorage.setItem("lb.auth.session", JSON.stringify(normalizeSession(session)));
}

export async function lbRefreshSession(refreshToken: string): Promise<AuthSession> {
  const response = await fetch(`${LB_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: LB_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const refreshed = normalizeSession(await parseResponse<AuthSession>(response));
  storeLbSession(refreshed);
  return refreshed;
}

async function resolveStaffToken(requestedToken?: string): Promise<string | undefined> {
  if (!requestedToken || typeof window === "undefined") return requestedToken;
  const stored = readStoredLbSession();
  if (!stored) return requestedToken;

  const now = Math.floor(Date.now() / 1000);
  const shouldRefresh = Boolean(stored.refresh_token && stored.expires_at && stored.expires_at <= now + 45);
  if (shouldRefresh && stored.refresh_token) {
    try { return (await lbRefreshSession(stored.refresh_token)).access_token; }
    catch { storeLbSession(null); return requestedToken; }
  }

  return stored.access_token || requestedToken;
}

export async function lbRpc<T>(name: string, payload: Record<string, unknown> = {}, token?: string): Promise<T> {
  let effectiveToken = await resolveStaffToken(token);
  let response = await fetch(`${LB_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: jsonHeaders(effectiveToken),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (response.status === 401 && token && typeof window !== "undefined") {
    const stored = readStoredLbSession();
    if (stored?.refresh_token) {
      try {
        const refreshed = await lbRefreshSession(stored.refresh_token);
        effectiveToken = refreshed.access_token;
        response = await fetch(`${LB_SUPABASE_URL}/rest/v1/rpc/${name}`, {
          method: "POST",
          headers: jsonHeaders(effectiveToken),
          body: JSON.stringify(payload),
          cache: "no-store",
        });
      } catch {
        storeLbSession(null);
      }
    }
  }

  return parseResponse<T>(response);
}

export async function lbSignIn(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${LB_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: LB_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  return normalizeSession(await parseResponse<AuthSession>(response));
}

export async function lbSignUp(email: string, password: string): Promise<AuthSession | { user?: { id: string; email?: string } }> {
  const response = await fetch(`${LB_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: LB_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const result = await parseResponse<AuthSession | { user?: { id: string; email?: string } }>(response);
  return "access_token" in result && result.access_token ? normalizeSession(result as AuthSession) : result;
}

export async function getLiveMenu() {
  return lbRpc<LiveProduct[]>("lb_public_menu");
}

export async function createLiveOrder(input: {
  name: string;
  phone: string;
  address: string;
  fulfilment: "delivery" | "pickup";
  paymentMethod: "cash" | "online";
  items: { slug: string; quantity: number }[];
  source?: string;
}) {
  return lbRpc<CreatedOrder>("lb_create_order", {
    p_customer_name: input.name,
    p_customer_phone: input.phone,
    p_delivery_address: input.address,
    p_fulfilment: input.fulfilment,
    p_payment_method: input.paymentMethod,
    p_items: input.items,
    p_source: input.source ?? "web",
  });
}

export async function trackLiveOrder(token: string) {
  return lbRpc<TrackedOrder | null>("lb_track_order", { p_tracking_token: token.trim() });
}

export async function captureLiveEvent(eventName: string, sessionId?: string, source?: string, properties: Record<string, unknown> = {}) {
  try {
    await lbRpc<void>("lb_capture_event", { p_event_name: eventName, p_session_id: sessionId ?? null, p_source: source ?? null, p_properties: properties });
  } catch {
    // Analytics must never break ordering.
  }
}

export const getManagementDashboard = (token: string) => lbRpc<ManagementDashboardData>("lb_management_dashboard", {}, token);
export const getManagementOrders = (token: string) => lbRpc<ManagementOrder[]>("lb_management_orders", {}, token);
export const getOperationsOrders = (token: string) => lbRpc<OperationsOrderRecord[]>("lb_operations_orders", {}, token);
export const updateManagementOrder = (token: string, orderId: string, status: string) => lbRpc<{ id: string; status: string }>("lb_management_update_order", { p_order_id: orderId, p_status: status }, token);
export const getManagementEmployees = (token: string) => lbRpc<ManagementEmployee[]>("lb_management_employees", {}, token);
export const createManagementEmployee = (token: string, input: { name: string; role: string; station?: string; phone?: string }) => lbRpc<{ id: string; employee_code: string }>("lb_management_create_employee", { p_name: input.name, p_role: input.role, p_station: input.station ?? null, p_phone: input.phone ?? null }, token);
export const linkManagementEmployee = (token: string, employeeId: string, email: string, role: string) => lbRpc("lb_management_link_employee", { p_employee_id: employeeId, p_email: email, p_role: role }, token);
export const createManagementShift = (token: string, input: { employeeId: string; date: string; startsAt: string; endsAt: string; station?: string }) => lbRpc("lb_management_create_shift", { p_employee_id: input.employeeId, p_shift_date: input.date, p_starts_at: input.startsAt, p_ends_at: input.endsAt, p_station: input.station ?? null }, token);
export const assignManagementTask = (token: string, input: { employeeId: string; title: string; detail?: string; priority?: string; dueAt?: string }) => lbRpc("lb_management_assign_task", { p_employee_id: input.employeeId, p_title: input.title, p_detail: input.detail ?? "", p_priority: input.priority ?? "normal", p_due_at: input.dueAt ?? null }, token);
export const decideManagementLeave = (token: string, requestId: string, status: "approved" | "rejected", note?: string) => lbRpc("lb_management_decide_leave", { p_request_id: requestId, p_status: status, p_note: note ?? null }, token);
export const adjustManagementInventory = (token: string, input: { name: string; unit: string; quantityChange: number; reason: string; minimum?: number; unitCost?: number }) => lbRpc("lb_management_inventory_adjust", { p_name: input.name, p_unit: input.unit, p_quantity_change: input.quantityChange, p_reason: input.reason, p_minimum: input.minimum ?? 0, p_unit_cost: input.unitCost ?? 0 }, token);
export const getStaffSnapshot = (token: string) => lbRpc<StaffSnapshot>("lb_staff_snapshot", {}, token);
export const completeStaffTask = (token: string, taskId: string, evidenceUrl?: string) => lbRpc("lb_staff_complete_task", { p_task_id: taskId, p_evidence_url: evidenceUrl ?? null }, token);
export const requestStaffLeave = (token: string, start: string, end: string, reason: string) => lbRpc("lb_staff_request_leave", { p_start: start, p_end: end, p_reason: reason }, token);
