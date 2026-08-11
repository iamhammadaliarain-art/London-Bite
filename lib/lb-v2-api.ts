import { LB_SUPABASE_ANON_KEY, LB_SUPABASE_URL, lbRpc, type CreatedOrder } from "@/lib/lb-api";

export type EnhancedCreatedOrder = CreatedOrder & {
  scheduled_for: string | null;
  referral_code: string | null;
};

export type EnhancedOperationsOrder = {
  id: string;
  order_number: number;
  status: "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
  fulfilment: "delivery" | "pickup";
  payment_status: string;
  total: number;
  created_at: string;
  scheduled_for: string | null;
  referral_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: { name: string; quantity: number }[];
};

export type ReferralCodeRecord = {
  code: string;
  label: string;
  status: "active" | "paused" | "expired";
  max_uses: number | null;
  uses: number;
  valid_until: string | null;
  reward_note: string | null;
};

export type RecipeRecord = {
  id: string;
  menu_item_id: string;
  menu_name: string;
  menu_slug: string;
  inventory_item_id: string;
  inventory_name: string;
  inventory_unit: string;
  quantity_per_unit: number;
};

export type ManagementIntelligence = {
  top_products: { name: string; units: number; orders: number; revenue: number }[];
  demand_hours: { hour: number; orders: number; revenue: number }[];
  repeat_customers: number;
  scheduled_orders: number;
  referral_orders: number;
  avg_prep_minutes: number | null;
  avg_delivery_minutes: number | null;
};

export const createEnhancedOrder = (input: {
  name: string;
  phone: string;
  address: string;
  fulfilment: "delivery" | "pickup";
  paymentMethod: "cash" | "online";
  items: { slug: string; quantity: number }[];
  source?: string;
  scheduledFor?: string | null;
  referralCode?: string | null;
}) => lbRpc<EnhancedCreatedOrder>("lb_create_order_v2", {
  p_customer_name: input.name,
  p_customer_phone: input.phone,
  p_delivery_address: input.address,
  p_fulfilment: input.fulfilment,
  p_payment_method: input.paymentMethod,
  p_items: input.items,
  p_source: input.source ?? "web",
  p_scheduled_for: input.scheduledFor ?? null,
  p_referral_code: input.referralCode ?? null,
});

export const getEnhancedOperationsOrders = (token: string) =>
  lbRpc<EnhancedOperationsOrder[]>("lb_operations_orders_v2", {}, token);

export const getManagementIntelligence = (token: string, days = 30) =>
  lbRpc<ManagementIntelligence>("lb_management_intelligence", { p_days: days }, token);

export const getManagementReferralCodes = (token: string) =>
  lbRpc<ReferralCodeRecord[]>("lb_management_referral_codes", {}, token);

export const upsertManagementReferralCode = (token: string, input: {
  code: string;
  label: string;
  status?: "active" | "paused" | "expired";
  maxUses?: number | null;
  validUntil?: string | null;
  rewardNote?: string | null;
}) => lbRpc<{ code: string; status: string }>("lb_management_referral_upsert", {
  p_code: input.code,
  p_label: input.label,
  p_status: input.status ?? "active",
  p_max_uses: input.maxUses ?? null,
  p_valid_until: input.validUntil ?? null,
  p_reward_note: input.rewardNote ?? null,
}, token);

export const getManagementRecipes = (token: string) =>
  lbRpc<RecipeRecord[]>("lb_management_recipes", {}, token);

export const upsertManagementRecipe = (token: string, input: {
  menuSlug: string;
  inventoryItemId: string;
  quantityPerUnit: number;
}) => lbRpc<{ id: string }>("lb_management_recipe_upsert", {
  p_menu_slug: input.menuSlug,
  p_inventory_item_id: input.inventoryItemId,
  p_quantity_per_unit: input.quantityPerUnit,
}, token);

async function readAuthResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "msg" in payload
      ? String((payload as { msg: unknown }).msg)
      : typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function requestLbPasswordReset(email: string, redirectTo: string) {
  const response = await fetch(`${LB_SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: LB_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });
  return readAuthResponse(response);
}

export async function completeLbPasswordReset(accessToken: string, password: string) {
  const response = await fetch(`${LB_SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: LB_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  return readAuthResponse(response);
}
