"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { completeLbPasswordReset, requestLbPasswordReset } from "@/lib/lb-v2-api";

const panel = "rounded-[30px] border border-white/80 bg-white/75 p-6 shadow-[0_18px_60px_rgba(7,24,47,0.09)] backdrop-blur-2xl sm:p-8";
const field = "min-h-12 rounded-[16px] border border-lb-navy/10 bg-white/85 px-4 text-sm text-lb-ink outline-none focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const primary = "min-h-12 rounded-[16px] bg-lb-navy px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40";

export function StaffPasswordReset() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [token,setToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
    const access=hash.get("access_token");
    const type=hash.get("type");
    if(access && type==="recovery") setToken(access);
  },[]);

  const request=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setMessage("");setError("");
    try{await requestLbPasswordReset(email,`${window.location.origin}/staff/reset-password`);setMessage("If that work email exists, a secure reset link has been sent.");}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not request reset");}
    finally{setBusy(false);}
  };

  const complete=async(e:FormEvent)=>{
    e.preventDefault();setMessage("");setError("");
    if(password.length<8){setError("Use at least 8 characters.");return;}
    if(password!==confirm){setError("Passwords do not match.");return;}
    setBusy(true);
    try{await completeLbPasswordReset(token,password);setMessage("Password updated. You can return to your London Bite workspace and sign in.");setPassword("");setConfirm("");window.history.replaceState({},"",window.location.pathname);}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not update password");}
    finally{setBusy(false);}
  };

  return <main className="grid min-h-screen place-items-center bg-[#f4f5f2] px-4 py-10 text-lb-ink"><section className={`w-full max-w-lg ${panel}`}><div className="mb-6 flex items-center gap-3"><span className="grid size-12 place-items-center overflow-hidden rounded-[15px] bg-white ring-1 ring-black/5"><img src="/brand/london-bite-logo.png" alt="London Bite" className="h-full w-full object-contain"/></span><div><span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue">Protected staff access</span><h1 className="m-0 text-xl font-black text-lb-navy">Reset password</h1></div></div>{token?<form className="grid gap-3" onSubmit={complete}><p className="m-0 text-xs leading-5 text-lb-muted">Set a new password for the account opened by your secure recovery link.</p><input required type="password" minLength={8} className={field} value={password} onChange={e=>setPassword(e.target.value)} placeholder="New password"/><input required type="password" minLength={8} className={field} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm new password"/><button className={primary} disabled={busy}>{busy?"Updating…":"Update password"}</button></form>:<form className="grid gap-3" onSubmit={request}><p className="m-0 text-xs leading-5 text-lb-muted">Enter the work email used for your London Bite login. Recovery links are issued by the authentication provider; the app never sees your old password.</p><input required type="email" className={field} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Work email"/><button className={primary} disabled={busy}>{busy?"Sending…":"Send reset link"}</button></form>}{message&&<p className="mt-4 rounded-[15px] bg-green-50 p-3 text-xs font-bold text-lb-green">{message}</p>}{error&&<p role="alert" className="mt-4 rounded-[15px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<Link href="/management/dashboard" className="mt-5 block text-center text-xs font-black text-lb-blue no-underline">Return to management</Link></section></main>;
}
