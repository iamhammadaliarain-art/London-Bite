import type { Metadata, Viewport } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { PwaRuntime } from "@/components/pwa-runtime";

export const metadata: Metadata = {
  title: "London Bite | Order Direct",
  description: "Discover London Bite favourites, order for delivery or pickup, and follow your order journey directly from LondonBite.com.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/london-bite-logo.png", apple: "/brand/london-bite-logo.png" },
  applicationName: "London Bite",
  appleWebApp: { capable: true, title: "London Bite", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#07182f",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}<PwaRuntime /></body></html>;
}
