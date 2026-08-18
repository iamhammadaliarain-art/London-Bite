"use client";

import Image from "next/image";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { customerProducts, money } from "@/lib/customer-commerce";
import { getLiveMenu, type LiveProduct } from "@/lib/lb-api";
import {
  createCounterOperationalOrder,
  type CounterOrderChannel,
  type CounterOrderCreated,
  type CounterPaymentState,
} from "@/lib/lb-growth-api";
import { Secure } from "@/components/live-growth-performance";

const glass="rounded-[26px] border border-white/75 bg-white/72 shadow-[0_20px_65px_rgba(0,0,0,0.18)] backdrop-blur-2xl";
const soft="rounded-[18px] border border-lb-navy/10 bg-white/72 backdrop-blur-xl";
const field="min-h-12 w-full rounded-[15px] border border-lb-navy/10 bg-white/88 px-3.5 text-sm text-lb-ink outline-none transition focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const primary="min-h-12 rounded-[15px] bg-lb-red px-4 text-xs font-black text-white shadow-[0_12px_25px_rgba(255,31,40,0.24)] transition hover:bg-[#e91620] disabled:cursor-not-allowed disabled:opacity-40";
const secondary="min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/78 px-3.5 text-xs font-black text-lb-navy transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const imageBySlug=new Map(customerProducts.map((item)=>[item.slug,item.image]));

type PaymentChoice="paid_now"|"pay_later"|"cod";
type CartLine={item:LiveProduct;quantity:number};

const channelOptions:{value:CounterOrderChannel;label:string;detail:string;mark:string}[]=[
  {value:"dine_in",label:"Dine-in",detail:"Serve to a table",mark:"01"},
  {value:"pickup",label:"Takeaway",detail:"Pack for collection",mark:"02"},
  {value:"delivery",label:"Delivery",detail:"Send to customer",mark:"03"},
];

function productImage(item:LiveProduct){
  if(item.image_url)return item.image_url;
  return imageBySlug.get(item.slug)??"/brand/london-bite-official.svg";
}

function completeness(channel:CounterOrderChannel,lines:CartLine[],table:string,pickupName:string,name:string,phone:string,address:string,payment:PaymentChoice){
  const destination=channel==="dine_in"?Boolean(table.trim()):channel==="pickup"?Boolean(pickupName.trim()):Boolean(name.trim()&&phone.replace(/\D/g,"").length>=10&&address.trim().length>=8);
  return [true,lines.length>0,destination,Boolean(payment)];
}

export function LiveCounterOrderTaking(){
  return <Secure title="Counter order-taking sign in">{(session,signOut)=><CounterOrderTakingBody token={session.access_token} signOut={signOut}/>}</Secure>;
}

function CounterOrderTakingBody({token,signOut}:{token:string;signOut:()=>void}){
  const[menu,setMenu]=useState<LiveProduct[]>([]);
  const[cart,setCart]=useState<Record<string,number>>({});
  const[channel,setChannel]=useState<CounterOrderChannel>("dine_in");
  const[category,setCategory]=useState("All");
  const[query,setQuery]=useState("");
  const deferredQuery=useDeferredValue(query);
  const[customerName,setCustomerName]=useState("");
  const[phone,setPhone]=useState("");
  const[tableIdentifier,setTableIdentifier]=useState("");
  const[pickupName,setPickupName]=useState("");
  const[address,setAddress]=useState("");
  const[notes,setNotes]=useState("");
  const[paymentChoice,setPaymentChoice]=useState<PaymentChoice>("pay_later");
  const[paymentMethod,setPaymentMethod]=useState<"cash"|"online">("cash");
  const[reviewing,setReviewing]=useState(false);
  const[busy,setBusy]=useState(false);
  const[loading,setLoading]=useState(true);
  const[message,setMessage]=useState("");
  const[created,setCreated]=useState<CounterOrderCreated|null>(null);
  const searchRef=useRef<HTMLInputElement>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const items=(await getLiveMenu()).filter((item)=>item.is_available);
      setMenu(items);
      setMessage(items.length?"":"No menu items are currently available.");
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:"Menu could not be loaded.");
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="/"&&document.activeElement?.tagName!=="INPUT"&&document.activeElement?.tagName!=="TEXTAREA"){
        event.preventDefault();searchRef.current?.focus();
      }
      if(event.key==="Escape")setReviewing(false);
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[]);
  useEffect(()=>{
    setPaymentChoice(channel==="delivery"?"cod":"pay_later");
    setPaymentMethod("cash");
  },[channel]);

  const lines=useMemo<CartLine[]>(()=>menu.filter((item)=>(cart[item.slug]??0)>0).map((item)=>({item,quantity:cart[item.slug]})),[menu,cart]);
  const subtotal=useMemo(()=>lines.reduce((sum,line)=>sum+Number(line.item.price)*line.quantity,0),[lines]);
  const itemCount=useMemo(()=>lines.reduce((sum,line)=>sum+line.quantity,0),[lines]);
  const categories=useMemo(()=>["All",...Array.from(new Set(menu.map((item)=>item.category)))],[menu]);
  const filtered=useMemo(()=>menu.filter((item)=>{
    const matchesCategory=category==="All"||item.category===category;
    const normalized=deferredQuery.trim().toLowerCase();
    return matchesCategory&&(!normalized||`${item.name} ${item.category} ${item.badge??""}`.toLowerCase().includes(normalized));
  }),[menu,category,deferredQuery]);
  const checks=completeness(channel,lines,tableIdentifier,pickupName,customerName,phone,address,paymentChoice);
  const readyToReview=checks.every(Boolean);

  const setQuantity=(slug:string,next:number)=>setCart((current)=>{
    const copy={...current};
    if(next<=0)delete copy[slug];else copy[slug]=Math.min(50,next);
    return copy;
  });
  const clearOrder=()=>{
    setCart({});setCustomerName("");setPhone("");setTableIdentifier("");setPickupName("");setAddress("");setNotes("");setCreated(null);setReviewing(false);
    setPaymentChoice(channel==="delivery"?"cod":"pay_later");setPaymentMethod("cash");
  };
  const submit=async()=>{
    if(!readyToReview||busy)return;
    setBusy(true);setMessage("");
    const paymentStatus:CounterPaymentState=paymentChoice==="paid_now"?"paid":paymentChoice==="cod"?"cash_due":"pending";
    try{
      const result=await createCounterOperationalOrder(token,{
        name:customerName||pickupName||"Walk-in customer",phone,channel,tableIdentifier,pickupName,deliveryAddress:address,
        paymentMethod:paymentChoice==="paid_now"?paymentMethod:"cash",paymentStatus,notes,
        items:lines.map((line)=>({slug:line.item.slug,quantity:line.quantity})),
      });
      setCreated(result);setReviewing(false);setCart({});
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:"Order could not be created.");
      setReviewing(false);
    }finally{setBusy(false);}
  };

  if(created)return <section className={`${glass} mx-auto max-w-3xl overflow-hidden`}>
    <div className="bg-[radial-gradient(circle_at_50%_0%,rgba(41,40,167,0.24),transparent_52%),#080808] px-6 py-9 text-center text-white sm:px-10 sm:py-12">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-400/15 text-3xl text-emerald-300 ring-1 ring-emerald-300/25">✓</span>
      <span className="mt-5 block text-[10px] font-black uppercase tracking-[0.18em] text-lb-red">Sent to kitchen queue</span>
      <h2 className="mb-1 mt-2 text-4xl font-black tracking-[-0.05em]">LB #{created.order_number}</h2>
      <p className="m-0 text-sm text-white/58">One digital order ID has been created and attributed to this counter session.</p>
      <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Total",money(created.total)],["Payment",created.payment_status.replaceAll("_"," ")],["State",created.operational_state],["Target",new Date(created.target_due_at).toLocaleTimeString("en-PK",{hour:"numeric",minute:"2-digit"})]].map(([label,value])=><div key={label} className="rounded-[17px] border border-white/10 bg-white/[0.07] p-3"><span className="block text-[9px] uppercase tracking-wider text-white/45">{label}</span><strong className="mt-1 block text-xs capitalize text-white">{value}</strong></div>)}
      </div>
      <div className="mt-7 flex flex-wrap justify-center gap-2"><button className={primary} onClick={clearOrder}>Take next order</button><a className={`${secondary} inline-flex items-center no-underline`} href="/kitchen">Open kitchen queue</a></div>
    </div>
  </section>;

  return <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_400px]">
    <section className={`${glass} min-w-0 p-3 sm:p-4`}>
      <div className="rounded-[22px] bg-[#090909] p-3.5 text-white sm:p-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div><span className="text-[9px] font-black uppercase tracking-[0.18em] text-lb-red">New digital order</span><h2 className="mb-0 mt-1 text-xl font-black tracking-[-0.03em]">Choose the service channel</h2></div>
          <div className="flex gap-2"><button className="min-h-10 rounded-[13px] border border-white/10 bg-white/10 px-3 text-[11px] font-black text-white" onClick={()=>void load()}>Refresh menu</button><button className="min-h-10 rounded-[13px] border border-white/10 bg-white/10 px-3 text-[11px] font-black text-white" onClick={signOut}>Sign out</button></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {channelOptions.map((option)=><button key={option.value} type="button" onClick={()=>setChannel(option.value)} className={`rounded-[18px] border p-3 text-left transition ${channel===option.value?"border-lb-red bg-lb-red text-white shadow-[0_12px_28px_rgba(255,31,40,0.26)]":"border-white/10 bg-white/[0.07] text-white hover:bg-white/10"}`} aria-pressed={channel===option.value}>
            <span className={`text-[9px] font-black ${channel===option.value?"text-white/72":"text-lb-red"}`}>{option.mark}</span><strong className="mt-1 block text-sm">{option.label}</strong><span className="mt-0.5 block text-[10px] opacity-60">{option.detail}</span>
          </button>)}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1"><span className="sr-only">Search menu</span><input ref={searchRef} className={`${field} pl-11 pr-12`} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search burgers, pizzas, wraps…"/><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-lb-muted">⌕</span><kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-lb-navy/10 bg-white px-1.5 py-1 text-[9px] font-black text-lb-muted">/</kbd></label>
        <div className="flex items-center gap-2 rounded-[15px] border border-lb-navy/10 bg-white/75 px-3 text-xs text-lb-muted"><span className="size-2 rounded-full bg-lb-green"/>{menu.length} available</div>
      </div>
      <div className="lb-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Menu categories">
        {categories.map((item)=><button key={item} type="button" role="tab" aria-selected={category===item} onClick={()=>setCategory(item)} className={`shrink-0 rounded-full px-3.5 py-2 text-[10px] font-black transition ${category===item?"bg-lb-blue text-white":"border border-lb-navy/10 bg-white/72 text-lb-muted"}`}>{item}</button>)}
      </div>

      {loading?<div className="grid min-h-80 place-items-center text-sm text-lb-muted">Loading live menu…</div>:<div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((item)=>{const quantity=cart[item.slug]??0;return <article key={item.id} className={`${soft} grid grid-cols-[92px_minmax(0,1fr)] gap-3 overflow-hidden p-2.5 transition [contain-intrinsic-size:112px] [content-visibility:auto] ${quantity?"ring-2 ring-lb-blue/55":"hover:border-lb-blue/25"}`}>
          <div className="relative min-h-24 overflow-hidden rounded-[14px] bg-black"><Image src={productImage(item)} alt="" fill sizes="92px" className="object-cover"/></div>
          <div className="flex min-w-0 flex-col"><span className="text-[8px] font-black uppercase tracking-[0.12em] text-lb-blue">{item.category}</span><strong className="mt-1 line-clamp-2 text-[13px] leading-4 text-lb-navy">{item.name}</strong><div className="mt-auto flex items-end justify-between gap-2 pt-2"><span className="text-xs font-black text-lb-navy">{money(Number(item.price))}</span>{quantity?<div className="flex items-center gap-1"><button type="button" aria-label={`Remove one ${item.name}`} className="grid size-8 place-items-center rounded-full border border-lb-navy/10 bg-white text-sm font-black" onClick={()=>setQuantity(item.slug,quantity-1)}>−</button><strong className="min-w-5 text-center text-xs">{quantity}</strong><button type="button" aria-label={`Add one ${item.name}`} className="grid size-8 place-items-center rounded-full bg-lb-navy text-sm font-black text-white" onClick={()=>setQuantity(item.slug,quantity+1)}>+</button></div>:<button type="button" className="grid size-8 place-items-center rounded-full bg-lb-red text-lg font-black text-white" aria-label={`Add ${item.name}`} onClick={()=>setQuantity(item.slug,1)}>+</button>}</div></div>
        </article>})}
        {!filtered.length&&<div className="col-span-full grid min-h-64 place-items-center rounded-[20px] border border-dashed border-lb-navy/15 bg-white/45 p-8 text-center"><div><strong className="text-sm text-lb-navy">No matching menu item</strong><p className="mb-0 mt-1 text-xs text-lb-muted">Try another search or category.</p></div></div>}
      </div>}
    </section>

    <aside className={`${glass} self-start p-4 xl:sticky xl:top-[104px]`}>
      <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-red">Current ticket</span><h2 className="mb-0 mt-1 text-xl font-black tracking-[-0.03em] text-lb-navy">{itemCount?`${itemCount} item${itemCount===1?"":"s"}`:"Build the order"}</h2></div>{lines.length>0&&<button className="rounded-full border border-lb-navy/10 bg-white px-3 py-1.5 text-[9px] font-black text-lb-muted" onClick={()=>setCart({})}>Clear</button>}</div>

      <div className="my-4 grid gap-2">
        {lines.slice(0,6).map((line)=><div key={line.item.slug} className="grid grid-cols-[1fr_auto] gap-2 rounded-[14px] bg-white/70 p-2.5 text-xs"><div className="min-w-0"><strong className="block truncate text-lb-navy">{line.quantity}× {line.item.name}</strong><span className="text-[10px] text-lb-muted">{money(Number(line.item.price))} each</span></div><strong className="text-lb-navy">{money(Number(line.item.price)*line.quantity)}</strong></div>)}
        {lines.length>6&&<span className="text-center text-[10px] font-bold text-lb-muted">+ {lines.length-6} more lines</span>}
        {!lines.length&&<div className="grid min-h-24 place-items-center rounded-[17px] border border-dashed border-lb-navy/15 bg-white/45 text-center text-[11px] text-lb-muted">Tap any menu item to add it.</div>}
      </div>

      <div className="grid gap-3 border-t border-lb-navy/10 pt-4">
        <section>
          <div className="mb-2 flex items-center justify-between"><strong className="text-xs text-lb-navy">Destination</strong><span className={`text-[9px] font-black ${checks[2]?"text-lb-green":"text-lb-red"}`}>{checks[2]?"COMPLETE":"REQUIRED"}</span></div>
          {channel==="dine_in"&&<input className={field} value={tableIdentifier} onChange={(event)=>setTableIdentifier(event.target.value)} placeholder="Table number, e.g. T-04" aria-label="Table number"/>}
          {channel==="pickup"&&<div className="grid gap-2"><input className={field} value={pickupName} onChange={(event)=>setPickupName(event.target.value)} placeholder="Pickup name" aria-label="Pickup name"/><input className={field} value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder="Phone (optional)" inputMode="tel" aria-label="Pickup phone"/></div>}
          {channel==="delivery"&&<div className="grid gap-2"><div className="grid grid-cols-2 gap-2"><input className={field} value={customerName} onChange={(event)=>setCustomerName(event.target.value)} placeholder="Customer name" aria-label="Customer name"/><input className={field} value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder="Phone" inputMode="tel" aria-label="Customer phone"/></div><textarea className={`${field} min-h-20 resize-y py-3`} value={address} onChange={(event)=>setAddress(event.target.value)} placeholder="Complete delivery address" aria-label="Delivery address"/></div>}
        </section>

        <section>
          <strong className="text-xs text-lb-navy">Payment</strong>
          <div className={`mt-2 grid gap-2 ${channel==="delivery"?"grid-cols-2":"grid-cols-2"}`}>
            <button type="button" className={`${paymentChoice==="paid_now"?"bg-lb-blue text-white":"border border-lb-navy/10 bg-white/75 text-lb-navy"} min-h-14 rounded-[15px] p-2.5 text-left text-[10px] font-black`} onClick={()=>setPaymentChoice("paid_now")}>Paid now<span className="mt-0.5 block font-normal opacity-65">Record payment</span></button>
            <button type="button" className={`${paymentChoice===(channel==="delivery"?"cod":"pay_later")?"bg-lb-blue text-white":"border border-lb-navy/10 bg-white/75 text-lb-navy"} min-h-14 rounded-[15px] p-2.5 text-left text-[10px] font-black`} onClick={()=>setPaymentChoice(channel==="delivery"?"cod":"pay_later")}>{channel==="delivery"?"Cash on delivery":"Pay at handoff"}<span className="mt-0.5 block font-normal opacity-65">Keep collection open</span></button>
          </div>
          {paymentChoice==="paid_now"&&<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" className={`${paymentMethod==="cash"?"bg-lb-navy text-white":"border border-lb-navy/10 bg-white/75 text-lb-navy"} min-h-10 rounded-[13px] text-[10px] font-black`} onClick={()=>setPaymentMethod("cash")}>Cash</button><button type="button" className={`${paymentMethod==="online"?"bg-lb-navy text-white":"border border-lb-navy/10 bg-white/75 text-lb-navy"} min-h-10 rounded-[13px] text-[10px] font-black`} onClick={()=>setPaymentMethod("online")}>Online verified</button></div>}
        </section>

        <details className="rounded-[15px] border border-lb-navy/10 bg-white/65 p-3"><summary className="cursor-pointer text-[11px] font-black text-lb-navy">Order notes <span className="font-normal text-lb-muted">(optional)</span></summary><textarea className={`${field} mt-2 min-h-20 resize-y py-3`} maxLength={500} value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="Allergies, no onion, special packing…"/></details>
      </div>

      {message&&<p role="alert" className="mt-3 rounded-[14px] border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{message}</p>}
      <div className="mt-4 border-t border-lb-navy/10 pt-4"><div className="flex justify-between text-sm"><span className="text-lb-muted">Subtotal</span><strong className="text-lb-navy">{money(subtotal)}</strong></div><p className="mb-0 mt-1 text-[9px] leading-4 text-lb-muted">Server rechecks availability, price and the best eligible discount before creating the order.</p></div>
      <button className={`${primary} mt-4 w-full`} disabled={!readyToReview||busy} onClick={()=>setReviewing(true)}>Review order · {money(subtotal)}</button>
      <div className="mt-3 grid grid-cols-4 gap-1">{["Channel","Items","Destination","Payment"].map((label,index)=><div key={label} className={`rounded-[9px] px-1 py-2 text-center text-[8px] font-black ${checks[index]?"bg-emerald-50 text-lb-green":"bg-lb-navy/5 text-lb-muted"}`}>{checks[index]?"✓ ":""}{label}</div>)}</div>
    </aside>

    {reviewing&&<div className="fixed inset-0 z-[100] grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="order-review-title" onMouseDown={(event)=>{if(event.target===event.currentTarget)setReviewing(false);}}>
      <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] border border-white/75 bg-[#f7f7fb] p-5 shadow-2xl sm:max-w-2xl sm:rounded-[30px] sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] font-black uppercase tracking-[0.17em] text-lb-red">Final check</span><h2 id="order-review-title" className="mb-0 mt-1 text-2xl font-black tracking-[-0.04em] text-lb-navy">Review before sending</h2></div><button className="grid size-10 place-items-center rounded-full border border-lb-navy/10 bg-white text-lg text-lb-navy" onClick={()=>setReviewing(false)} aria-label="Close review">×</button></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">{[["Channel",channelOptions.find((item)=>item.value===channel)?.label??channel],["Destination",channel==="dine_in"?tableIdentifier:channel==="pickup"?pickupName:address],["Payment",paymentChoice==="paid_now"?`Paid · ${paymentMethod}`:paymentChoice==="cod"?"Cash on delivery":"Pay at handoff"]].map(([label,value])=><div key={label} className={`${soft} p-3`}><span className="block text-[9px] uppercase tracking-wider text-lb-muted">{label}</span><strong className="mt-1 block text-xs capitalize text-lb-navy">{value}</strong></div>)}</div>
        <div className="mt-4 grid gap-2">{lines.map((line)=><div key={line.item.slug} className="flex justify-between gap-3 rounded-[14px] bg-white p-3 text-xs"><span>{line.quantity}× {line.item.name}</span><strong>{money(Number(line.item.price)*line.quantity)}</strong></div>)}</div>
        {notes&&<p className="mt-3 rounded-[14px] bg-amber-50 p-3 text-xs text-amber-900"><strong>Notes:</strong> {notes}</p>}
        <div className="mt-5 flex items-end justify-between border-t border-lb-navy/10 pt-4"><div><span className="block text-[9px] uppercase tracking-wider text-lb-muted">Estimated subtotal</span><strong className="text-2xl tracking-[-0.04em] text-lb-navy">{money(subtotal)}</strong></div><button className={primary} disabled={busy} onClick={()=>void submit()}>{busy?"Creating order…":"Confirm & send to kitchen"}</button></div>
      </section>
    </div>}
  </div>;
}
