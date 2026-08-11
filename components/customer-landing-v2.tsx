"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { customerProducts, londonBiteFacts, money } from "@/lib/customer-commerce";

const glass = "border border-white/12 bg-white/[0.065] shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl";
const primary = "inline-flex min-h-12 items-center justify-center rounded-full bg-lb-red px-6 text-sm font-black text-white no-underline shadow-[0_16px_34px_rgba(255,31,40,0.24)] transition hover:-translate-y-0.5 hover:bg-[#ff3840]";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-full border border-lb-blue/70 bg-lb-blue px-6 text-sm font-black text-white no-underline shadow-[0_14px_30px_rgba(41,40,167,0.24)] transition hover:-translate-y-0.5 hover:bg-[#3433bd]";

export function CustomerLandingV2() {
  const [referral, setReferral] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("ref");
    if (value) setReferral(value.toUpperCase());
  }, []);
  const orderHref = useMemo(() => `/order?view=menu${referral ? `&ref=${encodeURIComponent(referral)}` : ""}`, [referral]);
  const popular = customerProducts.filter((item) => item.popular).slice(0, 4);
  const fastOrder = (slug: string) => {
    try {
      const cart = JSON.parse(localStorage.getItem("lb.cart") ?? "{}") as Record<string, number>;
      cart[slug] = Math.max(1, Math.min(10, (cart[slug] ?? 0) + 1));
      localStorage.setItem("lb.cart", JSON.stringify(cart));
    } catch {
      localStorage.setItem("lb.cart", JSON.stringify({ [slug]: 1 }));
    }
    window.location.href = `/order?view=cart${referral ? `&ref=${encodeURIComponent(referral)}` : ""}`;
  };

  return <main className="min-h-screen overflow-hidden bg-black text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(41,40,167,0.30),transparent_32%),radial-gradient(circle_at_96%_12%,rgba(255,31,40,0.20),transparent_30%)]" />
    <header className={`sticky top-3 z-40 mx-auto flex w-[calc(100%-24px)] max-w-[1500px] items-center justify-between rounded-[24px] px-3 py-2.5 sm:px-4 ${glass}`}>
      <Link href={referral ? `/?ref=${encodeURIComponent(referral)}` : "/"} className="flex items-center gap-3 no-underline"><span className="grid size-12 place-items-center overflow-hidden rounded-[14px] bg-black shadow-sm ring-1 ring-white/10"><img src="/brand/london-bite-official.svg" alt="London Bite" className="h-full w-full object-contain" /></span><span className="hidden leading-tight sm:grid"><strong className="text-sm text-white">London Bite</strong><small className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/48">Every Bite is a London Story</small></span></Link>
      <div className="flex items-center gap-2">{referral && <span className="hidden rounded-full border border-lb-blue/30 bg-lb-blue/15 px-3 py-2 text-[9px] font-black uppercase text-[#b9b8ff] sm:inline">Referral {referral}</span>}<Link href={orderHref} className={`${primary} min-h-11 px-4 text-xs`}>Order now</Link></div>
    </header>

    <section className="relative mx-auto grid min-h-[720px] max-w-[1500px] items-center gap-7 px-5 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-16">
      <div className="max-w-2xl"><span className="inline-flex rounded-full border border-white/12 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lb-red shadow-sm backdrop-blur-xl">Order direct · London Bite</span><h1 className="my-5 text-[clamp(3.1rem,7vw,6.8rem)] font-black leading-[0.88] tracking-[-0.075em] text-white">Your next bite,<br/><span className="text-lb-red">without the wait.</span></h1><p className="max-w-xl text-base leading-7 text-white/58 sm:text-lg">Browse the live menu, order now or schedule ahead, save your usual addresses and follow the kitchen journey from one place.</p><div className="mt-7 flex flex-col gap-2.5 sm:flex-row"><Link href={orderHref} className={primary}>Start an order →</Link><a href={londonBiteFacts.whatsappUrl} className={secondary}>WhatsApp support</a></div>{referral && <p className="mt-4 text-xs font-bold text-[#b9b8ff]">Your referral code <strong>{referral}</strong> will stay attached when you enter checkout.</p>}</div>
      <div className="relative min-h-[500px] lg:min-h-[640px]"><div className={`absolute inset-0 overflow-hidden rounded-[42px] p-2 ring-1 ring-lb-blue/25 ${glass}`}><img src={popular[1]?.image ?? customerProducts[0].image} alt="London Bite food" className="h-full w-full rounded-[36px] object-cover"/><div className="absolute inset-2 rounded-[36px] bg-gradient-to-t from-black via-black/15 to-transparent"/><div className="absolute bottom-7 left-7 right-7 text-white"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">London Bite favourite</span><strong className="mt-2 block text-2xl font-black">{popular[1]?.name ?? "Signature favourites"}</strong></div></div></div>
    </section>

    <section className="relative mx-auto max-w-[1500px] px-5 py-10 lg:px-8"><div className="mb-5 flex items-end justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Popular right now</span><h2 className="mb-0 mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Fast path to the craving.</h2></div><Link href={orderHref} className="hidden text-xs font-black text-[#b9b8ff] no-underline sm:block">See full menu →</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{popular.map((product) => <article key={product.slug} className={`rounded-[28px] p-2.5 ${glass}`}><img src={product.image} alt={product.name} className="aspect-[4/3] w-full rounded-[22px] object-cover"/><div className="p-3"><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.14em] text-lb-red">{product.category}</span><h3 className="mb-0 mt-1 text-base font-black text-white">{product.name}</h3></div><strong className="whitespace-nowrap text-sm text-white">{money(product.price)}</strong></div><p className="mb-3 mt-2 line-clamp-2 text-xs leading-5 text-white/52">{product.description}</p><button type="button" onClick={() => fastOrder(product.slug)} className={`${primary} w-full min-h-10 px-3 text-xs`}>Add & order</button></div></article>)}</div></section>

    <section className="relative mx-auto grid max-w-[1500px] gap-3 px-5 py-10 md:grid-cols-3 lg:px-8">{[["Scheduled ordering","Choose a time from 30 minutes to seven days ahead."],["Private tracking","Follow order events with a private tracking token."],["Restaurant connected","Status changes flow from management, kitchen and rider operations."]].map(([title,detail]) => <article key={title} className={`rounded-[28px] p-5 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.12em] text-lb-red">Built-in</span><strong className="mt-2 block text-lg text-white">{title}</strong><p className="mb-0 mt-2 text-xs leading-5 text-white/52">{detail}</p></article>)}</section>
  </main>;
}
