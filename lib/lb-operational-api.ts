import { getLiveMenu, lbRpc, type LiveProduct } from "@/lib/lb-api";
import { assignRider } from "@/lib/lb-route-api";

export type OperationalState = "CREATED" | "QUEUED" | "PREPARING" | "READY" | "HANDED_OVER" | "SERVED" | "PICKED_UP" | "FULFILLED" | "CLOSED" | "CANCELLED";
export type OperationalAction = "START_PREP" | "MARK_READY" | "SERVE" | "HAND_OVER" | "RIDER_PICKUP" | "DELIVER" | "CANCEL";

export type OperationalOrder = {
  id: string;
  order_number: number;
  operational_state: OperationalState;
  legacy_status: string;
  channel: "dine_in" | "pickup" | "delivery";
  payment_status: string;
  payment_method: string;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  table_identifier: string | null;
  pickup_name: string | null;
  target_due_at: string | null;
  ready_at: string | null;
  delivery_state: string | null;
  created_at: string;
  overdue: boolean;
  items: { name: string; quantity: number }[];
  subtasks: { id: string; label: string; station: string | null; status: string; assigned_employee_id: string | null }[];
};

export type OperationalCommandCenter = {
  live_orders: number;
  queued: number;
  preparing: number;
  ready: number;
  overdue: number;
  payment_exceptions: number;
  cash_variances: number;
  cash_open: number;
  unresolved_amount: number;
  recent_events: { id: number; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string }[];
};

export type CounterOrderInput = {
  channel: "dine_in" | "pickup" | "delivery";
  customerName: string;
  customerPhone: string;
  address: string;
  tableIdentifier: string;
  pickupName: string;
  paymentCondition: "paid_now" | "pay_later" | "cash_on_delivery" | "collect_at_handoff";
  paymentMethod: "cash" | "online";
  items: { slug: string; quantity: number; variant?: string }[];
  notes?: string;
};

export const getOperationalMenu = (): Promise<LiveProduct[]> => getLiveMenu();
export const getOperationalOrders = (token: string) => lbRpc<OperationalOrder[]>("lb_operational_orders", {}, token);
export const getOperationalCommandCenter = (token: string) => lbRpc<OperationalCommandCenter>("lb_operational_command_center", {}, token);
export const createOperationalOrder = (token: string, input: CounterOrderInput) => lbRpc<{ id: string; order_number: number; tracking_token: string; target_due_at: string }>("lb_operational_create_order", {
  p_channel: input.channel,
  p_customer_name: input.customerName,
  p_customer_phone: input.customerPhone,
  p_address: input.address,
  p_table_identifier: input.tableIdentifier,
  p_pickup_name: input.pickupName,
  p_payment_condition: input.paymentCondition,
  p_payment_method: input.paymentMethod,
  p_items: input.items,
  p_notes: input.notes ?? null,
}, token);
export const transitionOperationalOrder = (token: string, orderId: string, action: OperationalAction, reason?: string) => lbRpc<{ id: string; state: OperationalState }>("lb_operational_transition", { p_order_id: orderId, p_action: action, p_reason: reason ?? null }, token);
export const recordOperationalPayment = (token: string, orderId: string, amount: number, method: "cash" | "online", event: "PAYMENT_COLLECTED" | "REFUND_RECORDED" = "PAYMENT_COLLECTED", reason?: string) => lbRpc("lb_operational_record_payment", { p_order_id: orderId, p_amount: amount, p_method: method, p_event: event, p_reason: reason ?? null }, token);
export const openOperationalShift = (token: string, openingFloat: number) => lbRpc<{ id: string; status: string }>("lb_operational_shift_open", { p_opening_float: openingFloat }, token);
export const closeOperationalShift = (token: string, shiftId: string, actualCash: number, explanation?: string) => lbRpc<{ id: string; expected: number; actual: number; variance: number }>("lb_operational_shift_close", { p_shift_id: shiftId, p_actual_cash: actualCash, p_explanation: explanation ?? null }, token);
export const assignOperationalRider = assignRider;
