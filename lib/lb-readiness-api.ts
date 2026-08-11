import { lbRpc } from "@/lib/lb-api";

export type ReadinessItem = { ready: boolean; count?: number; external?: boolean };
export type LaunchReadiness = {
  menu: ReadinessItem;
  employees: ReadinessItem;
  staff_accounts: ReadinessItem;
  inventory: ReadinessItem;
  geofence: ReadinessItem;
  order_pipeline: ReadinessItem;
  cash_orders: ReadinessItem;
  online_payment: ReadinessItem;
  native_store_release: ReadinessItem;
};

export function getLaunchReadiness(token: string) {
  return lbRpc<LaunchReadiness>("lb_management_launch_readiness", {}, token);
}
