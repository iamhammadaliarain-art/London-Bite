import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PlatformPage } from "@/components/platform-page";
import { findPlatformRoute, platformRoutes } from "@/lib/platform";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return platformRoutes.map((item) => ({ slug: item.path.slice(1).split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const route = findPlatformRoute(slug);
  return { title: route ? `${route.title} | London Bite` : "London Bite Platform" };
}

export default async function PlatformRoutePage({ params }: Props) {
  const { slug } = await params;
  const route = findPlatformRoute(slug);
  if (!route) notFound();
  return <AppShell><PlatformPage route={route} /></AppShell>;
}
