import type { Metadata } from "next";
import { StaffPasswordReset } from "@/components/staff-password-reset";

export const metadata: Metadata = {
  title: "Reset Staff Password | London Bite",
  description: "Secure London Bite staff account recovery.",
  robots: { index: false, follow: false },
};

export default function StaffPasswordResetPage() {
  return <StaffPasswordReset />;
}
