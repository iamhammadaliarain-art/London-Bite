import { lbRpc } from "@/lib/lb-api";

export type OperationsOrder = {
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

export type InventoryRecord = {
  id: string;
  name: string;
  unit: string;
  current_quantity: number;
  minimum_threshold: number;
  unit_cost: number;
  status: "ok" | "reorder";
  updated_at: string;
};

export type LeaveRecord = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  manager_note: string | null;
  created_at: string;
};

export type ShiftRecord = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  role: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  station: string | null;
  status: string;
};

export type AnalyticsSummary = {
  orders: number;
  revenue: number;
  average_order_value: number;
  cancelled: number;
  sources: { source: string; orders: number; revenue: number }[];
  events: { event: string; count: number }[];
  daily: { date: string; orders: number; revenue: number }[];
};

export type PayrollRecord = {
  id: string;
  period_start: string;
  period_end: string;
  base_amount: number;
  overtime_amount: number;
  bonus_amount: number;
  deduction_amount: number;
  net_amount: number;
  status: string;
  notes: string | null;
};

export const getOperationsOrders = (token: string) => lbRpc<OperationsOrder[]>("lb_operations_orders", {}, token);
export const updateOperationsOrder = (token: string, orderId: string, status: OperationsOrder["status"]) => lbRpc<{ id: string; status: string }>("lb_operations_update_order", { p_order_id: orderId, p_status: status }, token);
export const getManagementInventory = (token: string) => lbRpc<InventoryRecord[]>("lb_management_inventory", {}, token);
export const getManagementLeaveRequests = (token: string) => lbRpc<LeaveRecord[]>("lb_management_leave_requests", {}, token);
export const getManagementShifts = (token: string, date?: string) => lbRpc<ShiftRecord[]>("lb_management_shifts", { p_date: date ?? new Date().toISOString().slice(0, 10) }, token);
export const getManagementAnalytics = (token: string, days = 30) => lbRpc<AnalyticsSummary>("lb_management_analytics", { p_days: days }, token);
export const setManagementBranchLocation = (token: string, latitude: number, longitude: number, geofenceMeters = 100) => lbRpc("lb_management_set_branch_location", { p_latitude: latitude, p_longitude: longitude, p_geofence_meters: geofenceMeters }, token);
export const staffCheckIn = (token: string, latitude: number, longitude: number) => lbRpc<{ accepted: boolean; status: string; distance_meters: number; fine_amount: number }>("lb_staff_check_in", { p_latitude: latitude, p_longitude: longitude }, token);
export const staffCheckOut = (token: string, latitude: number, longitude: number) => lbRpc<{ accepted: boolean; status: string; distance_meters: number; fine_amount: number }>("lb_staff_check_out", { p_latitude: latitude, p_longitude: longitude }, token);
export const upsertManagementPayroll = (token: string, input: { employeeId: string; periodStart: string; periodEnd: string; base: number; overtime?: number; bonus?: number; deduction?: number; status?: "draft" | "approved" | "paid"; notes?: string }) => lbRpc("lb_management_payroll_upsert", { p_employee_id: input.employeeId, p_period_start: input.periodStart, p_period_end: input.periodEnd, p_base: input.base, p_overtime: input.overtime ?? 0, p_bonus: input.bonus ?? 0, p_deduction: input.deduction ?? 0, p_status: input.status ?? "draft", p_notes: input.notes ?? null }, token);
export const getStaffPayroll = (token: string) => lbRpc<PayrollRecord[]>("lb_staff_payroll", {}, token);
