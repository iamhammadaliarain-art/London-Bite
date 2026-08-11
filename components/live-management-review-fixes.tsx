"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  LB_SUPABASE_URL,
  createManagementShift,
  getManagementDashboard,
  getManagementEmployees,
  lbSignIn,
  readStoredLbSession,
  storeLbSession,
  type AuthSession,
  type ManagementDashboardData,
  type ManagementEmployee,
} from "@/lib/lb-api";
import { getManagementAttendance, type AttendanceRecord } from "@/lib/lb-admin-extra-api";
import { getManagementCustomers, type CustomerSummary } from "@/lib/lb-route-api";
import { getManagementShifts, updateOperationsOrder, type ShiftRecord } from "@/lib/lb-operations-api";
import {
  getEnhancedOperationsOrders,
  getManagementReferralCodes,
  upsertManagementReferralCode,
  type EnhancedOperationsOrder,
  type ReferralCodeRecord,
} from "@/lib/lb-v2-api";

const panel = "rounded-[28px] border border-white/75 bg-white/70 p-5 shadow-[0_18px_55px_rgba(7,24,47,0.07)] backdrop-blur-2xl";
const soft = "rounded-[20px] border border-white/80 bg-white/60 backdrop-blur-xl";
const field = "min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/80 px-3 text-sm text-lb-ink outline-none focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const primary = "min-h-11 rounded-[14px] bg-lb-navy px-4 text-xs font-black text-white no-underline shadow-sm transition hover:bg-[#0b2748] disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/75 px-4 text-xs font-black text-lb-navy no-underline";
const eyebrow = "text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue";
const money = (value: number) => `Rs ${Math.round(Number(value) || 0).toLocaleString("en-PK")}`;

function restaurantDate() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function restaurantDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function useSession() {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    if (accessToken) {
      const next: AuthSession = { access_token: accessToken, refresh_token: hash.get("refresh_token") ?? undefined, expires_in: Number(hash.get("expires_in") ?? 3600) };
      storeLbSession(next);
      setSessionState(next);
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    } else setSessionState(readStoredLbSession());
    setReady(true);
  }, []);
  const setSession = (next: AuthSession | null) => { storeLbSession(next); setSessionState(next); };
  return { session, setSession, ready };
}

