"use client";

import { useEffect, useMemo, useState } from "react";

type Payment={id:string;amount:number;date:string};
type Bill={id:string;vendor:string;amount:number;date:string;payments:Payment[]};
const money=(n:number)=>`Rs. ${Math.round(n).toLocaleString()}`;
const today=()=>new Date().toISOString().slice(0,10);

export default function PayablesPage(){
 const [bills,setBills]=useState<Bill[]>([]); const [ready,setReady]=useState(false); const [view,setView]=useState<"home"|"add"|"vendor">("home");
 const [vendor,setVendor]=useState(""); const [amount,setAmount]=useState(""); const [date,setDate]=useState(today()); const [selected,setSelected]=useState(""); const [query,setQuery]=useState("");
 useEffect(()=>{try{setBills(JSON.parse(localStorage.getItem("lb-payables")||"[]"))}catch{} setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem("lb-payables",JSON.stringify(bills))},[bills,ready]);
 const paid=(b:Bill)=>b.payments.reduce((s,p)=>s+p.amount,0); const balance=(b:Bill)=>Math.max(0,b.amount-paid(b));
 const total=bills.reduce((s,b)=>s+b.amount,0), totalPaid=bills.reduce((s,b)=>s+paid(b),0), pending=Math.max(0,total-totalPaid);
 const vendors=useMemo(()=>Array.from(new Set(bills.map(b=>b.vendor))).filter(v=>v.toLowerCase().includes(query.toLowerCase())),[bills,query]);
 function addBill(e:React.FormEvent){e.preventDefault(); const n=Number(amount); if(!vendor.trim()||!n)return; setBills(x=>[{id:crypto.randomUUID(),vendor:vendor.trim(),amount:n,date,payments:[]},...x]);setVendor("");setAmount("");setDate(today());setView("home")}
 function payBill(id:string){const b=bills.find(x=>x.id===id);if(!b)return; const raw=window.prompt(`Payment amount (remaining ${money(balance(b))})`); if(!raw)return; const n=Math.min(Number(raw),balance(b));if(!n||n<0)return; const d=window.prompt("Payment date (YYYY-MM-DD)",today())||today();setBills(x=>x.map(y=>y.id===id?{...y,payments:[...y.payments,{id:crypto.randomUUID(),amount:n,date:d}]}:y))}
 const vb=bills.filter(b=>b.vendor===selected), vbTotal=vb.reduce((s,b)=>s+b.amount,0), vbPaid=vb.reduce((s,b)=>s+paid(b),0);
 return <main className="min-h-screen bg-[#f5f6f8] text-[#111827] pb-24">
  <header className="bg-white border-b px-5 py-4 sticky top-0 z-10"><div className="max-w-md mx-auto flex items-center gap-3"><img src="/brand/london-bite-logo.png" alt="London Bite" className="w-12 h-12 object-contain"/><div><h1 className="font-extrabold text-lg leading-tight">London Bite Payables</h1><p className="text-xs text-gray-500">Supplier Khata</p></div></div></header>
  <section className="max-w-md mx-auto p-4">
  {view==="home"&&<><div className="grid grid-cols-2 gap-3 mb-4"><Card label="Pending" value={money(pending)}/><Card label="Paid" value={money(totalPaid)}/></div>
   <button onClick={()=>setView("add")} className="w-full bg-[#172554] text-white rounded-2xl py-4 font-bold text-base mb-4">+ Add Bill</button>
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search vendor" className="w-full bg-white border rounded-xl px-4 py-3 mb-3 outline-none"/>
   <div className="space-y-2">{vendors.map(v=>{const bs=bills.filter(b=>b.vendor===v),t=bs.reduce((s,b)=>s+b.amount,0),p=bs.reduce((s,b)=>s+paid(b),0);return <button key={v} onClick={()=>{setSelected(v);setView("vendor")}} className="w-full bg-white border rounded-2xl p-4 text-left flex justify-between items-center"><div><div className="font-bold">{v}</div><div className="text-xs text-gray-500">{bs.length} bill{bs.length!==1?"s":""}</div></div><div className="text-right"><div className="font-extrabold">{money(t-p)}</div><div className="text-xs text-gray-500">remaining ›</div></div></button>})}{vendors.length===0&&<div className="text-center text-gray-400 py-12">No vendor bills yet.</div>}</div></>}
  {view==="add"&&<><button onClick={()=>setView("home")} className="mb-4 text-sm font-bold">‹ Back</button><h2 className="text-2xl font-extrabold mb-5">Add Bill</h2><form onSubmit={addBill} className="space-y-4"><Field label="Vendor"><input value={vendor} onChange={e=>setVendor(e.target.value)} placeholder="e.g. Dawn Bread" required className="field"/></Field><Field label="Bill Amount"><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric" placeholder="0" required className="field"/></Field><Field label="Bill Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="field"/></Field><button className="w-full bg-[#172554] text-white rounded-2xl py-4 font-bold">Save Bill</button></form></>}
  {view==="vendor"&&<><button onClick={()=>setView("home")} className="mb-4 text-sm font-bold">‹ Back</button><h2 className="text-2xl font-extrabold">{selected}</h2><div className="flex gap-4 text-sm mt-2 mb-5"><span>Bill <b>{money(vbTotal)}</b></span><span>Paid <b>{money(vbPaid)}</b></span></div><div className="space-y-3">{vb.map(b=>{const rem=balance(b);return <div key={b.id} className="bg-white border rounded-2xl p-4"><div className="flex justify-between"><div><div className="text-xs text-gray-500">{b.date}</div><div className="font-extrabold text-lg">{money(b.amount)}</div></div><div className="text-right"><span className={`text-xs font-bold px-2 py-1 rounded-full ${rem===0?"bg-green-100 text-green-700":paid(b)>0?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>{rem===0?"CLEARED":paid(b)>0?"PARTIAL":"PENDING"}</span><div className="text-sm mt-2">Remaining <b>{money(rem)}</b></div></div></div>{b.payments.length>0&&<div className="mt-3 pt-3 border-t space-y-1">{b.payments.map(p=><div key={p.id} className="flex justify-between text-sm"><span>{p.date}</span><b>Paid {money(p.amount)}</b></div>)}</div>}{rem>0&&<button onClick={()=>payBill(b.id)} className="mt-3 w-full border border-[#172554] text-[#172554] rounded-xl py-2.5 font-bold">+ Add Payment</button>}</div>})}</div></>}
  </section><style jsx global>{`.field{width:100%;background:white;border:1px solid #d1d5db;border-radius:12px;padding:14px 16px;outline:none}.field:focus{border-color:#172554}`}</style>
 </main>
}
function Card({label,value}:{label:string,value:string}){return <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-gray-500 mb-1">{label}</div><div className="font-extrabold text-xl">{value}</div></div>}
function Field({label,children}:{label:string,children:React.ReactNode}){return <label className="block"><span className="block text-sm font-bold mb-1.5">{label}</span>{children}</label>}
