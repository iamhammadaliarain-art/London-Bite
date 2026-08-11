import type { Metadata } from "next";
import { CustomerOrderingPrivacyGuard } from "@/components/customer-ordering-privacy-guard";

export const metadata: Metadata = {
  title: "Order Online | London Bite",
  description: "Browse the live London Bite menu, schedule delivery or pickup, reorder favourites, save addresses and track your order journey.",
};

export default function OrderPage() {
  return <CustomerOrderingPrivacyGuard />;
}
