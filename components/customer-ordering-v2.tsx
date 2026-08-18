"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { quoteOrder, type PaymentMethod } from "@/lib/business-rules";
import {
  customerProducts,
  londonBiteFacts,
  money,
  type CustomerProduct,
  type CustomerView,
  type FulfilmentMode,
} from "@/lib/customer-commerce";
import { captureLiveEvent, getLiveMenu, trackLiveOrder, type TrackedOrder } from "@/lib/lb-api";
import { createEnhancedOrder } from "@/lib/lb-v2-api";

type CartState = Record<string, number>;
type CustomerProfile = { name: string; phone: string; address: string };
type SavedAddress = { id: string; label: string; address: string };
type SavedOrder = {
  id: string;
  number: number;
  trackingToken: string;
  createdAt: string;
  fulfilment: FulfilmentMode;
  total: number;
  status: string;
  scheduledFor: string | null;
  referralCode: string | null;
  items: { slug: string; quantity: number }[];
  customer: CustomerProfile;
};

const glass = "border border-white/80 bg-white/72 shadow-[0_18px_60px_rgba(7,24,47,0.09)] backdrop-blur-2xl";
const softGlass = "border border-white/85 bg-white/65 shadow-[0_10px_34px_rgba(7,24,47,0.06)] backdrop-blur-xl";
const primary = "inline-flex min-h-12 items-center justify-center rounded-full bg-lb-navy px-5 text-sm font-black text-white no-underline shadow-[0_14px_30px_rgba(7,24,47,0.2)] transition hover:-translate-y-0.5 hover:bg-[#0b2748] disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-full border border-white/90 bg-white/75 px-5 text-sm font-black text-lb-navy no-underline shadow-sm backdrop-blur-xl transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45";
const field = "min-h-12 rounded-[16px] border border-lb-navy/10 bg-white/85 px-4 text-sm text-lb-ink outline-none transition focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const chip = "min-h-10 rounded-full border border-lb-navy/10 bg-white/75 px-3 text-[11px] font-black text-lb-navy";

