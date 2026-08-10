"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getPrimaryNavigationPath, moduleOrder, platformRoutes, primaryNavigationRoutes } from "@/lib/platform";

const glass = "border border-white/70 bg-white/70 shadow-[0_16px_50px_rgba(7,24,47,0.08)] backdrop-blur-2xl";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = platformRoutes.find((item) => item.path === pathname);
  const activePrimaryPath = getPrimaryNavigationPath(pathname);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4f7fb] text-lb-ink">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-28 -top-28 size-[420px] rounded-full bg-lb-blue/10 blur-3xl" />
        <div className="absolute right-[-120px] top-[12%] size-[380px] rounded-full bg-lb-red/10 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[34%] size-[440px] rounded-full bg-sky-200/35 blur-3xl" />
      </div>

      <div className="relative z-10 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[286px_minmax(0,1fr)]">
        <aside className={`m-3 flex max-h-[360px] flex-col overflow-auto rounded-[30px] p-3 lg:sticky lg:top-3 lg:h-[calc(100vh-24px)] lg:max-h-none ${glass}`}>
          <Link href="/management/dashboard" className="flex items-center gap-3 rounded-[22px] bg-white/70 p-2.5 no-underline transition hover:bg-white/90" aria-label="London Bite platform home">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-black/5">
              <Image src="/brand/london-bite-logo.png" alt="London Bite" width={56} height={56} className="h-full w-full object-contain" priority />
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-sm text-lb-navy">London Bite</strong>
              <span className="block truncate text-[11px] text-lb-muted">Operations Platform</span>
            </div>
          </Link>

          <nav className="mt-3 grid gap-1" aria-label="Primary platform navigation">
            {moduleOrder.map((module) => {
              const items = primaryNavigationRoutes.filter((item) => item.module === module);
              const active = current?.module === module;
              return (
                <details key={module} open={active || module === "Management"} className="rounded-[20px]">
                  <summary className="flex cursor-pointer items-center justify-between rounded-[16px] px-3 py-2.5 text-sm font-extrabold text-lb-navy hover:bg-white/60">
                    {module}
                    <span className="rounded-full bg-lb-navy/5 px-2 py-0.5 text-[10px] text-lb-muted">{items.length}</span>
                  </summary>
                  <div className="grid gap-0.5 px-1 pb-2">
                    {items.map((item) => {
                      const isActive = activePrimaryPath === item.path;
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          className={`rounded-[14px] px-3 py-2 text-[12px] font-semibold no-underline transition ${isActive ? "bg-lb-navy text-white shadow-[0_8px_18px_rgba(7,24,47,0.18)]" : "text-[#536073] hover:bg-white/75 hover:text-lb-navy"}`}
                        >
                          {item.title}
                        </Link>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[20px] border border-white/80 bg-white/60 p-3 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[11px] font-bold text-lb-navy"><span className="size-2 rounded-full bg-lb-green shadow-[0_0_0_4px_rgba(22,122,76,0.12)]" />Foundation online</div>
            <p className="mb-0 mt-1 text-[10px] text-lb-muted">32 primary screens · 53 routes</p>
          </div>
        </aside>

        <main className="min-w-0">
          <header className={`mx-3 mt-3 flex h-[74px] items-center justify-between rounded-[26px] px-4 sm:px-5 lg:sticky lg:top-3 lg:z-20 ${glass}`}>
            <div className="grid">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue">{current?.module ?? "London Bite"}</span>
              <strong className="text-[15px] text-lb-navy">{current?.title ?? "Operations"}</strong>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-white/80 bg-white/65 px-3 py-1.5 text-[10px] font-bold text-lb-muted backdrop-blur-xl">SA Gardens</span>
              <span className="rounded-full border border-[#cfeede] bg-[#eaf8f0]/80 px-3 py-1.5 text-[10px] font-bold text-lb-green backdrop-blur-xl">System Online</span>
            </div>
          </header>
          <div className="mx-auto max-w-[1500px] p-3 sm:p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
