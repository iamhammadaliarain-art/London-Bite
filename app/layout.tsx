import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "London Bite | Order Direct",
  description: "Discover London Bite favourites, order for delivery or pickup, and follow your order journey directly from LondonBite.com.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/london-bite-logo.png", apple: "/brand/london-bite-logo.png" },
  applicationName: "London Bite",
  appleWebApp: { capable: true, title: "London Bite", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}<script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}" }} /></body></html>;
}
