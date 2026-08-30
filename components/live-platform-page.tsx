"use client";

import type { ReactNode } from "react";
import type { PlatformRoute } from "@/lib/platform";
import { PlatformPage } from "@/components/platform-page";
import {
  LiveEmployeeAttendance,
  LiveEmployeeHome,
  LiveEmployeeLeave,
  LiveEmployeePayroll,
  LiveKitchenBoard,
  LiveManagementLeave,
  LiveManagementPayroll,
  LiveStaffDirectory,
} from "@/components/live-operations";
import {
  LiveManagementAnalyticsV2,
  LiveManagementInventoryV2,
} from "@/components/live-operations-v2";
import {
  LiveManagementAttendanceScheduleReviewed,
  LiveManagementCustomersRetentionReviewed,
  LiveManagementDashboardReviewed,
} from "@/components/live-management-review-fixes";
import { LiveManagementSettingsReviewed } from "@/components/live-settings-reviewed";
import {
  LiveEmployeeSuggestions,
  LiveManagementAttendance,
  LiveManagementAudit,
  LiveManagementComms,
  LiveMenuControl,
} from "@/components/live-extra";
import {
  LiveCounterRetrieve,
  LiveEmployeeInventoryUpload,
  LiveEmployeeProfile,
  LiveKitchenQc,
  LiveKitchenStock,
  LiveManagementDocuments,
  LiveManagementOrders,
  LiveRiderDailySheet,
  LiveRiderJobs,
  LiveRiderPerformance,
} from "@/components/live-route-completion";
import { LiveCounterMembershipPOS, LiveMembership, LiveWorkforcePerformance } from "@/components/live-growth-performance";
import { LiveCounterOrderTaking } from "@/components/counter-order-taking";
import { LiveIposDailyClosing } from "@/components/ipos-daily-closing";

function Header({ route }: { route: PlatformRoute }) {
  return <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"><div><span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue">{route.module} · Live</span><h1 className="my-1 text-[30px] font-bold tracking-[-0.04em] text-lb-navy">{route.title}</h1><p className="m-0 max-w-2xl text-sm text-lb-muted">{route.purpose}</p></div><span className="hidden rounded-full border border-white/80 bg-white/60 px-3 py-1.5 font-mono text-[10px] text-lb-muted backdrop-blur-xl md:inline">{route.path}</span></div>;
}

function resolveLiveBody(route: PlatformRoute): ReactNode | null {
  if (route.path === "/management/dashboard") return <LiveManagementDashboardReviewed />;
  if (route.path === "/management/orders") return <LiveManagementOrders />;
  if (route.path === "/management/orders/retrieve") return <LiveCounterRetrieve />;
  if (route.path === "/management/customers") return <LiveManagementCustomersRetentionReviewed />;
  if (route.path === "/management/menu") return <LiveMenuControl />;
  if (route.path === "/management/inventory") return <LiveManagementInventoryV2 />;
  if (route.path === "/management/employees") return <LiveStaffDirectory />;
  if (route.path === "/management/attendance") return <LiveManagementAttendanceScheduleReviewed />;
  if (route.path === "/management/fines") return <LiveManagementAttendance />;
  if (route.path === "/management/payroll") return <LiveManagementPayroll />;
  if (route.path === "/management/leave") return <LiveManagementLeave />;
  if (route.path === "/management/documents") return <LiveManagementDocuments />;
  if (route.path === "/management/contracts") return <LiveManagementDocuments contractMode />;
  if (["/management/announcements","/management/suggestions"].includes(route.path)) return <LiveManagementComms />;
  if (route.path === "/management/reports") return <LiveManagementAnalyticsV2 />;
  if (["/management/stars","/management/leaderboard"].includes(route.path)) return <LiveWorkforcePerformance />;
  if (route.path === "/management/audit") return <LiveManagementAudit />;
  if (route.path === "/management/settings") return <LiveManagementSettingsReviewed />;

  if (route.path === "/ipos") return <LiveIposDailyClosing />;
  if (route.path === "/ipos/new-order") return <LiveCounterOrderTaking />;
  if (route.path === "/ipos/menu") return <LiveCounterMembershipPOS />;
  if (["/ipos/retrieve","/ipos/receipts"].includes(route.path)) return <LiveCounterRetrieve />;
  if (route.path === "/ipos/payments") return <LiveIposDailyClosing />;
  if (route.path === "/ipos/customers") return <LiveCounterRetrieve customerMode />;
  if (route.path === "/ipos/membership") return <LiveMembership />;

  if (["/kitchen","/kitchen/queue","/kitchen/preparing","/kitchen/ready"].includes(route.path)) return <LiveKitchenBoard />;
  if (route.path === "/kitchen/stock") return <LiveKitchenStock />;
  if (route.path === "/kitchen/qc") return <LiveKitchenQc />;

  if (["/rider","/rider/orders","/rider/active-delivery"].includes(route.path)) return <LiveRiderJobs />;
  if (route.path === "/rider/history") return <LiveRiderJobs history />;
  if (route.path === "/rider/daily-sheet") return <LiveRiderDailySheet />;
  if (route.path === "/rider/performance") return <LiveRiderPerformance />;

  if (route.path === "/employee") return <LiveEmployeeHome />;
  if (route.path === "/employee/profile") return <LiveEmployeeProfile />;
  if (route.path === "/employee/attendance") return <LiveEmployeeAttendance />;
  if (route.path === "/employee/leave") return <LiveEmployeeLeave />;
  if (["/employee/payroll","/employee/fines","/employee/stars"].includes(route.path)) return <LiveEmployeePayroll />;
  if (route.path === "/employee/suggestions") return <LiveEmployeeSuggestions />;
  if (route.path === "/employee/inventory-upload") return <LiveEmployeeInventoryUpload />;
  if (route.path === "/employee/announcements") return <LiveEmployeeHome />;
  return null;
}

export function LivePlatformPage({ route }: { route: PlatformRoute }) {
  const body = resolveLiveBody(route);
  if (body === null) return <PlatformPage route={route} />;
  return <><Header route={route} />{body}</>;
}