function analyticsSession() {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem("lb.analytics.session");
  if (existing) return existing;
  const created = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `lb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("lb.analytics.session", created);
  return created;
}

function track(event: string, payload: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source") ?? "direct";
  const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  try {
    const existing = JSON.parse(localStorage.getItem("lb.analytics.preview") ?? "[]") as unknown[];
    localStorage.setItem("lb.analytics.preview", JSON.stringify([...existing.slice(-199), { event, at: new Date().toISOString(), ...clean }]));
  } catch {
    localStorage.setItem("lb.analytics.preview", JSON.stringify([{ event, at: new Date().toISOString(), ...clean }]));
  }
  void captureLiveEvent(event, analyticsSession(), source, clean);
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <section className={`grid min-h-[320px] place-content-center rounded-[32px] p-7 text-center ${glass}`}>
    <div className="mx-auto grid size-14 place-items-center rounded-full bg-lb-navy text-sm font-black text-white">LB</div>
    <h2 className="mb-2 mt-5 text-2xl font-black text-lb-navy">{title}</h2>
    <p className="mx-auto mb-5 mt-0 max-w-md text-sm leading-6 text-lb-muted">{detail}</p>
    {action}
  </section>;
}

function ProductVisual({ product }: { product: CustomerProduct }) {
  return <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#e9edf2]">
    <Image src={product.image} alt={product.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
    <div className="absolute inset-0 bg-gradient-to-t from-lb-navy/55 via-transparent to-transparent" />
    {product.badge && <span className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/82 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-lb-navy backdrop-blur-xl">{product.badge}</span>}
  </div>;
}

function ProductCard({ product, onOpen, onAdd }: { product: CustomerProduct; onOpen: () => void; onAdd: () => void }) {
  return <article className={`group rounded-[28px] p-2.5 ${glass}`}>
    <button type="button" onClick={onOpen} className="block w-full border-0 bg-transparent p-0 text-left"><ProductVisual product={product} /></button>
    <div className="p-3">
      <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.14em] text-lb-red">{product.category}</span><h3 className="mb-0 mt-1 text-base font-black tracking-[-0.02em] text-lb-navy">{product.name}</h3></div><strong className="whitespace-nowrap text-sm text-lb-navy">{money(product.price)}</strong></div>
      <p className="mb-3 mt-2 line-clamp-2 text-xs leading-5 text-lb-muted">{product.description}</p>
      <div className="flex gap-2"><button type="button" onClick={onOpen} className={`${chip} flex-1`}>View</button><button type="button" onClick={onAdd} className="min-h-10 flex-1 rounded-full bg-lb-navy px-3 text-xs font-black text-white">Add +</button></div>
    </div>
  </article>;
}

function Header({ cartCount, onCart }: { cartCount: number; onCart: () => void }) {
  return <header className={`sticky top-3 z-40 mx-auto flex w-[calc(100%-24px)] max-w-[1500px] items-center justify-between rounded-[24px] px-3 py-2.5 sm:px-4 ${glass}`}>
    <Link href="/" className="flex items-center gap-3 no-underline"><span className="grid size-11 place-items-center overflow-hidden rounded-[14px] bg-white shadow-sm ring-1 ring-black/5"><Image src="/brand/london-bite-logo.png" alt="London Bite" width={44} height={44} className="h-full w-full object-contain" /></span><span className="hidden leading-tight sm:grid"><strong className="text-sm text-lb-navy">London Bite</strong><small className="text-[9px] font-semibold uppercase tracking-[0.12em] text-lb-muted">Order direct</small></span></Link>
    <nav className="hidden items-center gap-1 lg:flex"><Link href="/order?view=menu" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Menu</Link><Link href="/order?view=track" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Track</Link><Link href="/order?view=history" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Orders</Link><Link href="/order?view=account" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Account</Link></nav>
    <button type="button" onClick={onCart} className="relative grid min-h-11 place-items-center rounded-full border border-white/90 bg-white/80 px-4 text-[10px] font-black text-lb-navy shadow-sm" aria-label={`Open bag with ${cartCount} items`}>Bag{cartCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-lb-red px-1 py-0.5 text-[9px] text-white">{cartCount}</span>}</button>
  </header>;
}

function BottomNav({ view, onChange }: { view: CustomerView; onChange: (view: CustomerView) => void }) {
  const items: { id: CustomerView; label: string }[] = [{ id: "home", label: "Discover" }, { id: "menu", label: "Menu" }, { id: "track", label: "Track" }, { id: "history", label: "Orders" }, { id: "account", label: "Account" }];
  return <nav className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-[620px] -translate-x-1/2 items-center justify-between rounded-[24px] border border-white/80 bg-white/86 p-2 shadow-[0_18px_55px_rgba(7,24,47,0.15)] backdrop-blur-2xl lg:hidden">{items.map((item) => <button type="button" key={item.id} onClick={() => onChange(item.id)} className={`min-h-11 flex-1 rounded-[17px] px-2 text-[10px] font-black ${view === item.id ? "bg-lb-navy text-white" : "bg-transparent text-lb-muted"}`}>{item.label}</button>)}</nav>;
}

export function CustomerOrderingV2() {
  const [view, setView] = useState<CustomerView>("home");
  const products = customerProducts;
  const [menuNotice, setMenuNotice] = useState("Official menu · checking kitchen connection…");
  const [cart, setCart] = useState<CartState>({});
  const [profile, setProfile] = useState<CustomerProfile>({ name: "", phone: "", address: "" });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressLabel, setAddressLabel] = useState("Home");
  const [fulfilment, setFulfilment] = useState<FulfilmentMode>("delivery");
  const [paymentMethod] = useState<PaymentMethod>("cash");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CustomerProduct | null>(null);
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<SavedOrder | null>(null);
  const [tracked, setTracked] = useState<TrackedOrder | null>(null);
  const [trackToken, setTrackToken] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [livePriceBySlug, setLivePriceBySlug] = useState<Record<string, number>>({});
  const lastNotifiedStatus = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("view") as CustomerView | null;
    if (requested && ["home","menu","cart","checkout","confirmation","track","history","account"].includes(requested)) setView(requested);
    const ref = params.get("ref"); if (ref) setReferralCode(ref.toUpperCase());
    try { setCart(JSON.parse(localStorage.getItem("lb.cart") ?? "{}")); } catch { setCart({}); }
    try { setProfile(JSON.parse(localStorage.getItem("lb.profile") ?? '{"name":"","phone":"","address":""}')); } catch { /* keep defaults */ }
    try { setAddresses(JSON.parse(localStorage.getItem("lb.addresses") ?? "[]")); } catch { setAddresses([]); }
    try { const saved = JSON.parse(localStorage.getItem("lb.orders") ?? "[]") as SavedOrder[]; setOrders(saved); if (saved[0]) { setActiveOrder(saved[0]); setTrackToken(saved[0].trackingToken); } } catch { setOrders([]); }
    setHydrated(true);
    track("order_app_opened", { initial_view: requested ?? "home" });
    void getLiveMenu()
      .then((items) => {
        setLivePriceBySlug(Object.fromEntries(items.filter((item) => item.is_available).map((item) => [item.slug, Number(item.price)])));
        setMenuNotice("Official menu · kitchen connected");
      })
      .catch(() => setMenuNotice("Official menu · reconnecting at checkout"));
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem("lb.cart", JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("lb.profile", JSON.stringify(profile)); }, [profile, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("lb.addresses", JSON.stringify(addresses)); }, [addresses, hydrated]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((item) => item.category)))], [products]);
  const cartLines = useMemo(() => products.filter((product) => (cart[product.slug] ?? 0) > 0).map((product) => ({ product, quantity: cart[product.slug] })), [cart, products]);
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const quote = quoteOrder({ subtotal, paymentMethod });
  const needsWhatsAppCheckout = cartLines.some((line) => livePriceBySlug[line.product.slug] !== line.product.price);
  const filtered = useMemo(() => products.filter((product) => (category === "All" || product.category === category) && `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query.toLowerCase().trim())), [products, category, query]);
  const popular = useMemo(() => products.filter((item) => item.popular).slice(0, 4), [products]);
  const repeatSlugs = useMemo(() => { const counts = new Map<string, number>(); orders.flatMap((order) => order.items).forEach((item) => counts.set(item.slug, (counts.get(item.slug) ?? 0) + item.quantity)); return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([slug])=>slug); }, [orders]);
  const personalised = products.filter((product) => repeatSlugs.includes(product.slug));

  const go = (next: CustomerView) => { setError(""); setView(next); window.history.replaceState({}, "", `/order?view=${next}`); track(`${next}_view`, { fulfilment }); };
  const addProduct = (product: CustomerProduct, quantity = 1) => { setCart((current) => ({ ...current, [product.slug]: Math.max(0, Math.min(10, (current[product.slug] ?? 0) + quantity)) })); track("add_to_cart", { product: product.slug, quantity, price: product.price }); };
  const setQuantity = (slug: string, quantity: number) => setCart((current) => ({ ...current, [slug]: Math.max(0, Math.min(10, quantity)) }));
  const saveAddress = () => { const value = profile.address.trim(); if (value.length < 8) return; const existing = addresses.find((item) => item.address.toLowerCase() === value.toLowerCase()); if (existing) return; setAddresses((current) => [{ id: crypto.randomUUID(), label: addressLabel.trim() || "Saved", address: value }, ...current].slice(0, 5)); };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    if (!profile.name.trim() || !profile.phone.trim() || (fulfilment === "delivery" && !profile.address.trim()) || cartLines.length === 0) { setError("Complete your contact details and basket first."); return; }
    let scheduleIso: string | null = null;
    if (scheduleEnabled) {
      if (!scheduledFor) { setError("Choose a scheduled date and time."); return; }
      const chosen = new Date(scheduledFor);
      if (Number.isNaN(chosen.getTime()) || chosen.getTime() < Date.now() + 30 * 60 * 1000) { setError("Scheduled orders must be at least 30 minutes ahead."); return; }
      scheduleIso = chosen.toISOString();
    }
    setSubmitting(true);
    try {
      if (needsWhatsAppCheckout) {
        const message = [
          "Hi London Bite, I would like to place this order:",
          "",
          ...cartLines.map((line) => `${line.quantity} × ${line.product.name} — ${money(line.product.price * line.quantity)}`),
          "",
          `Total: ${money(quote.total)}`,
          `Fulfilment: ${fulfilment === "delivery" ? "Delivery" : "Pickup"}`,
          `Name: ${profile.name.trim()}`,
          ...(fulfilment === "delivery" ? [`Address: ${profile.address.trim()}`] : []),
          ...(scheduleIso ? [`Scheduled for: ${new Date(scheduleIso).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`] : []),
          ...(referralCode.trim() ? [`Referral: ${referralCode.trim()}`] : []),
        ].join("\n");
        track("whatsapp_checkout_started", { total: quote.total, fulfilment, items: cartLines.length });
        window.location.assign(`${londonBiteFacts.whatsappUrl}?text=${encodeURIComponent(message)}`);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const source = params.get("utm_source") ?? (referralCode.trim() ? "referral" : "web");
      const created = await createEnhancedOrder({ name: profile.name, phone: profile.phone, address: profile.address, fulfilment, paymentMethod, items: cartLines.map((line) => ({ slug: line.product.slug, quantity: line.quantity })), source, scheduledFor: scheduleIso, referralCode: referralCode.trim() || null });
      const saved: SavedOrder = { id: created.id, number: created.order_number, trackingToken: created.tracking_token, createdAt: created.created_at, fulfilment, total: Number(created.total), status: created.status, scheduledFor: created.scheduled_for, referralCode: created.referral_code, items: cartLines.map((line) => ({ slug: line.product.slug, quantity: line.quantity })), customer: profile };
      const nextOrders = [saved, ...orders.filter((order) => order.id !== saved.id)].slice(0, 20);
      setOrders(nextOrders); setActiveOrder(saved); setTrackToken(saved.trackingToken); setCart({}); setTracked(null);
      localStorage.setItem("lb.orders", JSON.stringify(nextOrders));
      track("order_created", { order_number: saved.number, total: saved.total, fulfilment, scheduled: Boolean(scheduleIso), referral: Boolean(saved.referralCode) });
      setView("confirmation"); window.history.replaceState({}, "", "/order?view=confirmation");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Order could not be created."); }
    finally { setSubmitting(false); }
  };

  const refreshTracking = async (token = trackToken || activeOrder?.trackingToken || "", notify = false) => {
    if (!token.trim()) { if (!notify) setError("Enter a tracking token or create an order first."); return; }
    if (!notify) setError("");
    try {
      const result = await trackLiveOrder(token); if (!result) throw new Error("Order not found.");
      if (notify && lastNotifiedStatus.current && lastNotifiedStatus.current !== result.status && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`London Bite · ${result.status.replaceAll("_"," ")}`, { body: `LB #${result.order_number} status just changed.` });
      lastNotifiedStatus.current = result.status;
      setTracked(result); setTrackToken(token);
      if (activeOrder?.id === result.id) { const updated = { ...activeOrder, status: result.status, total: Number(result.total) }; setActiveOrder(updated); setOrders((current) => { const next = current.map((order) => order.id === updated.id ? updated : order); localStorage.setItem("lb.orders", JSON.stringify(next)); return next; }); }
      if (!notify) track("tracking_refreshed", { order_number: result.order_number });
    } catch (cause) { if (!notify) { setTracked(null); setError(cause instanceof Error ? cause.message : "Tracking failed."); } }
  };

  useEffect(() => {
    if (view !== "track" || !(trackToken || activeOrder?.trackingToken)) return;
    void refreshTracking();
    const interval = window.setInterval(() => void refreshTracking(trackToken || activeOrder?.trackingToken || "", true), 15000);
    return () => window.clearInterval(interval);
  }, [view, trackToken, activeOrder?.trackingToken]);

  const reorder = (order: SavedOrder) => { const next: CartState = {}; order.items.forEach((item) => { if (products.some((product) => product.slug === item.slug)) next[item.slug] = item.quantity; }); setCart(next); track("reorder_clicked", { order_number: order.number }); go("cart"); };
  const supportUrl = activeOrder ? `${londonBiteFacts.whatsappUrl}${londonBiteFacts.whatsappUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(`Hi London Bite, I need help with order LB #${activeOrder.number}.`)}` : londonBiteFacts.whatsappUrl;

  const renderHome = () => <div className="grid gap-3">
    <section className={`relative overflow-hidden rounded-[36px] p-6 sm:p-8 ${glass}`}><div className="grid gap-6 xl:grid-cols-[1fr_0.86fr] xl:items-center"><div><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Order direct</span><h1 className="my-3 max-w-2xl text-4xl font-black leading-[0.96] tracking-[-0.055em] text-lb-navy sm:text-6xl">What are you craving right now?</h1><p className="max-w-xl text-sm leading-6 text-lb-muted">Live menu, server-priced checkout, scheduled ordering and private tracking—without forcing an account.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => go("menu")}>Explore menu</button><button type="button" className={secondary} onClick={() => go("history")}>Reorder</button></div></div><div className="grid grid-cols-2 gap-2">{popular.map((product) => <button type="button" key={product.slug} onClick={() => setSelectedProduct(product)} className="group relative aspect-square overflow-hidden rounded-[24px] border-0 bg-[#e8ebef] p-0 text-left"><Image src={product.image} alt={product.name} fill sizes="(max-width: 1280px) 50vw, 21vw" className="object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-lb-navy/75 to-transparent" /><span className="absolute bottom-3 left-3 right-3 text-xs font-black text-white">{product.name}</span></button>)}</div></div></section>
    {personalised.length > 0 && <section className={`rounded-[30px] p-5 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Based on your orders</span><h2 className="mb-4 mt-1 text-xl font-black text-lb-navy">Your usual favourites</h2><div className="grid gap-3 sm:grid-cols-3">{personalised.map((product) => <ProductCard key={product.slug} product={product} onOpen={() => setSelectedProduct(product)} onAdd={() => addProduct(product)} />)}</div></section>}
  </div>;

  const renderMenu = () => <div className="grid gap-3"><section className={`rounded-[30px] p-4 sm:p-5 ${glass}`}><div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">{menuNotice}</span><span className="text-[10px] text-lb-muted">{products.length} products</span></div><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search burger, pizza, wings…" className={field} /><div className="flex max-w-full gap-2 overflow-x-auto">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`min-h-12 shrink-0 rounded-full px-4 text-xs font-black ${category === item ? "bg-lb-navy text-white" : "border border-lb-navy/10 bg-white/75 text-lb-navy"}`}>{item}</button>)}</div></div></section>{filtered.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((product) => <ProductCard key={product.slug} product={product} onOpen={() => setSelectedProduct(product)} onAdd={() => addProduct(product)} />)}</div> : <EmptyState title={products.length ? "No match" : "Menu unavailable"} detail={products.length ? "Try another category or search term." : "The live kitchen menu currently has no available products. Nothing unavailable is kept visible from fallback data."} />}</div>;

  const renderCart = () => cartLines.length === 0 ? <EmptyState title="Your bag is empty" detail="Add a London Bite favourite and the basket will stay saved in this browser." action={<button type="button" className={primary} onClick={() => go("menu")}>Browse menu</button>} /> : <div className="grid gap-3 xl:grid-cols-[1fr_390px]"><section className={`rounded-[32px] p-5 ${glass}`}><h2 className="mt-0 text-2xl font-black text-lb-navy">Your bag · {cartCount}</h2><div className="grid gap-2">{cartLines.map(({ product, quantity }) => <div key={product.slug} className={`grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-[22px] p-2.5 ${softGlass}`}><Image src={product.image} alt="" width={70} height={70} className="size-[70px] rounded-[17px] object-cover" /><div><strong className="block text-sm text-lb-navy">{product.name}</strong><span className="text-[11px] text-lb-muted">{money(product.price)} each</span><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => setQuantity(product.slug, quantity - 1)} className="grid size-8 place-items-center rounded-full border border-lb-navy/10 bg-white font-black">−</button><strong className="min-w-5 text-center text-xs">{quantity}</strong><button type="button" onClick={() => setQuantity(product.slug, quantity + 1)} className="grid size-8 place-items-center rounded-full bg-lb-navy font-black text-white">+</button></div></div><strong className="text-sm text-lb-navy">{money(product.price * quantity)}</strong></div>)}</div></section><aside className={`self-start rounded-[32px] p-5 xl:sticky xl:top-24 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Estimated basket</span><div className="mt-4 flex justify-between text-sm"><span className="text-lb-muted">Subtotal</span><strong>{money(quote.subtotal)}</strong></div>{quote.discountPercent > 0 && <div className="mt-2 flex justify-between text-sm text-lb-green"><span>{quote.discountLabel}</span><strong>−{money(quote.discountAmount)}</strong></div>}<div className="mt-4 flex justify-between border-t border-lb-navy/10 pt-4"><strong>Total</strong><strong>{money(quote.total)}</strong></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setFulfilment("delivery")} className={`min-h-12 rounded-[16px] text-xs font-black ${fulfilment === "delivery" ? "bg-lb-navy text-white" : "bg-white/75"}`}>Delivery</button><button type="button" onClick={() => setFulfilment("pickup")} className={`min-h-12 rounded-[16px] text-xs font-black ${fulfilment === "pickup" ? "bg-lb-navy text-white" : "bg-white/75"}`}>Pickup</button></div><button type="button" className={`${primary} mt-4 w-full`} onClick={() => go("checkout")}>Continue to checkout</button><p className="mb-0 mt-3 text-[10px] leading-4 text-lb-muted">Final prices and availability are revalidated by the server.</p></aside></div>;

  const renderCheckout = () => <form onSubmit={submitOrder} className="grid gap-3 xl:grid-cols-[1fr_390px]"><section className={`rounded-[32px] p-5 sm:p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Guest checkout</span><h2 className="mb-5 mt-1 text-2xl font-black text-lb-navy">Fast checkout, still under your control.</h2><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-black text-lb-navy">Name<input required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className={field} /></label><label className="grid gap-1.5 text-xs font-black text-lb-navy">Phone<input required value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className={field} inputMode="tel" /></label></div>{fulfilment === "delivery" && <div className="mt-3 grid gap-2"><label className="grid gap-1.5 text-xs font-black text-lb-navy">Delivery address<textarea required value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} className={`${field} min-h-28 resize-y py-3`} /></label>{addresses.length > 0 && <div className="flex flex-wrap gap-2">{addresses.map((item) => <button type="button" key={item.id} className={chip} onClick={() => setProfile({ ...profile, address: item.address })}>{item.label}</button>)}</div>}<div className="flex gap-2"><input className={`${field} min-w-0 flex-1`} value={addressLabel} onChange={(event)=>setAddressLabel(event.target.value)} placeholder="Home / Office" /><button type="button" className={secondary} onClick={saveAddress}>Save address</button></div></div>}
    <div className={`mt-5 rounded-[22px] p-4 ${softGlass}`}><div className="flex items-center justify-between gap-3"><div><strong className="block text-sm text-lb-navy">Schedule this order</strong><span className="text-[10px] text-lb-muted">30 minutes to 7 days ahead</span></div><button type="button" className={`${chip} ${scheduleEnabled ? "bg-lb-navy text-white" : ""}`} onClick={() => setScheduleEnabled((value) => !value)}>{scheduleEnabled ? "Scheduled" : "Order now"}</button></div>{scheduleEnabled && <input type="datetime-local" className={`${field} mt-3 w-full`} value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />}</div>
    <label className="mt-4 grid gap-1.5 text-xs font-black text-lb-navy">Referral code <input className={field} value={referralCode} onChange={(event) => setReferralCode(event.target.value.toUpperCase())} placeholder="Optional code" maxLength={24} /></label>
    <div className="mt-5"><span className="text-xs font-black text-lb-navy">Payment</span><div className="mt-2 grid gap-2 sm:grid-cols-2"><div className="min-h-16 rounded-[18px] bg-lb-navy p-3 text-left text-xs font-black text-white">Cash<span className="mt-1 block text-[10px] font-normal text-white/65">Pay on delivery / pickup</span></div><div className="min-h-16 rounded-[18px] border border-lb-navy/10 bg-white/50 p-3 text-left text-xs font-black text-lb-muted">Online<span className="mt-1 block text-[10px] font-normal">Enabled only after real merchant activation</span></div></div></div>{error && <p role="alert" className="mt-4 rounded-[16px] border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}</section><aside className={`self-start rounded-[32px] p-5 xl:sticky xl:top-24 ${glass}`}><div className="grid gap-2">{cartLines.map(({ product, quantity }) => <div key={product.slug} className="flex justify-between gap-3 text-xs"><span>{quantity} × {product.name}</span><strong>{money(product.price * quantity)}</strong></div>)}</div><div className="mt-4 flex justify-between border-t border-lb-navy/10 pt-4"><strong>Estimated total</strong><strong>{money(quote.total)}</strong></div>{scheduleEnabled && scheduledFor && <p className="mt-3 text-[10px] font-bold text-lb-blue">Scheduled: {new Date(scheduledFor).toLocaleString()}</p>}<button type="submit" className={`${primary} mt-5 w-full`} disabled={submitting || cartLines.length === 0}>{submitting ? "Preparing order…" : needsWhatsAppCheckout ? "Review order on WhatsApp" : scheduleEnabled ? "Schedule order" : "Place order"}</button><p className="mb-0 mt-3 text-[10px] leading-4 text-lb-muted">{needsWhatsAppCheckout ? "This official menu selection opens as a pre-filled WhatsApp order for you to review and send." : "Cash orders are transmitted directly to London Bite operations."} Online charging stays disabled until merchant activation.</p></aside></form>;

  const renderConfirmation = () => activeOrder ? <div className="mx-auto max-w-3xl"><section className={`rounded-[36px] p-7 text-center sm:p-10 ${glass}`}><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eaf8f0] text-2xl font-black text-lb-green">✓</span><span className="mt-5 block text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">{activeOrder.scheduledFor ? "Order scheduled" : "Order accepted"}</span><h2 className="mb-2 mt-2 text-3xl font-black text-lb-navy">LB #{activeOrder.number}</h2><p className="mx-auto max-w-lg text-sm leading-6 text-lb-muted">Your order is in London Bite operations. Tracking updates automatically while this page is open.</p>{activeOrder.scheduledFor && <p className="text-sm font-black text-lb-blue">{new Date(activeOrder.scheduledFor).toLocaleString()}</p>}<div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2"><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] text-lb-muted">Mode</span><strong className="text-xs capitalize">{activeOrder.fulfilment}</strong></div><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] text-lb-muted">Total</span><strong className="text-xs">{money(activeOrder.total)}</strong></div></div><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" className={primary} onClick={() => go("track")}>Track order</button><a className={secondary} href={supportUrl}>WhatsApp support</a></div></section></div> : <EmptyState title="No active order" detail="Create an order first." />;

  const renderTrack = () => {
    const status = tracked?.status ?? activeOrder?.status ?? "accepted";
    const fulfil = tracked?.fulfilment ?? activeOrder?.fulfilment ?? "delivery";
    const steps = fulfil === "delivery" ? ["accepted","preparing","ready","out_for_delivery","delivered"] : ["accepted","preparing","ready","delivered"];
    const cancelled = status === "cancelled";
    const currentIndex = cancelled ? -1 : steps.indexOf(status);
    return <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]"><section className={`rounded-[32px] p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Live order status</span><h2 className="mb-5 mt-1 text-2xl font-black text-lb-navy">{tracked ? `LB #${tracked.order_number}` : activeOrder ? `LB #${activeOrder.number}` : "Track an order"}</h2>{cancelled ? <div className="rounded-[22px] border border-red-200 bg-red-50 p-5"><strong className="text-lg text-red-700">Order cancelled</strong><p className="mb-0 mt-2 text-xs leading-5 text-red-700/80">This order is closed and is no longer moving through preparation or delivery. Contact London Bite if you need help.</p></div> : <div className="grid gap-2">{steps.map((step,index) => <div key={step} className={`flex items-center gap-3 rounded-[18px] p-3 ${index <= currentIndex ? "bg-lb-navy text-white" : "bg-white/65 text-lb-muted"}`}><span className={`grid size-7 place-items-center rounded-full text-[10px] font-black ${index <= currentIndex ? "bg-white text-lb-navy" : "bg-lb-navy/5"}`}>{index < currentIndex ? "✓" : index + 1}</span><strong className="text-xs capitalize">{step.replaceAll("_"," ")}</strong></div>)}</div>}{tracked?.events?.length ? <div className="mt-5 border-t border-lb-navy/10 pt-4"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-lb-muted">Timeline</span>{tracked.events.map((event,index) => <div key={`${event.created_at}-${index}`} className="mt-3 flex justify-between gap-3 text-xs"><strong className="text-lb-navy">{event.label}</strong><span className="text-lb-muted">{new Date(event.created_at).toLocaleString()}</span></div>)}</div> : null}</section><aside className={`self-start rounded-[32px] p-5 ${glass}`}><label className="grid gap-1.5 text-xs font-black text-lb-navy">Tracking token<input value={trackToken} onChange={(event) => setTrackToken(event.target.value)} className={field} placeholder="Paste order tracking token" /></label><button type="button" onClick={() => void refreshTracking()} className={`${primary} mt-3 w-full`}>Refresh now</button><button type="button" className={`${secondary} mt-2 w-full`} onClick={async()=>{if(typeof Notification === "undefined") return; const result=await Notification.requestPermission(); if(result==="granted") track("notifications_enabled");}}>Enable status alerts</button>{error && <p className="mt-3 rounded-[14px] bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<p className="mb-0 mt-4 break-all text-[10px] leading-4 text-lb-muted">Auto-refreshes every 15 seconds while tracking is open.</p><a className={`${secondary} mt-3 w-full`} href={supportUrl}>Order support</a></aside></div>;
  };

  const renderHistory = () => orders.length ? <div className="grid gap-3"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Saved in this browser</span><h2 className="mb-0 mt-1 text-3xl font-black text-lb-navy">Your orders</h2></div>{orders.map((order) => <article key={order.id} className={`grid gap-4 rounded-[28px] p-5 sm:grid-cols-[1fr_auto] sm:items-center ${glass}`}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-base text-lb-navy">LB #{order.number}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${order.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-lb-blue/5 text-lb-blue"}`}>{order.status.replaceAll("_"," ")}</span></div><p className="mb-0 mt-1 text-xs text-lb-muted">{new Date(order.createdAt).toLocaleString()} · {order.fulfilment} · {money(order.total)}</p>{order.scheduledFor && <p className="mb-0 mt-1 text-[10px] font-bold text-lb-blue">Scheduled for {new Date(order.scheduledFor).toLocaleString()}</p>}</div><div className="flex gap-2"><button type="button" className={secondary} onClick={() => { setActiveOrder(order); setTrackToken(order.trackingToken); go("track"); }}>Track</button><button type="button" className={primary} onClick={() => reorder(order)}>Reorder</button></div></article>)}</div> : <EmptyState title="No saved orders" detail="Orders created in this browser will appear here for quick tracking and one-tap reorder." action={<button type="button" className={primary} onClick={() => go("menu")}>Start order</button>} />;

  const renderAccount = () => <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]"><section className={`rounded-[32px] p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Checkout profile</span><h2 className="mb-5 mt-1 text-2xl font-black text-lb-navy">Saved on this device</h2><div className="grid gap-3"><input className={field} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Name" /><input className={field} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="Phone" /><textarea className={`${field} min-h-28 py-3`} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} placeholder="Delivery address" /></div><div className="mt-5"><span className="text-xs font-black text-lb-navy">Saved addresses</span><div className="mt-2 grid gap-2">{addresses.map((item) => <div key={item.id} className={`${softGlass} flex items-start justify-between gap-3 rounded-[18px] p-3`}><div><strong className="text-xs text-lb-navy">{item.label}</strong><p className="mb-0 mt-1 text-[10px] leading-4 text-lb-muted">{item.address}</p></div><button type="button" className="text-[10px] font-black text-lb-red" onClick={() => setAddresses((current) => current.filter((address) => address.id !== item.id))}>Remove</button></div>)}{!addresses.length && <p className="text-xs text-lb-muted">No saved addresses yet.</p>}</div></div></section><section className={`rounded-[32px] p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Privacy & retention</span><h2 className="mb-3 mt-1 text-2xl font-black text-lb-navy">Convenience without a forced account.</h2><p className="text-sm leading-6 text-lb-muted">Saved addresses, cart and order references stay in this browser. Referral attribution is recorded only when you place an order. You can remove local data at any time.</p><button type="button" className={secondary} onClick={() => { ["lb.profile","lb.orders","lb.cart","lb.addresses"].forEach((key)=>localStorage.removeItem(key)); setProfile({ name:"",phone:"",address:"" }); setOrders([]); setCart({}); setAddresses([]); setActiveOrder(null); }}>Clear local data</button></section></div>;

  return <main className="min-h-screen bg-[#f4f5f2] pb-24 text-lb-ink"><div className="pt-3"><Header cartCount={cartCount} onCart={() => go("cart")} /></div><div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-8 lg:py-7">{view === "home" && renderHome()}{view === "menu" && renderMenu()}{view === "cart" && renderCart()}{view === "checkout" && renderCheckout()}{view === "confirmation" && renderConfirmation()}{view === "track" && renderTrack()}{view === "history" && renderHistory()}{view === "account" && renderAccount()}</div><BottomNav view={view} onChange={go} />{selectedProduct && <div className="fixed inset-0 z-50 grid place-items-end bg-lb-navy/30 p-3 backdrop-blur-sm sm:place-items-center" onClick={() => setSelectedProduct(null)}><section className={`w-full max-w-lg rounded-[30px] p-3 ${glass}`} onClick={(event) => event.stopPropagation()}><ProductVisual product={selectedProduct} /><div className="p-4"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">{selectedProduct.category}</span><h2 className="mb-1 mt-1 text-2xl font-black text-lb-navy">{selectedProduct.name}</h2></div><strong className="text-base text-lb-navy">{money(selectedProduct.price)}</strong></div><p className="text-sm leading-6 text-lb-muted">{selectedProduct.description}</p><div className="flex gap-2"><button type="button" className={`${primary} flex-1`} onClick={() => { addProduct(selectedProduct); setSelectedProduct(null); }}>Add to bag</button><button type="button" className={secondary} onClick={() => setSelectedProduct(null)}>Close</button></div></div></section></div>}</main>;
}