function LoginPanel({ onSignedIn }: { onSignedIn: (session: AuthSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { onSignedIn(await lbSignIn(email, password)); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Sign in failed"); }
    finally { setBusy(false); }
  };
  const google = () => {
    const redirect = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    window.location.href = `${LB_SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
  };
  return <section className={`mx-auto max-w-xl ${panel}`}>
    <span className={eyebrow}>Protected management</span><h2 className="mb-2 mt-1 text-2xl font-black text-lb-navy">London Bite management sign in</h2>
    <form onSubmit={submit} className="mt-5 grid gap-3"><input required type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email"/><input required type="password" minLength={6} className={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"/><button className={primary} disabled={busy}>{busy ? "Checking…" : "Sign in"}</button></form>
    <button type="button" className={`${secondary} mt-2 w-full`} onClick={google}>Continue with Google</button><Link href="/staff/reset-password" className="mt-4 block text-center text-xs font-black text-lb-blue no-underline">Forgot password?</Link>{message && <p className="mt-4 rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{message}</p>}
  </section>;
}

function Boundary({ children }: { children: (token: string, signOut: () => void) => ReactNode }) {
  const { session, setSession, ready } = useSession();
  if (!ready) return <section className={panel}>Loading secure session…</section>;
  if (!session?.access_token) return <LoginPanel onSignedIn={setSession}/>;
  return <>{children(session.access_token, () => setSession(null))}</>;
}

function Actions({ signOut, refresh, busy }: { signOut: () => void; refresh: () => void; busy?: boolean }) {
  return <div className="mb-3 flex flex-wrap justify-end gap-2"><button type="button" className={secondary} onClick={refresh} disabled={busy}>Refresh live data</button><button type="button" className={secondary} onClick={signOut}>Sign out</button></div>;
}

export function LiveManagementDashboardReviewed() {
  return <Boundary>{(token, signOut) => <Dashboard token={token} signOut={signOut}/>}</Boundary>;
}
function Dashboard({ token, signOut }: { token: string; signOut: () => void }) {
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [orders, setOrders] = useState<EnhancedOperationsOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const [dashboard, queue] = await Promise.all([getManagementDashboard(token), getEnhancedOperationsOrders(token)]); setData(dashboard); setOrders(queue); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load dashboard"); }
    finally { setBusy(false); }
  }, [token]);
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 15000); return () => window.clearInterval(id); }, [load]);
  const move = async (order: EnhancedOperationsOrder, status: EnhancedOperationsOrder["status"]) => { try { await updateOperationsOrder(token, order.id, status); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed"); } };
  return <div><Actions signOut={signOut} refresh={() => void load()} busy={busy}/>{error && <p className="rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Orders today", data?.orders_today ?? "—", "All channels"], ["Sales today", data ? money(data.sales_today) : "—", "Non-cancelled"], ["Active orders", data?.active_orders ?? "—", "Kitchen + rider"], ["Staff active", data?.staff_active ?? "—", `${data?.staff_on_shift ?? 0} scheduled/on shift`]].map(([label,value,note]) => <article key={String(label)} className={panel}><span className="text-xs text-lb-muted">{label}</span><strong className="mt-2 block text-3xl tracking-[-0.04em] text-lb-navy">{value}</strong><small className="mt-2 block text-lb-muted">{note}</small></article>)}</div>
    <section className={`${panel} mt-3`}><div className="mb-4 flex items-center justify-between"><div><span className={eyebrow}>Auto-refresh · 15 sec · Pakistan time</span><h2 className="m-0 mt-1 text-base font-black text-lb-navy">Live order command</h2></div><span className="rounded-full bg-[#eaf8f0] px-2.5 py-1 text-[10px] font-black text-lb-green">{orders.length} active</span></div>
      <div className="grid gap-2">{orders.map((order) => <article key={order.id} className={`${soft} grid gap-3 p-3.5 lg:grid-cols-[1fr_auto] lg:items-center`}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-lb-navy">LB #{order.order_number}</strong><span className="rounded-full bg-lb-blue/5 px-2 py-1 text-[9px] font-black uppercase text-lb-blue">{order.status.replaceAll("_", " ")}</span>{order.scheduled_for && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">Scheduled {restaurantDateTime(order.scheduled_for)} PKT</span>}</div><p className="mb-0 mt-1 text-[11px] text-lb-muted">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")} · {money(order.total)} · {order.fulfilment}</p></div><div className="flex flex-wrap gap-1.5">{order.status === "accepted" && <button className={primary} onClick={() => void move(order, "preparing")}>Start prep</button>}{order.status === "preparing" && <button className={primary} onClick={() => void move(order, "ready")}>Mark ready</button>}{order.status === "ready" && order.fulfilment === "delivery" && <Link href="/management/orders" className={`${primary} inline-flex items-center`}>Assign rider →</Link>}{order.status === "ready" && order.fulfilment === "pickup" && <button className={primary} onClick={() => void move(order, "delivered")}>Complete pickup</button>}{order.status === "out_for_delivery" && <button className={primary} onClick={() => void move(order, "delivered")}>Complete delivery</button>}</div></article>)}{!orders.length && <p className="text-xs text-lb-muted">No active orders.</p>}</div>
    </section></div>;
}

export function LiveManagementCustomersRetentionReviewed() {
  return <Boundary>{(token, signOut) => <CustomersRetention token={token} signOut={signOut}/>}</Boundary>;
}
function CustomersRetention({ token, signOut }: { token: string; signOut: () => void }) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [referrals, setReferrals] = useState<ReferralCodeRecord[]>([]);
  const [code, setCode] = useState(""); const [label, setLabel] = useState(""); const [maxUses, setMaxUses] = useState(""); const [validUntil, setValidUntil] = useState(""); const [rewardNote, setRewardNote] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setBusy(true); try { const [c,r] = await Promise.all([getManagementCustomers(token), getManagementReferralCodes(token)]); setCustomers(c); setReferrals(r); setMessage(""); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Customer data failed"); } finally { setBusy(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await upsertManagementReferralCode(token, { code, label, maxUses: maxUses ? Number(maxUses) : null, validUntil: validUntil || null, rewardNote: rewardNote || null }); setCode(""); setLabel(""); setMaxUses(""); setValidUntil(""); setRewardNote(""); await load(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Save failed"); } };
  return <div><Actions signOut={signOut} refresh={() => void load()} busy={busy}/>{message && <p className="rounded-[14px] bg-lb-blue/5 p-3 text-xs font-bold text-lb-muted">{message}</p>}<div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
    <section className={panel}><span className={eyebrow}>Customer CRM</span><h2 className="mt-1 text-base font-black text-lb-navy">Customer value and repeat behaviour</h2><div className="grid gap-2">{customers.map((customer) => <article key={customer.phone} className={`${soft} p-3.5`}><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm text-lb-navy">{customer.name || "Customer"}</strong><p className="mb-0 mt-1 text-[10px] text-lb-muted">{customer.phone} · Last order {restaurantDateTime(customer.last_order)} PKT</p></div><div className="text-right"><strong className="block text-sm text-lb-navy">{money(customer.revenue)}</strong><span className="text-[10px] text-lb-muted">{customer.orders} orders{customer.average_rating != null ? ` · ${customer.average_rating.toFixed(1)}★` : ""}</span></div></div></article>)}{!customers.length && <p className="text-xs text-lb-muted">CRM will populate from real customer orders.</p>}</div></section>
    <aside className="grid gap-3"><section className={panel}><span className={eyebrow}>Referral controls</span>{referrals.map((row) => <div key={row.code} className="border-b border-lb-navy/5 py-3"><strong className="text-xs text-lb-navy">{row.code} · {row.label}</strong><p className="mb-0 mt-1 text-[10px] text-lb-muted">{row.uses}{row.max_uses ? ` / ${row.max_uses}` : ""} uses · {row.status}{row.valid_until ? ` · until ${row.valid_until}` : ""}</p></div>)}{!referrals.length && <p className="text-xs text-lb-muted">No referral codes configured.</p>}</section><section className={panel}><form onSubmit={submit} className="grid gap-2"><input required className={field} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Referral code"/><input required className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Campaign / partner"/><input type="number" min="1" className={field} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Optional max uses"/><input type="date" className={field} value={validUntil} onChange={(e) => setValidUntil(e.target.value)}/><textarea className={`${field} min-h-20 py-3`} value={rewardNote} onChange={(e) => setRewardNote(e.target.value)} placeholder="Reward / campaign terms"/><button className={primary}>Save referral</button></form></section></aside>
  </div></div>;
}

export function LiveManagementAttendanceScheduleReviewed() {
  return <Boundary>{(token, signOut) => <AttendanceSchedule token={token} signOut={signOut}/>}</Boundary>;
}
function AttendanceSchedule({ token, signOut }: { token: string; signOut: () => void }) {
  const [date, setDate] = useState(restaurantDate);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<ManagementEmployee[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [employee, setEmployee] = useState(""); const [start, setStart] = useState("15:00"); const [end, setEnd] = useState("03:00"); const [station, setStation] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setBusy(true); try { const [a,s,r] = await Promise.all([getManagementAttendance(token,date),getManagementEmployees(token),getManagementShifts(token,date)]); setAttendance(a); setStaff(s); setShifts(r); setEmployee((current) => current || s[0]?.id || ""); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Attendance/schedule load failed"); } finally { setBusy(false); } }, [token,date]);
  useEffect(() => { void load(); }, [load]);
  const create = async (event: FormEvent) => { event.preventDefault(); try { await createManagementShift(token,{employeeId:employee,date,startsAt:start,endsAt:end,station}); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Shift save failed"); } };
  return <div><Actions signOut={signOut} refresh={() => void load()} busy={busy}/>{error && <p className="rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="mb-3 flex justify-end"><input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)}/></div><div className="grid gap-3 xl:grid-cols-2">
    <section className={panel}><span className={eyebrow}>Attendance · Asia/Karachi</span><h2 className="mt-1 text-base font-black text-lb-navy">Verified events · {date}</h2>{attendance.map((row) => <article key={row.id} className={`${soft} mb-2 flex items-center justify-between gap-3 p-3.5`}><div><strong className="text-sm text-lb-navy">{row.employee_name} · {row.employee_code}</strong><p className="mb-0 mt-1 text-[10px] text-lb-muted">{row.event_type.replaceAll("_"," ")} · {restaurantDateTime(row.occurred_at)} PKT{row.distance_meters != null ? ` · ${Math.round(row.distance_meters)}m` : ""}</p></div><span className="text-[9px] font-black uppercase text-lb-blue">{row.status || "recorded"}</span></article>)}{!attendance.length && <p className="text-xs text-lb-muted">No attendance events on this date.</p>}</section>
    <section className={panel}><span className={eyebrow}>Shift plan · Asia/Karachi</span><div className="mt-3 grid gap-2">{shifts.map((shift) => <article key={shift.id} className={`${soft} flex items-center justify-between gap-3 p-3.5`}><div><strong className="text-sm text-lb-navy">{shift.employee_name}</strong><p className="mb-0 mt-1 text-xs text-lb-muted">{shift.role} · {shift.station || "No station"}</p></div><strong className="text-xs text-lb-navy">{shift.starts_at.slice(0,5)} → {shift.ends_at.slice(0,5)}</strong></article>)}{!shifts.length && <p className="text-xs text-lb-muted">No shifts on this date.</p>}</div><form onSubmit={create} className="mt-5 grid gap-2 border-t border-lb-navy/10 pt-4"><select className={field} value={employee} onChange={(e) => setEmployee(e.target.value)}>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.employee_code}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="time" className={field} value={start} onChange={(e) => setStart(e.target.value)}/><input type="time" className={field} value={end} onChange={(e) => setEnd(e.target.value)}/></div><input className={field} value={station} onChange={(e) => setStation(e.target.value)} placeholder="Station"/><button className={primary} disabled={!employee}>Save shift</button></form></section>
  </div></div>;
}
