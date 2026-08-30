import { lbRpc } from "@/lib/lb-api";

export type DailyExpense = {
  id: string;
  business_date: string;
  category: string;
  detail: string;
  amount: number;
  payment_method: "cash" | "online" | "bank" | "other";
  created_at: string;
};

export type IposDailySummary = {
  business_date: string;
  status: "open" | "closed";
  closed_at: string | null;
  order_count: number;
  paid_sales: number;
  cash_sales: number;
  online_sales: number;
  unpaid_count: number;
  unpaid_total: number;
  expense_total: number;
  net_after_expenses: number;
  next_order_number: number;
  expenses: DailyExpense[];
};

export const getIposDailySummary = (token: string, businessDate?: string) =>
  lbRpc<IposDailySummary>("lb_ipos_daily_summary", { p_business_date: businessDate ?? null }, token);

export const addIposExpense = (
  token: string,
  input: { category: string; detail?: string; amount: number; paymentMethod: DailyExpense["payment_method"] },
) =>
  lbRpc<IposDailySummary>("lb_ipos_add_expense", {
    p_category: input.category,
    p_detail: input.detail ?? "",
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
  }, token);

export const closeIposBusinessDay = (token: string) =>
  lbRpc<IposDailySummary>("lb_ipos_close_day", {}, token);
