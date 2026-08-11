"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  getPrimaryNavigationPath,
  moduleOrder,
  platformRoutes,
  primaryNavigationRoutes,
  type PlatformModule,
} from "@/lib/platform";

const shellGlass = "border border-white/10 bg-black/82 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl";
const mutedGlass = "border border-white/10 bg-white/[0.055] shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl";

function ModuleMark({ module }: { module: PlatformModule }) {
  const marks: Record<PlatformModule, string> = {
    Management: "M",
    iPOS: "P",
    Kitchen: "K",
    Rider: "R",
    Employee: "E",
    Customer: "C",
  };
  return <span className="grid size-7 place-items-center rounded-[10px] bg-lb-blue text-[10px] font-black text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">{marks[module]}</span>;
}

function NavGroup({ module, pathname, activePrimaryPath, onNavigate }: {
  module: PlatformModule;
  pathname: string;
  activePrimaryPath: string | null;
  onNavigate?: () => void;
}) {
  const items = primaryNavigationRoutes.filter((item) => item.module === module);
  const activeModule = platformRoutes.find((item) => item.path === pathname)?.module === module;

  return <details open={activeModule || module === "Management"} className="group rounded-[20px]">
    <summary className="flex cursor-pointer select-none items-center justify-between rounded-[16px] px-2.5 py-2.5 text-sm font-extrabold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lb-blue/30">
      <span className="flex min-w-0 items-center gap-2.5"><ModuleMark module={module} /><span className="truncate">{module}</span></span>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/55">{items.length}</span>
    </summary>
    <div className="grid gap-1 px-1 pb-2 pt-1">
      {items.map((item) => {
        const active = activePrimaryPath === item.path;
        return <Link
          key={item.path}
          href={item.path}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`rounded-[14px] px-3 py-2.5 text-[12px] font-semibold no-underline transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lb-blue/30 ${active ? "bg-lb-blue text-white shadow-[0_12px_26px_rgba(41,40,167,0.34)]" : "text-white/62 hover:bg-white/10 hover:text-white"}`}
        >{item.title}</Link>;
      })}
    </div>
  </details>;
}

function SidebarContent({ pathname, activePrimaryPath, onNavigate }: {
  pathname: string;
  activePrimaryPath: string | null;
  onNavigate?: () => void;
}) {
  return <>
    <Link href="/management/dashboard" onClick={onNavigate} className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.055] p-2.5 no-underline transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lb-blue/30" aria-label="London Bite operations home">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-black shadow-sm ring-1 ring-white/10">
        <Image src="/brand/london-bite-official.svg" alt="London Bite" width={56} height={56} className="h-full w-full object-contain" priority />
      </div>
      <div className="min-w-0">
        <strong className="block truncate text-sm text-white">London Bite</strong>
        <span className="block truncate text-[11px] text-white/52">Restaurant operating system</span>
      </div>
    </Link>

    <nav className="mt-3 grid gap-1" aria-label="Platform navigation">
      {moduleOrder.map((module) => <NavGroup key={module} module={module} pathname={pathname} activePrimaryPath={activePrimaryPath} onNavigate={onNavigate} />)}
    </nav>

    <div className={`mt-auto rounded-[20px] p-3 ${mutedGlass}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold text-white"><span className="size-2 rounded-full bg-lb-green shadow-[0_0_0_4px_rgba(22,134,84,0.16)]" />Live platform</div>
      <p className="mb-0 mt-1 text-[10px] leading-4 text-white/50">53 routes · role-scoped operations · customer commerce connected</p>
    </div>
  </>;
}

function MobileDock({ module, pathname }: { module?: PlatformModule; pathname: string }) {
  const items = useMemo(() => {
    if (!module) return [];
    const moduleItems = primaryNavigationRoutes.filter((item) => item.module === module);
    const activeIndex = moduleItems.findIndex((item) => item.path === getPrimaryNavigationPath(pathname));
    const selected = [moduleItems[0], moduleItems[Math.max(activeIndex, 0)], moduleItems[1], moduleItems[2]].filter(Boolean);
    return Array.from(new Map(selected.map((item) => [item.path, item])).values()).slice(0, 4);
  }, [module, pathname]);

  if (!items.length) return null;
  return <nav className={`fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 gap-1 rounded-[22px] p-1.5 lg:hidden ${shellGlass}`} aria-label={`${module} quick navigation`}>
    {items.map((item) => {
      const active = getPrimaryNavigationPath(pathname) === item.path;
      return <Link key={item.path} href={item.path} aria-current={active ? "page" : undefined} className={`grid min-h-12 place-items-center rounded-[16px] px-1 text-center text-[9px] font-black no-underline transition ${active ? "bg-lb-blue text-white" : "text-white/55 hover:bg-white/10 hover:text-white"}`}>{item.title}</Link>;
    })}
  </nav>;
}

export function AppShellV2({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = platformRoutes.find((item) => item.path === pathname);
  const activePrimaryPath = getPrimaryNavigationPath(pathname);

  return <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_0%_0%,rgba(41,40,167,0.24),transparent_32%),radial-gradient(circle_at_100%_18%,rgba(255,31,40,0.18),transparent_28%),#000000] text-lb-ink">
    <a href="#platform-main" className="fixed left-3 top-3 z-[70] -translate-y-24 rounded-full bg-lb-red px-4 py-2 text-xs font-black text-white transition focus:translate-y-0">Skip to content</a>

    {menuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-50 border-0 bg-black/70 backdrop-blur-sm lg:hidden" />}
    <aside className={`fixed inset-y-3 left-3 z-[60] flex w-[min(88vw,320px)] flex-col overflow-y-auto rounded-[30px] p-3 transition duration-300 lg:hidden ${shellGlass} ${menuOpen ? "translate-x-0" : "-translate-x-[110%]"}`} aria-hidden={!menuOpen}>
      <div className="mb-2 flex justify-end"><button type="button" onClick={() => setMenuOpen(false)} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/10 text-lg text-white" aria-label="Close menu">×</button></div>
      <SidebarContent pathname={pathname} activePrimaryPath={activePrimaryPath} onNavigate={() => setMenuOpen(false)} />
    </aside>

    <div className="relative z-10 lg:grid lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
      <aside className={`m-3 hidden h-[calc(100vh-24px)] flex-col overflow-y-auto rounded-[30px] p-3 lg:sticky lg:top-3 lg:flex ${shellGlass}`}>
        <SidebarContent pathname={pathname} activePrimaryPath={activePrimaryPath} />
      </aside>

      <main id="platform-main" className="min-w-0 pb-24 lg:pb-0">
        <header className={`sticky top-3 z-30 mx-3 mt-3 flex min-h-[72px] items-center justify-between gap-3 rounded-[26px] px-3.5 py-3 sm:px-5 ${shellGlass}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMenuOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-[15px] border border-white/10 bg-white/10 text-lg font-black text-white lg:hidden" aria-label="Open navigation">≡</button>
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-lb-red">{current?.module ?? "London Bite"}</span>
              <strong className="block truncate text-[15px] text-white sm:text-base">{current?.title ?? "Operations"}</strong>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold text-white/60 sm:inline-flex">SA Gardens</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-[9px] font-black text-emerald-300 sm:px-3 sm:text-[10px]"><span className="size-1.5 rounded-full bg-emerald-400" />Online</span>
          </div>
        </header>
        <div className="mx-auto max-w-[1560px] p-3 sm:p-4 lg:p-6">{children}</div>
      </main>
    </div>

    <MobileDock module={current?.module} pathname={pathname} />
  </div>;
}
