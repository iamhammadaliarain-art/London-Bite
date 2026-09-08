"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getManagementEmployees,
  getRiderJobs,
  lbSignIn,
  readStoredLbSession,
  storeLbSession,
  submitRiderDailySheet,
  updateRiderJob,
  type AuthSession,
  type ManagementEmployee,
} from "@/lib/lb-api";
import { createRiderLogin, RIDER_EMAIL_DOMAIN, riderEmailFromUsername } from "@/lib/rider-auth";
import type { RiderJob } from "@/lib/lb-route-api";

const panel="rounded-[28px] border border-white/75 bg-white/70 p-5 shadow-[0_18px_55px_rgba(7,24,47,0.07)] backdrop-blur-2xl";
const soft="rounded-[20px] border border-white/80 bg-white/60 backdrop-blur-xl";
const field="min-h-12 rounded-[14px] border border-lb-navy/10 bg-white/85 px-3 text-sm text-lb-ink outline-none focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const primary="min-h-12 rounded-[14px] bg-lb-navy px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40";
const secondary="min-h-12 rounded-[14px] border border-lb-navy/10 bg-white/80 px-4 text-xs font-black text-lb-navy disabled:cursor-not-allowed disabled:opacity-40";
const eyebrow="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue";

function SessionGate({ children }:{children:(session:AuthSession,signOut:()=>void)=>React.ReactNode}){
  const[session,setSessionState]=useState<AuthSession|null>(null);const[ready,setReady]=useState(false);
  useEffect(()=>{setSessionState(readStoredLbSession());setReady(true);},[]);
  const setSession=(next:AuthSession|null)=>{storeLbSession(next);setSessionState(next);};
  if(!ready)return <section className={panel}>Loading secure session…</section>;
  if(!session?.access_token)return <RiderLogin onSignedIn={setSession}/>;
  return <>{children(session,()=>setSession(null))}</>;
}

function RiderLogin({onSignedIn}:{onSignedIn:(session:AuthSession)=>void}){
  const[username,setUsername]=useState("");const[pin,setPin]=useState("");const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{onSignedIn(await lbSignIn(riderEmailFromUsername(username),pin));}catch(error){setMessage(error instanceof Error?error.message:"Invalid rider username or PIN");}finally{setBusy(false);}};
  return <section className={`mx-auto max-w-md ${panel}`}><span className={eyebrow}>London Bite · Rider</span><h1 className="mb-1 mt-1 text-2xl font-black text-lb-navy">Rider Login</h1><p className="m-0 text-xs leading-5 text-lb-muted">Username and PIN are created only by Management Hub.</p><form onSubmit={submit} className="mt-5 grid gap-3"><input className={field} required autoCapitalize="none" autoCorrect="off" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Rider username"/><input className={field} required inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="4–6 digit PIN"/><button className={primary} disabled={busy}>{busy?"Signing in…":"Enter Rider App"}</button></form>{message&&<p className="mt-4 rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{message}</p>}</section>;
}

function minutesBetween(start:string,end:string){return Math.max(0,Math.floor((new Date(end).getTime()-new Date(start).getTime())/60000));}

