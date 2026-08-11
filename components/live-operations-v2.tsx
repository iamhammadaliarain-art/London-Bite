"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import {
  adjustManagementInventory,
  getManagementAnalytics,
  getManagementInventory,
  getManagementShifts,
  updateOperationsOrder,
  type AnalyticsSummary,
  type InventoryRecord,
  type ShiftRecord,
} from "@/lib/lb-operations-api";
import {
  getEnhancedOperationsOrders,
  getManagementIntelligence,
  getManagementRecipes,
  getManagementReferralCodes,
  upsertManagementRecipe,
  upsertManagementReferralCode,
  type EnhancedOperationsOrder,
  type ManagementIntelligence,
  type RecipeRecord,
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

function useSession() {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    if (accessToken) {
      const next: AuthSession = { access_token: accessToken, refresh_token: hash.get("refresh_token") ?? undefined, expires_in: Number(hash.get("expires_in") ?? 3600) };
      storeLbSession(next); setSessionState(next); window.history.replaceState({}, "", window.location.pathname + window.location.search);
    } else setSessionState(readStoredLbSession());
    setReady(true);
  }, []);
  const setSession = (next: AuthSession | null) => { storeLbSession(next); setSessionState(next); };
  return { session, setSession, ready };
}

function LoginPanel({ onSignedIn }: { onSignedIn: (session: AuthSession) => void }) {
  const [email,setEmail]=useState("");const[password,setPassword]=useState("");const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{onSignedIn(await lbSignIn(email,password));}catch(cause){setMessage(cause instanceof Error?cause.message:"Sign in failed");}finally{setBusy(false);}};
  const google=()=>{const redirect=`${window.location.origin}${window.location.pathname}${window.location.search}`;window.location.href=`${LB_SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;};
  return <section className={`mx-auto max-w-xl ${panel}`}><span className={eyebrow}>Protected management</span><h2 className="mb-2 mt-1 text-2xl font-black text-lb-navy">London Bite management sign in</h2><p className="mt-0 text-xs leading-5 text-lb-muted">Operational data remains role-scoped behind Supabase authentication.</p><form onSubmit={submit} className="mt-5 grid gap-3"><input required type="email" className={field} value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Work email"/><input required type="password" minLength={6} className={field} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password"/><button className={primary} disabled={busy}>{busy?"Checking…":"Sign in"}</button></form><button type="button" className={`${secondary} mt-2 w-full`} onClick={google}>Continue with Google</button><Link href="/staff/reset-password" className="mt-4 block text-center text-xs font-black text-lb-blue no-underline">Forgot password?</Link>{message&&<p className="mt-4 rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{message}</p>}</section>;
}

function Boundary({ children }: { children: (token: string, signOut: () => void) => ReactNode }) {
  const {session,setSession,ready}=useSession();
  if(!ready)return <section className={panel}>Loading secure session…</section>;
  if(!session?.access_token)return <LoginPanel onSignedIn={setSession}/>;
  return <>{children(session.access_token,()=>setSession(null))}</>;
}
function Actions({signOut,refresh,busy}:{signOut:()=>void;refresh:()=>void;busy?:boolean}){return <div className="mb-3 flex flex-wrap justify-end gap-2"><button type="button" className={secondary} onClick={refresh} disabled={busy}>Refresh live data</button><button type="button" className={secondary} onClick={signOut}>Sign out</button></div>;}

export function LiveManagementDashboardV2(){return <Boundary>{(token,signOut)=><Dashboard token={token} signOut={signOut}/>}</Boundary>;}
function Dashboard({token,signOut}:{token:string;signOut:()=>void}){
  const[data,setData]=useState<ManagementDashboardData|null>(null);const[orders,setOrders]=useState<EnhancedOperationsOrder[]>([]);const[error,setError]=useState("");const[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setBusy(true);setError("");try{const[d,o]=await Promise.all([getManagementDashboard(token),getEnhancedOperationsOrders(token)]);setData(d);setOrders(o);}catch(cause){setError(cause instanceof Error?cause.message:"Could not load dashboard");}finally{setBusy(false);}},[token]);
  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(id);},[load]);
  const move=async(order:EnhancedOperationsOrder,status:EnhancedOperationsOrder["status"])=>{try{await updateOperationsOrder(token,order.id,status);await load();}catch(cause){setError(cause instanceof Error?cause.message:"Update failed");}};
  return <div><Actions signOut={signOut} refresh={()=>void load()} busy={busy}/>{error&&<p className="rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Orders today",data?.orders_today??"—","All channels"],["Sales today",data?money(data.sales_today):"—","Non-cancelled"],["Active orders",data?.active_orders??"—","Kitchen + rider"],["Staff active",data?.staff_active??"—",`${data?.staff_on_shift??0} scheduled/on shift`]].map(([label,value,note])=><article key={String(label)} className={panel}><span className="text-xs text-lb-muted">{label}</span><strong className="mt-2 block text-3xl tracking-[-0.04em] text-lb-navy">{value}</strong><small className="mt-2 block text-lb-muted">{note}</small></article>)}</div><section className={`${panel} mt-3`}><div className="mb-4 flex items-center justify-between"><div><span className={eyebrow}>Auto-refresh · 15 sec</span><h2 className="m-0 mt-1 text-base font-black text-lb-navy">Live order command</h2></div><span className="rounded-full bg-[#eaf8f0] px-2.5 py-1 text-[10px] font-black text-lb-green">{orders.length} active</span></div><div className="grid gap-2">{orders.map(order=><article key={order.id} className={`${soft} grid gap-3 p-3.5 lg:grid-cols-[1fr_auto] lg:items-center`}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-lb-navy">LB #{order.order_number}</strong><span className="rounded-full bg-lb-blue/5 px-2 py-1 text-[9px] font-black uppercase text-lb-blue">{order.status.replaceAll("_"," ")}</span>{order.scheduled_for&&<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">Scheduled {new Date(order.scheduled_for).toLocaleString()}</span>}</div><p className="mb-0 mt-1 text-[11px] text-lb-muted">{order.items.map(item=>`${item.quantity}× ${item.name}`).join(" · ")} · {money(order.total)} · {order.fulfilment}</p></div><div className="flex flex-wrap gap-1.5">{order.status==="accepted"&&<button className={primary} onClick={()=>void move(order,"preparing")}>Start prep</button>}{order.status==="preparing"&&<button className={primary} onClick={()=>void move(order,"ready")}>Mark ready</button>}{order.status==="ready"&&order.fulfilment==="delivery"&&<Link href="/management/orders" className={`${primary} inline-flex items-center`}>Assign rider →</Link>}{order.status==="ready"&&order.fulfilment==="pickup"&&<button className={primary} onClick={()=>void move(order,"delivered")}>Complete pickup</button>}{order.status==="out_for_delivery"&&<button className={primary} onClick={()=>void move(order,"delivered")}>Complete delivery</button>}</div></article>)}{!orders.length&&<p className="text-xs text-lb-muted">No active orders.</p>}</div></section></div>;
}

export function LiveManagementScheduleV2(){return <Boundary>{(token,signOut)=><Schedule token={token} signOut={signOut}/>}</Boundary>;}
function Schedule({token,signOut}:{token:string;signOut:()=>void}){
  const[staff,setStaff]=useState<ManagementEmployee[]>([]);const[shifts,setShifts]=useState<ShiftRecord[]>([]);const[employee,setEmployee]=useState("");const[date,setDate]=useState(restaurantDate);const[start,setStart]=useState("15:00");const[end,setEnd]=useState("03:00");const[station,setStation]=useState("");const[error,setError]=useState("");
  const load=useCallback(async()=>{try{const[s,r]=await Promise.all([getManagementEmployees(token),getManagementShifts(token,date)]);setStaff(s);setShifts(r);setEmployee(current=>current||s[0]?.id||"");setError("");}catch(cause){setError(cause instanceof Error?cause.message:"Schedule load failed");}},[token,date]);useEffect(()=>{void load();},[load]);
  const create=async(e:FormEvent)=>{e.preventDefault();try{await createManagementShift(token,{employeeId:employee,date,startsAt:start,endsAt:end,station});await load();}catch(cause){setError(cause instanceof Error?cause.message:"Shift save failed");}};
  return <div><Actions signOut={signOut} refresh={()=>void load()}/>{error&&<p className="rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]"><section className={panel}><span className={eyebrow}>Asia/Karachi</span><h2 className="mb-4 mt-1 text-base font-black text-lb-navy">Shift plan · {date}</h2><div className="grid gap-2">{shifts.map(shift=><article key={shift.id} className={`${soft} flex items-center justify-between gap-3 p-3.5`}><div><strong className="text-sm text-lb-navy">{shift.employee_name}</strong><p className="mb-0 mt-1 text-xs text-lb-muted">{shift.role} · {shift.station||"No station"}</p></div><strong className="text-xs text-lb-navy">{shift.starts_at.slice(0,5)} → {shift.ends_at.slice(0,5)}</strong></article>)}{!shifts.length&&<p className="text-xs text-lb-muted">No shifts on this date.</p>}</div></section><aside className={panel}><form onSubmit={create} className="grid gap-2"><input type="date" className={field} value={date} onChange={e=>setDate(e.target.value)}/><select className={field} value={employee} onChange={e=>setEmployee(e.target.value)}>{staff.map(member=><option key={member.id} value={member.id}>{member.name} · {member.employee_code}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="time" className={field} value={start} onChange={e=>setStart(e.target.value)}/><input type="time" className={field} value={end} onChange={e=>setEnd(e.target.value)}/></div><input className={field} value={station} onChange={e=>setStation(e.target.value)} placeholder="Station"/><button className={primary} disabled={!employee}>Save shift</button></form></aside></div></div>;
}

export function LiveManagementAnalyticsV2(){return <Boundary>{(token,signOut)=><Analytics token={token} signOut={signOut}/>}</Boundary>;}
function Analytics({token,signOut}:{token:string;signOut:()=>void}){
  const[summary,setSummary]=useState<AnalyticsSummary|null>(null);const[intel,setIntel]=useState<ManagementIntelligence|null>(null);const[days,setDays]=useState(30);const[error,setError]=useState("");
  const load=useCallback(async()=>{try{const[a,i]=await Promise.all([getManagementAnalytics(token,days),getManagementIntelligence(token,days)]);setSummary(a);setIntel(i);setError("");}catch(cause){setError(cause instanceof Error?cause.message:"Analytics load failed");}},[token,days]);useEffect(()=>{void load();},[load]);
  const peak=useMemo(()=>intel?.demand_hours?.slice().sort((a,b)=>b.orders-a.orders)[0]??null,[intel]);
  return <div><Actions signOut={signOut} refresh={()=>void load()}/>{error&&<p className="rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="mb-3 flex justify-end"><select className={field} value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Orders",summary?.orders??0],["Revenue",money(summary?.revenue??0)],["Repeat customers",intel?.repeat_customers??0],["Peak hour",peak?`${String(peak.hour).padStart(2,"0")}:00` : "—"]].map(([label,value])=><article key={String(label)} className={panel}><span className="text-xs text-lb-muted">{label}</span><strong className="mt-2 block text-3xl text-lb-navy">{value}</strong></article>)}</div><div className="mt-3 grid gap-3 xl:grid-cols-2"><section className={panel}><span className={eyebrow}>Menu intelligence</span><h2 className="mt-1 text-base font-black text-lb-navy">Top products</h2>{intel?.top_products?.length?intel.top_products.map(row=><div key={row.name} className="flex justify-between border-b border-lb-navy/5 py-3 text-xs"><span>{row.name}</span><strong>{row.units} units · {money(row.revenue)}</strong></div>):<p className="text-xs text-lb-muted">Sales data will populate after real orders.</p>}</section><section className={panel}><span className={eyebrow}>Operations</span><h2 className="mt-1 text-base font-black text-lb-navy">Fulfilment evidence</h2><div className="grid grid-cols-2 gap-2"><div className={`${soft} p-3`}><span className="text-[10px] text-lb-muted">Avg prep</span><strong className="block text-lg text-lb-navy">{intel?.avg_prep_minutes??"—"} min</strong></div><div className={`${soft} p-3`}><span className="text-[10px] text-lb-muted">Avg delivery</span><strong className="block text-lg text-lb-navy">{intel?.avg_delivery_minutes??"—"} min</strong></div><div className={`${soft} p-3`}><span className="text-[10px] text-lb-muted">Scheduled upcoming</span><strong className="block text-lg text-lb-navy">{intel?.scheduled_orders??0}</strong></div><div className={`${soft} p-3`}><span className="text-[10px] text-lb-muted">Referral orders</span><strong className="block text-lg text-lb-navy">{intel?.referral_orders??0}</strong></div></div></section></div></div>;
}

export function LiveManagementInventoryV2(){return <Boundary>{(token,signOut)=><Inventory token={token} signOut={signOut}/>}</Boundary>;}
function Inventory({token,signOut}:{token:string;signOut:()=>void}){
  const[items,setItems]=useState<InventoryRecord[]>([]);const[recipes,setRecipes]=useState<RecipeRecord[]>([]);const[error,setError]=useState("");const[name,setName]=useState("");const[qty,setQty]=useState(0);const[unit,setUnit]=useState("unit");const[reason,setReason]=useState("Stock count");const[minimum,setMinimum]=useState(0);const[cost,setCost]=useState(0);const[menuSlug,setMenuSlug]=useState("");const[inventoryId,setInventoryId]=useState("");const[recipeQty,setRecipeQty]=useState(1);
  const load=useCallback(async()=>{try{const[i,r]=await Promise.all([getManagementInventory(token),getManagementRecipes(token)]);setItems(i);setRecipes(r);setInventoryId(current=>current||i[0]?.id||"");setError("");}catch(cause){setError(cause instanceof Error?cause.message:"Inventory load failed");}},[token]);useEffect(()=>{void load();},[load]);
  const saveStock=async(e:FormEvent)=>{e.preventDefault();try{await adjustManagementInventory(token,{name,unit,quantityChange:qty,reason,minimum,unitCost:cost});setName("");setQty(0);await load();}catch(cause){setError(cause instanceof Error?cause.message:"Inventory update failed");}};
  const saveRecipe=async(e:FormEvent)=>{e.preventDefault();try{await upsertManagementRecipe(token,{menuSlug:menuSlug.trim(),inventoryItemId:inventoryId,quantityPerUnit:recipeQty});setMenuSlug("");await load();}catch(cause){setError(cause instanceof Error?cause.message:"Recipe save failed");}};
  return <div><Actions signOut={signOut} refresh={()=>void load()}/>{error&&<p className="rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="grid gap-3 xl:grid-cols-[1.25fr_0.75fr]"><section className={panel}><span className={eyebrow}>Stock + recipe BOM</span><h2 className="mt-1 text-base font-black text-lb-navy">Inventory control</h2><div className="grid gap-2 sm:grid-cols-2">{items.map(item=><article key={item.id} className={`${soft} p-3.5`}><div className="flex justify-between gap-3"><strong className="text-sm text-lb-navy">{item.name}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.status==="reorder"?"bg-red-50 text-lb-red":"bg-green-50 text-lb-green"}`}>{item.status}</span></div><strong className="mt-3 block text-2xl text-lb-navy">{item.current_quantity} <small className="text-xs text-lb-muted">{item.unit}</small></strong><span className="text-[10px] text-lb-muted">Threshold {item.minimum_threshold} · {money(item.unit_cost)}</span></article>)}{!items.length&&<p className="text-xs text-lb-muted">No real stock has been loaded yet. Recipe automation remains inactive until inventory exists.</p>}</div><div className="mt-5 border-t border-lb-navy/10 pt-4"><h3 className="text-sm font-black text-lb-navy">Recipe consumption rules</h3>{recipes.map(row=><div key={row.id} className="flex justify-between border-b border-lb-navy/5 py-2 text-xs"><span>{row.menu_name} → {row.inventory_name}</span><strong>{row.quantity_per_unit} {row.inventory_unit} / item</strong></div>)}{!recipes.length&&<p className="text-xs text-lb-muted">No recipes configured. Once configured, stock is deducted idempotently when preparation starts.</p>}</div></section><aside className="grid gap-3"><section className={panel}><span className={eyebrow}>Stock movement</span><form onSubmit={saveStock} className="mt-3 grid gap-2"><input required className={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Item name"/><div className="grid grid-cols-2 gap-2"><input type="number" step="0.001" className={field} value={qty} onChange={e=>setQty(Number(e.target.value))}/><input className={field} value={unit} onChange={e=>setUnit(e.target.value)} /></div><input className={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason"/><div className="grid grid-cols-2 gap-2"><input type="number" className={field} value={minimum} onChange={e=>setMinimum(Number(e.target.value))}/><input type="number" className={field} value={cost} onChange={e=>setCost(Number(e.target.value))}/></div><button className={primary}>Record movement</button></form></section><section className={panel}><span className={eyebrow}>Recipe rule</span><form onSubmit={saveRecipe} className="mt-3 grid gap-2"><input required className={field} value={menuSlug} onChange={e=>setMenuSlug(e.target.value)} placeholder="Menu slug, e.g. fillet-burger"/><select required className={field} value={inventoryId} onChange={e=>setInventoryId(e.target.value)}><option value="">Select inventory item</option>{items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}</select><input required type="number" min="0.001" step="0.001" className={field} value={recipeQty} onChange={e=>setRecipeQty(Number(e.target.value))}/><button className={primary} disabled={!inventoryId}>Save recipe</button></form></section></aside></div></div>;
}

