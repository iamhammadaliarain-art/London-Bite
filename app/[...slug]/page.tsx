import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShellV2 } from "@/components/app-shell-v2";
import { LivePlatformPage } from "@/components/live-platform-page";
import { findPlatformRoute, platformRoutes } from "@/lib/platform";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return platformRoutes.map((item) => ({ slug: item.path.slice(1).split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const route = findPlatformRoute(slug);
  return { title: route ? `${route.title} | London Bite` : "London Bite Platform", robots: route ? { index: false, follow: false } : undefined };
}

export default async function PlatformRoutePage({ params }: Props) {
  const { slug } = await params;
  const route = findPlatformRoute(slug);
  if (!route) notFound();
  if (route.path === "/customer/track") redirect("/order?view=track");
  if (route.path === "/customer/receipt") redirect("/order?view=history");
  if (route.path === "/customer/rating") redirect("/feedback");
  return <AppShellV2><LivePlatformPage route={route} /></AppShellV2>;
}