function OrderCard({job,token,onRefresh}:{job:RiderJob;token:string;onRefresh:()=>void}){
  const[busy,setBusy]=useState(false);const[seconds,setSeconds]=useState(0);
  useEffect(()=>{const id=window.setInterval(()=>setSeconds(v=>v+15),15000);return()=>window.clearInterval(id);},[]);
  const active=job.assignment_status==="picked_up"&&!job.delivered_at;
  const road=active&&job.picked_up_at?`${minutesBetween(job.picked_up_at,new Date().toISOString())} min`:job.delivered_at&&job.picked_up_at?`${minutesBetween(job.picked_up_at,job.delivered_at)} min`:"Not started";
  const action=async(status:"picked_up"|"delivered")=>{setBusy(true);try{await updateRiderJob(token,job.assignment_id,status);onRefresh();}catch(error){alert(error instanceof Error?error.message:"Could not update delivery");}finally{setBusy(false);}};
  return <article className={`${panel} ${active?"ring-2 ring-lb-blue/20":""}`}><div className="flex items-start justify-between gap-3"><div><span className={eyebrow}>Live delivery</span><h2 className="my-1 text-2xl font-black text-lb-navy">LB #{job.order_number}</h2><p className="m-0 text-xs text-lb-muted">{job.customer_name} · {job.customer_phone}</p></div><span className="rounded-full bg-lb-blue/5 px-3 py-1.5 text-[10px] font-black uppercase text-lb-blue">{active?"On road":job.assignment_status}</span></div><div className={`${soft} mt-4 p-4`}><strong className="text-xs text-lb-navy">Delivery address</strong><p className="mb-0 mt-1 text-sm leading-6 text-lb-muted">{job.delivery_address||"Address unavailable"}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><div className={`${soft} p-3`}><span className="text-[9px] font-black uppercase tracking-wider text-lb-muted">Bill</span><strong className="mt-1 block text-sm text-lb-navy">Rs {Math.round(Number(job.total)||0).toLocaleString("en-PK")}</strong></div><div className={`${soft} p-3`}><span className="text-[9px] font-black uppercase tracking-wider text-lb-muted">Road time</span><strong className="mt-1 block text-sm text-lb-navy">{road}</strong></div></div><div className="mt-4 flex gap-2">{job.assignment_status==="assigned"&&!job.delivered_at&&<button className={`${primary} flex-1`} disabled={busy} onClick={()=>void action("picked_up")}>{busy?"Updating…":"PICK UP & START"}</button>}{active&&<button className={`${primary} flex-1`} disabled={busy} onClick={()=>void action("delivered")}>{busy?"Saving…":"DELIVERED"}</button>}</div>{seconds>=0&&active&&<p className="mb-0 mt-3 text-center text-[10px] font-bold text-lb-muted">System timestamp is authoritative. Rider cannot edit it.</p>}</article>;
}

function RiderBody({token,signOut}:{token:string;signOut:()=>void}){
  const[jobs,setJobs]=useState<RiderJob[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[note,setNote]=useState("");const[sheetBusy,setSheetBusy]=useState(false);const[sheetDone,setSheetDone]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError("");try{setJobs(await getRiderJobs(token,false));}catch(error){setError(error instanceof Error?error.message:"Could not load live orders");}finally{setLoading(false);}},[token]);
  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(id);},[load]);
  const active=useMemo(()=>jobs.filter(j=>!j.delivered_at),[jobs]);
  const submit=async()=>{if(active.length){setError(`DAY CANNOT CLOSE — ${active.length} DELIVERY STILL ACTIVE`);return;}setSheetBusy(true);setError("");try{await submitRiderDailySheet(token,note);setSheetDone(true);}catch(error){setError(error instanceof Error?error.message:"Could not submit Rider Sheet");}finally{setSheetBusy(false);}};
  return <div><div className="mb-3 flex items-center justify-between gap-2"><div><span className={eyebrow}>Rider App</span><h2 className="m-0 text-xl font-black text-lb-navy">Live Orders</h2></div><div className="flex gap-2"><button className={secondary} onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button><button className={secondary} onClick={signOut}>Sign out</button></div></div>{error&&<p className="mb-3 rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="mb-3 grid gap-3 sm:grid-cols-3"><article className={panel}><span className="text-xs text-lb-muted">Live orders</span><strong className="mt-1 block text-3xl text-lb-navy">{active.length}</strong></article><article className={panel}><span className="text-xs text-lb-muted">Completed</span><strong className="mt-1 block text-3xl text-lb-navy">{jobs.filter(j=>j.delivered_at).length}</strong></article><article className={panel}><span className="text-xs text-lb-muted">Shift</span><strong className="mt-1 block text-sm uppercase text-lb-green">{sheetDone?"Ended":"Active"}</strong></article></div><div className="grid gap-3">{active.map(job=><OrderCard key={job.assignment_id} job={job} token={token} onRefresh={()=>void load()}/>)}{!active.length&&<section className={panel}><strong className="text-lb-navy">No live orders</strong><p className="mb-0 mt-1 text-xs text-lb-muted">New assigned deliveries will appear automatically.</p></section>}</div><section className={`${panel} mt-3`}><span className={eyebrow}>Shift end</span><h2 className="mb-1 mt-1 text-lg font-black text-lb-navy">Rider Sheet</h2><p className="mt-0 text-xs leading-5 text-lb-muted">Submit the Rider Sheet after all deliveries are completed. Management handles approval/rejection and bonus review.</p><textarea className={`${field} mt-2 min-h-24 w-full py-3`} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional shift note" disabled={sheetDone}/><button className={`${primary} mt-2 w-full`} disabled={sheetBusy||sheetDone||active.length>0} onClick={()=>void submit()}>{sheetDone?"RIDER SHEET SUBMITTED · SHIFT ENDED":active.length?`COMPLETE ${active.length} ACTIVE DELIVERY FIRST`:sheetBusy?"Submitting…":"SUBMIT RIDER SHEET & END SHIFT"}</button></section></div>;
}

