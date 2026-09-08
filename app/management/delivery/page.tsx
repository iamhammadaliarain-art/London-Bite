import type { Metadata } from "next";
import { AppShellV2 } from "@/components/app-shell-v2";
import { DeliveryControlSystem } from "@/components/delivery-control-system";

export const metadata: Metadata = { title: "Delivery Control | London Bite", robots: { index: false, follow: false } };

export default function ManagementDeliveryPage(){
  return <AppShellV2><DeliveryControlSystem mode="management" /></AppShellV2>;
}