export function LiveRetentionControlV2(){return <Boundary>{(token,signOut)=><Retention token={token} signOut={signOut}/>}</Boundary>;}
function Retention({token,signOut}:{token:string;signOut:()=>void}){
  const[rows,setRows]=useState<ReferralCodeRecord[]>([]);const[code,setCode]=useState("");const[label,setLabel]=useState("");const[maxUses,setMaxUses]=useState("");const[validUntil,setValidUntil]=useState("");const[rewardNote,setRewardNote]=useState("");const[message,setMessage]=useState("");
  const load=useCallback(async()=>{try{setRows(await getManagementReferralCodes(token));setMessage("");}catch(cause){setMessage(cause instanceof Error?cause.message:"Referral data failed");}},[token]);useEffect(()=>{void load();},[load]);
  const submit=async(e:FormEvent)=>{e.preventDefault();try{await upsertManagementReferralCode(token,{code,label,maxUses:maxUses?Number(maxUses):null,validUntil:validUntil||null,rewardNote:rewardNote||null});setCode("");setLabel("");setMaxUses("");setValidUntil("");setRewardNote("");await load();}catch(cause){setMessage(cause instanceof Error?cause.message:"Save failed");}};
  return <div><Actions signOut={signOut} refresh={()=>void load()}/>{message&&<p className="rounded-[14px] bg-lb-blue/5 p-3 text-xs font-bold text-lb-muted">{message}</p>}<div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]"><section className={panel}><span className={eyebrow}>Retention</span><h2 className="mt-1 text-base font-black text-lb-navy">Referral attribution</h2>{rows.map(row=><article key={row.code} className={`${soft} mb-2 flex items-center justify-between gap-3 p-3.5`}><div><strong className="text-sm text-lb-navy">{row.code} · {row.label}</strong><p className="mb-0 mt-1 text-[10px] text-lb-muted">{row.uses}{row.max_uses?` / ${row.max_uses}`:""} uses · {row.status}{row.valid_until?` · until ${row.valid_until}`:""}</p></div><span className="rounded-full bg-lb-blue/5 px-2 py-1 text-[9px] font-black uppercase text-lb-blue">?ref={row.code}</span></article>)}{!rows.length&&<p className="text-xs text-lb-muted">No referral codes configured yet. The customer app already captures and validates `?ref=CODE` when a code exists.</p>}</section><aside className={panel}><form onSubmit={submit} className="grid gap-2"><input required className={field} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Code"/><input required className={field} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Campaign / partner label"/><input type="number" min="1" className={field} value={maxUses} onChange={e=>setMaxUses(e.target.value)} placeholder="Optional max uses"/><input type="date" className={field} value={validUntil} onChange={e=>setValidUntil(e.target.value)}/><textarea className={`${field} min-h-20 py-3`} value={rewardNote} onChange={e=>setRewardNote(e.target.value)} placeholder="Reward note / campaign terms"/><button className={primary}>Save referral code</button></form></aside></div></div>;
}