export function RiderApp(){return <SessionGate>{(session,signOut)=><RiderBody token={session.access_token} signOut={signOut}/>}</SessionGate>;}

function ManagementLogin({onSignedIn}:{onSignedIn:(session:AuthSession)=>void}){
  const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{onSignedIn(await lbSignIn(email,password));}catch(error){setMessage(error instanceof Error?error.message:"Management sign in failed");}finally{setBusy(false);}};
  return <section className={`mx-auto max-w-md ${panel}`}><span className={eyebrow}>Management Hub</span><h2 className="mb-1 mt-1 text-2xl font-black text-lb-navy">Management Sign In</h2><form onSubmit={submit} className="mt-5 grid gap-3"><input className={field} required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Management email"/><input className={field} required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><button className={primary} disabled={busy}>{busy?"Checking…":"Sign in"}</button></form>{message&&<p className="mt-4 rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{message}</p>}</section>;
}

export function LiveManagementRiderAccess(){
  const[session,setSessionState]=useState<AuthSession|null>(null);const[ready,setReady]=useState(false);const[staff,setStaff]=useState<ManagementEmployee[]>([]);const[selected,setSelected]=useState("");const[username,setUsername]=useState("");const[pin,setPin]=useState("");const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);
  useEffect(()=>{setSessionState(readStoredLbSession());setReady(true);},[]);
  const load=useCallback(async()=>{if(!session?.access_token)return;try{const rows=await getManagementEmployees(session.access_token);setStaff(rows.filter(r=>r.status==="active"&&r.role.toLowerCase().includes("rider")));}catch(error){setMessage(error instanceof Error?error.message:"Could not load riders");}},[session]);
  useEffect(()=>{void load();},[load]);
  const signOut=()=>{storeLbSession(null);setSessionState(null);};
  if(!ready)return <section className={panel}>Loading secure session…</section>;
  if(!session?.access_token)return <ManagementLogin onSignedIn={s=>{storeLbSession(s);setSessionState(s);}}/>;
  const create=async(e:FormEvent)=>{e.preventDefault();if(!selected)return;setBusy(true);setMessage("");try{await createRiderLogin(session.access_token,selected,username,pin);setMessage(`Created rider login: ${username.trim().toLowerCase()}`);setUsername("");setPin("");await load();}catch(error){setMessage(error instanceof Error?error.message:"Could not create rider login");}finally{setBusy(false);}};
  return <div><div className="mb-3 flex justify-end"><button className={secondary} onClick={signOut}>Sign out</button></div><div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]"><section className={panel}><span className={eyebrow}>Management Hub · Rider Access</span><h2 className="mb-1 mt-1 text-xl font-black text-lb-navy">Create Rider Username + PIN</h2><p className="m-0 text-xs leading-5 text-lb-muted">Management creates the login. Rider cannot self-register.</p><form onSubmit={create} className="mt-4 grid gap-2"><select className={field} required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select active rider</option>{staff.map(r=><option key={r.id} value={r.id}>{r.name} · {r.employee_code}</option>)}</select><input className={field} required autoCapitalize="none" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,"").slice(0,24))} placeholder="Username e.g. zain"/><input className={field} required inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="4–6 digit PIN"/><button className={primary} disabled={busy||!selected||username.length<3||pin.length<4}>{busy?"Creating…":"Create Rider Login"}</button></form>{message&&<p className="mt-3 rounded-[14px] bg-lb-blue/5 p-3 text-xs font-bold text-lb-navy">{message}</p>}</section><section className={panel}><span className={eyebrow}>Current rider access</span><div className="mt-3 grid gap-2">{staff.map(r=><article key={r.id} className={`${soft} p-3.5`}><strong className="text-sm text-lb-navy">{r.name}</strong><p className="mb-0 mt-1 text-xs text-lb-muted">{r.employee_code} · {r.phone||"No phone"}</p><p className="mb-0 mt-1 text-[10px] font-bold text-lb-blue">{r.linked_user?.endsWith(`@${RIDER_EMAIL_DOMAIN}`)?r.linked_user.replace(`@${RIDER_EMAIL_DOMAIN}`,""):"Rider login not created"}</p></article>)}{!staff.length&&<p className="text-xs text-lb-muted">No active riders found.</p>}</div></section></div></div>;
}
