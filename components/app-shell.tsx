"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { moduleOrder, platformRoutes } from "@/lib/platform";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = platformRoutes.find((item) => item.path === pathname);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/management/dashboard" aria-label="London Bite platform home">
          <span className="brandMark">LB</span>
          <span><strong>London Bite</strong><small>Operations Platform</small></span>
        </Link>
        <nav className="nav" aria-label="Platform navigation">
          {moduleOrder.map((module) => {
            const items = platformRoutes.filter((item) => item.module === module);
            const active = current?.module === module;
            return (
              <details key={module} open={active || module === "Management"} className="navGroup">
                <summary>{module}<span>{items.length}</span></summary>
                <div className="navItems">
                  {items.map((item) => (
                    <Link key={item.path} className={pathname === item.path ? "active" : ""} href={item.path}>{item.title}</Link>
                  ))}
                </div>
              </details>
            );
          })}
        </nav>
        <div className="sidebarFoot">
          <span className="liveDot" /> Production workflow
          <small>GitHub → Vercel</small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">{current?.module ?? "London Bite"}</span><strong>{current?.title ?? "Operations"}</strong></div>
          <div className="topActions"><span className="statusPill">SA Gardens</span><span className="statusPill good">System Online</span></div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
