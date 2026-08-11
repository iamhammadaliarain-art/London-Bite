import type { Metadata } from "next";
import { CustomerOrderingApp } from "@/components/customer-commerce";

export const metadata: Metadata = {
  title: "Order Online | London Bite",
  description: "Browse the London Bite menu, build your basket, choose delivery or pickup, and track your order journey.",
};

export default function OrderPage() {
  return <CustomerOrderingApp />;
}
