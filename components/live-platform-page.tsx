"use client";

import type { PlatformRoute } from "@/lib/platform";
import { PlatformPage } from "@/components/platform-page";
import {
  LiveEmployeeAttendance,
  LiveEmployeeHome,
  LiveEmployeeLeave,
  LiveEmployeePayroll,
  LiveKitchenBoard,
  LiveManagementAnalytics,
  LiveManagementDashboard,
  LiveManagementInventory,
  LiveManagementLeave,
  LiveManagementPayroll,
  LiveManagementSchedule,
  LiveManagementSettings,
  LiveRiderBoard,
  LiveStaffDirectory,
} from "@/components/live-operations";

function Header({ route }: { route: PlatformRoute }) {
  return <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"><div><span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue">{route.module} · Live</span><h1 className="my-1 text-[30px] font-bold tracking-[-0.04em] text-lb-navy">{route.title}</h1><p className="m-0 max-w-2xl text-sm text-lb-muted">{route.purpose}</p></div><span className="hidden rounded-full border border-white/80 bg-white/60 px-3 py-1.5 font-mono text-[10px] text-lb-muted backdrop-blur-xl md:inline">{route.path}</span></div>;
}

function LiveBody({ route }: { route: PlatformRoute }) {
  if (["/management/dashboard","/management/orders","/management/orders/retrieve"].includes(route.path)) return <LiveManagementDashboard />;
  if (["/management/employees","/management/documents","/management/contracts"].includes(route.path)) return <LiveStaffDirectory />;
  if (route.path === "/management/inventory") return <LiveManagementInventory />;
  if (route.path === "/management/attendance") return <LiveManagementSchedule />;
  if (["/management/payroll","/management/fines"].includes(route.path)) return <LiveManagementPayroll />;
  if (route.path === "/management/leave") return <LiveManagementLeave />;
  if (["/management/reports","/management/audit","/management/stars","/management/leaderboard"].includes(route.path)) return <LiveManagementAnalytics />;
  if (route.path === "/management/settings") return <LiveManagementSettings />;
  if (route.module === "Kitchen") return <LiveKitchenBoard />;
  if (route.module === "Rider") return <LiveRiderBoard />;
  if (["/employee/attendance"].includes(route.path)) return <LiveEmployeeAttendance />;
  if (["/employee/leave"].includes(route.path)) return <LiveEmployeeLeave />;
  if (["/employee/payroll","/employee/fines","/employee/stars"].includes(route.path)) return <LiveEmployeePayroll />;
  if (route.module === "Employee") return <LiveEmployeeHome />;
  return null;
}

export function LivePlatformPage({ route }: { route: PlatformRoute }) {
  const live = <LiveBody route={route} />;
  if (live.props.children === null) return <PlatformPage route={route} />;
  return <><Header route={route} />{live}</>;
}
