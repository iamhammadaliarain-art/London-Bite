import type { Metadata } from "next";
import { CustomerOrderingV2 } from "@/components/customer-ordering-v2";

export const metadata: Metadata = {
  title: "Order Online | London Bite",
  description: "Browse the live London Bite menu, schedule delivery or pickup, reorder favourites, save addresses and track your order journey.",
};

export default function OrderPage() {
  return <CustomerOrderingV2 />;
}
