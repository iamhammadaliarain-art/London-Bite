"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { quoteOrder, type PaymentMethod } from "@/lib/business-rules";
import {
  customerCategories,
  customerProducts,
  londonBiteFacts,
  money,
  popularProducts,
  type AnalyticsEventName,
  type CustomerProduct,
  type CustomerView,
  type FulfilmentMode,
} from "@/lib/customer-commerce";

type CartState = Record<string, number>;
type CustomerProfile = { name: string; phone: string; address: string };
type OrderPreview = {
  id: string;
  createdAt: string;
  fulfilment: FulfilmentMode;
  total: number;
  status: "Accepted" | "Preparing" | "Ready" | "Out for Delivery" | "Delivered";
  items: { id: string; quantity: number }[];
  customer: CustomerProfile;
};

const glass = "border border-white/80 bg-white/72 shadow-[0_18px_60px_rgba(7,24,47,0.09)] backdrop-blur-2xl";
const softGlass = "border border-white/85 bg-white/65 shadow-[0_10px_34px_rgba(7,24,47,0.06)] backdrop-blur-xl";
const primary = "inline-flex min-h-12 items-center justify-center rounded-full bg-lb-navy px-5 text-sm font-black text-white no-underline shadow-[0_14px_30px_rgba(7,24,47,0.2)] transition hover:-translate-y-0.5 hover:bg-[#0b2748] disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-full border border-white/90 bg-white/75 px-5 text-sm font-black text-lb-navy no-underline shadow-sm backdrop-blur-xl transition hover:bg-white";
const field = "min-h-12 rounded-[16px] border border-lb-navy/10 bg-white/85 px-4 text-sm text-lb-ink outline-none transition focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";

function track(event: AnalyticsEventName, payload: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined") return;
  const entry = { event, at: new Date().toISOString(), ...payload };
  try {
    const existing = JSON.parse(window.localStorage.getItem("lb.analytics.preview") ?? "[]") as unknown[];
    window.localStorage.setItem("lb.analytics.preview", JSON.stringify([...existing.slice(-199), entry]));
  } catch {
    window.localStorage.setItem("lb.analytics.preview", JSON.stringify([entry]));
  }
  const analyticsWindow = window as Window & { dataLayer?: unknown[] };
  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.dataLayer.push(entry);
}

function LogoLockup({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="flex items-center gap-3 no-underline">
    <span className={`grid place-items-center overflow-hidden bg-white shadow-sm ring-1 ring-black/5 ${compact ? "size-11 rounded-[14px]" : "size-14 rounded-[18px]"}`}>
      <img src="/brand/london-bite-logo.png" alt="London Bite" className="h-full w-full object-contain" />
    </span>
    <span className="grid leading-tight"><strong className="text-sm text-lb-navy">London Bite</strong><small className="text-[10px] font-semibold uppercase tracking-[0.12em] text-lb-muted">Every Bite is a London Story</small></span>
  </Link>;
}

function CustomerHeader({ cartCount = 0, onCart }: { cartCount?: number; onCart?: () => void }) {
  return <header className={`sticky top-3 z-40 mx-auto flex w-[calc(100%-24px)] max-w-[1500px] items-center justify-between rounded-[24px] px-3 py-2.5 sm:px-4 ${glass}`}>
    <LogoLockup compact />
    <nav className="hidden items-center gap-1 lg:flex">
      <Link href="/order?view=menu" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Menu</Link>
      <Link href="/order?view=menu" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Deals</Link>
      <Link href="/order?view=track" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Track order</Link>
      <Link href="/order?view=account" className="rounded-full px-4 py-2 text-xs font-extrabold text-lb-navy no-underline hover:bg-white/80">Account</Link>
    </nav>
    <div className="flex items-center gap-2">
      {onCart && <button type="button" onClick={onCart} className="relative grid size-11 place-items-center rounded-full border border-white/90 bg-white/80 text-xs font-black text-lb-navy shadow-sm" aria-label={`Open cart with ${cartCount} items`}>Bag{cartCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-lb-red px-1 py-0.5 text-[9px] text-white">{cartCount}</span>}</button>}
      <Link href="/order?view=menu" className={`${primary} min-h-11 px-4 text-xs`}>Order now</Link>
    </div>
  </header>;
}

function ProductVisual({ product, priority = false }: { product: CustomerProduct; priority?: boolean }) {
  return <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#e9edf2]">
    <img src={product.image} alt={product.name} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
    <div className="absolute inset-0 bg-gradient-to-t from-lb-navy/55 via-transparent to-transparent" />
    {product.badge && <span className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/82 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-lb-navy backdrop-blur-xl">{product.badge}</span>}
  </div>;
}

function ProductCard({ product, onOpen, onAdd }: { product: CustomerProduct; onOpen?: () => void; onAdd?: () => void }) {
  return <article className={`group rounded-[28px] p-2.5 ${glass}`}>
    <button type="button" onClick={onOpen} className="block w-full border-0 bg-transparent p-0 text-left"><ProductVisual product={product} /></button>
    <div className="p-3">
      <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.14em] text-lb-red">{product.category}</span><h3 className="mb-0 mt-1 text-base font-black tracking-[-0.02em] text-lb-navy">{product.name}</h3></div><strong className="whitespace-nowrap text-sm text-lb-navy">{money(product.price)}</strong></div>
      <p className="mb-3 mt-2 line-clamp-2 text-xs leading-5 text-lb-muted">{product.description}</p>
      <div className="flex gap-2">{onOpen && <button type="button" onClick={onOpen} className="min-h-10 flex-1 rounded-full border border-lb-navy/10 bg-white/80 px-3 text-xs font-black text-lb-navy">View</button>}{onAdd && <button type="button" onClick={onAdd} className="min-h-10 flex-1 rounded-full bg-lb-navy px-3 text-xs font-black text-white">Add +</button>}</div>
    </div>
  </article>;
}

export function CustomerLandingPage() {
  useEffect(() => track("landing_view", { source: new URLSearchParams(window.location.search).get("utm_source") ?? "direct" }), []);

  return <main className="min-h-screen overflow-hidden bg-[#f4f5f2] text-lb-ink">
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"><div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-lb-blue/10 blur-3xl" /><div className="absolute right-[-120px] top-[20%] size-[420px] rounded-full bg-lb-red/10 blur-3xl" /><div className="absolute bottom-[-180px] left-[30%] size-[500px] rounded-full bg-amber-100/60 blur-3xl" /></div>
    <div className="relative z-10 pt-3"><CustomerHeader /></div>

    <section className="relative z-10 mx-auto grid min-h-[760px] max-w-[1500px] items-center gap-7 px-5 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-16">
      <div className="max-w-2xl">
        <span className="inline-flex rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lb-red shadow-sm backdrop-blur-xl">First-party ordering · SA Gardens</span>
        <h1 className="my-5 text-[clamp(3.1rem,7vw,6.8rem)] font-black leading-[0.88] tracking-[-0.075em] text-lb-navy">Your next bite,<br /><span className="text-lb-red">without the wait.</span></h1>
        <p className="max-w-xl text-base leading-7 text-lb-muted sm:text-lg">Discover London Bite favourites, build your order in seconds, and follow the journey from kitchen to handoff—directly on LondonBite.com.</p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row"><Link href="/order?view=menu" className={`${primary} px-7`}>Start an order <span className="ml-2">→</span></Link><a href={londonBiteFacts.whatsappUrl} onClick={() => track("support_opened", { surface: "landing_hero" })} className={`${secondary} px-7`}>WhatsApp support</a></div>
        <div className="mt-8 grid max-w-lg grid-cols-3 gap-2"><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] font-black uppercase tracking-[0.12em] text-lb-muted">Order mode</span><strong className="mt-1 block text-xs text-lb-navy">Delivery / Pickup</strong></div><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] font-black uppercase tracking-[0.12em] text-lb-muted">Checkout</span><strong className="mt-1 block text-xs text-lb-navy">Guest-first</strong></div><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] font-black uppercase tracking-[0.12em] text-lb-muted">Status</span><strong className="mt-1 block text-xs text-lb-navy">Track online</strong></div></div>
      </div>
      <div className="relative min-h-[520px] lg:min-h-[650px]">
        <div className={`absolute inset-0 overflow-hidden rounded-[42px] p-2 ${glass}`}><img src={popularProducts[1]?.image ?? customerProducts[0].image} alt="London Bite food" className="h-full w-full rounded-[36px] object-cover" /><div className="absolute inset-2 rounded-[36px] bg-gradient-to-t from-lb-navy/85 via-lb-navy/10 to-transparent" /><div className="absolute bottom-7 left-7 right-7 text-white"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">London Bite favourite</span><div className="mt-2 flex items-end justify-between gap-4"><div><strong className="block text-2xl font-black">{popularProducts[1]?.name ?? "Signature favourites"}</strong><small className="mt-1 block text-white/75">Fast food, built for the craving.</small></div><span className="rounded-full bg-white px-4 py-2 text-xs font-black text-lb-navy">From {money(popularProducts[1]?.price ?? 399)}</span></div></div></div>
        <div className={`absolute -bottom-5 -left-3 max-w-[245px] rounded-[25px] p-4 sm:left-[-28px] ${glass}`}><span className="text-[9px] font-black uppercase tracking-[0.12em] text-lb-red">Direct ordering</span><strong className="mt-1 block text-sm text-lb-navy">One journey from craving to tracking.</strong><p className="mb-0 mt-1 text-[11px] leading-4 text-lb-muted">No template booking flow. The homepage now drives the order.</p></div>
      </div>
    </section>

    <section className="relative z-10 mx-auto max-w-[1500px] px-5 py-10 lg:px-8"><div className="mb-5 flex items-end justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Popular right now</span><h2 className="mb-0 mt-2 text-3xl font-black tracking-[-0.04em] text-lb-navy sm:text-4xl">Built for the first scroll.</h2></div><Link href="/order?view=menu" className="hidden text-xs font-black text-lb-navy no-underline sm:block">See full menu →</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{popularProducts.map((product) => <ProductCard key={product.id} product={product} onOpen={() => { track("product_view", { product: product.id, surface: "landing" }); window.location.href = `/order?view=menu&product=${product.slug}`; }} />)}</div></section>

    <section className="relative z-10 mx-auto max-w-[1500px] px-5 py-10 lg:px-8"><div className={`rounded-[38px] p-5 sm:p-7 ${glass}`}><div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Explore your way</span><h2 className="mb-0 mt-2 text-3xl font-black tracking-[-0.04em] text-lb-navy">Choose the craving, not the category maze.</h2></div><p className="m-0 max-w-md text-sm leading-6 text-lb-muted">The customer menu uses fast category switching, search, product details and a persistent cart.</p></div><div className="flex flex-wrap gap-2">{customerCategories.filter((item) => item !== "All").map((category) => <Link key={category} href={`/order?view=menu&category=${encodeURIComponent(category)}`} className="rounded-full border border-lb-navy/10 bg-white/78 px-5 py-3 text-xs font-black text-lb-navy no-underline shadow-sm">{category}</Link>)}</div></div></section>

    <section className="relative z-10 mx-auto grid max-w-[1500px] gap-3 px-5 py-10 lg:grid-cols-3 lg:px-8"><article className={`rounded-[32px] p-6 lg:col-span-2 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Deals, without fake urgency</span><h2 className="mb-3 mt-2 max-w-2xl text-3xl font-black tracking-[-0.04em] text-lb-navy">Offers should be calculated by rules, not hard-coded banners.</h2><p className="max-w-2xl text-sm leading-6 text-lb-muted">The ordering experience is wired to London Bite’s deterministic quote engine, so eligible discounts can be applied consistently without stacking promotions by accident.</p><Link href="/order?view=menu" className={`${primary} mt-3`}>Build a basket</Link></article><article className="relative min-h-[310px] overflow-hidden rounded-[32px]"><img src="https://framerusercontent.com/images/4l2aBJRxrod9MzTtKlzvrWZxk.png?height=1024&width=1536" alt="London Bite food gallery" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-lb-navy/80 to-transparent" /><div className="absolute bottom-5 left-5 right-5 text-white"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/65">London Bite visual language</span><strong className="mt-1 block text-xl font-black">Food stays the hero.</strong></div></article></section>

    <section className="relative z-10 mx-auto grid max-w-[1500px] gap-3 px-5 py-10 md:grid-cols-3 lg:px-8">{[["Order direct", "A first-party menu, cart and checkout foundation instead of sending customers through a generic booking template."], ["Track with context", "Customers can return to their order state without installing an app, with support carrying the order context."], ["Measure the funnel", "Landing, menu, product, cart and checkout events are instrumented from the first customer release."]].map(([title, detail], index) => <article key={title} className={`rounded-[30px] p-6 ${glass}`}><span className="text-[10px] font-black text-lb-red">0{index + 1}</span><h3 className="mb-2 mt-5 text-xl font-black text-lb-navy">{title}</h3><p className="m-0 text-sm leading-6 text-lb-muted">{detail}</p></article>)}</section>

    <section className="relative z-10 mx-auto max-w-[1500px] px-5 py-10 lg:px-8"><div className={`grid overflow-hidden rounded-[38px] lg:grid-cols-[1fr_1.1fr] ${glass}`}><div className="p-7 sm:p-9"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Service area</span><h2 className="mb-3 mt-2 text-3xl font-black tracking-[-0.04em] text-lb-navy">Local, direct, accountable.</h2><p className="text-sm leading-6 text-lb-muted">{londonBiteFacts.area}. Delivery eligibility will be verified at checkout before a production order is accepted.</p><div className="mt-5 flex flex-wrap gap-2"><a href={londonBiteFacts.googleBusinessUrl} className={secondary}>Google Business Profile</a><a href={londonBiteFacts.whatsappUrl} className={secondary}>{londonBiteFacts.whatsappLabel}</a></div></div><div className="relative min-h-[310px]"><img src="https://framerusercontent.com/images/2qrd7mgW022iN2qcCdKkbihSrI.png?height=1024&width=1536" alt="London Bite restaurant experience" className="absolute inset-0 h-full w-full object-cover" /></div></div></section>

    <section className="relative z-10 mx-auto max-w-[1500px] px-5 py-10 lg:px-8"><div className="grid gap-3 sm:grid-cols-3"><div className="sm:col-span-2"><img src="https://framerusercontent.com/images/7hHaPgCVN6K8xFJ1CiYvWJBL0lk.png?height=1024&width=1536" alt="London Bite gallery" className="h-[420px] w-full rounded-[34px] object-cover" /></div><div className="grid gap-3"><img src="https://framerusercontent.com/images/zWGcC9OQe50mdAA9GFb4dDehQ.png?height=1024&width=1024" alt="London Bite food" className="h-[203px] w-full rounded-[30px] object-cover" /><div className={`grid min-h-[203px] place-content-center rounded-[30px] p-5 text-center ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Follow the food</span><a href={londonBiteFacts.instagramUrl} className="mt-2 text-lg font-black text-lb-navy no-underline">@londonbiteofficial →</a></div></div></div></section>

    <footer className="relative z-10 mt-12 bg-lb-navy px-5 py-10 text-white"><div className="mx-auto grid max-w-[1450px] gap-8 sm:grid-cols-2 lg:grid-cols-4"><div><LogoLockup /><p className="mt-4 max-w-xs text-xs leading-5 text-white/60">A direct London Bite customer experience built to connect discovery, ordering and restaurant operations.</p></div><div><strong className="text-xs">Order</strong><div className="mt-3 grid gap-2 text-xs text-white/65"><Link href="/order?view=menu" className="text-inherit no-underline">Menu</Link><Link href="/order?view=track" className="text-inherit no-underline">Track order</Link><Link href="/order?view=history" className="text-inherit no-underline">Order history</Link></div></div><div><strong className="text-xs">Connect</strong><div className="mt-3 grid gap-2 text-xs text-white/65"><a href={londonBiteFacts.instagramUrl} className="text-inherit no-underline">Instagram</a><a href={londonBiteFacts.googleBusinessUrl} className="text-inherit no-underline">Google Business Profile</a><a href={londonBiteFacts.whatsappUrl} className="text-inherit no-underline">WhatsApp</a></div></div><div><strong className="text-xs">Location</strong><p className="mt-3 text-xs leading-5 text-white/65">{londonBiteFacts.area}</p><p className="text-[10px] leading-4 text-white/45">Opening hours are intentionally not copied from the old site until the restaurant owner verifies them.</p></div></div></footer>
  </main>;
}

function OrderNav({ view, onChange }: { view: CustomerView; onChange: (view: CustomerView) => void }) {
  const items: { id: CustomerView; label: string }[] = [{ id: "home", label: "Discover" }, { id: "menu", label: "Menu" }, { id: "track", label: "Track" }, { id: "history", label: "Orders" }, { id: "account", label: "Account" }];
  return <nav className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-[620px] -translate-x-1/2 items-center justify-between rounded-[24px] border border-white/80 bg-white/86 p-2 shadow-[0_18px_55px_rgba(7,24,47,0.15)] backdrop-blur-2xl lg:hidden">{items.map((item) => <button type="button" key={item.id} onClick={() => onChange(item.id)} className={`min-h-11 flex-1 rounded-[17px] px-2 text-[10px] font-black ${view === item.id ? "bg-lb-navy text-white" : "bg-transparent text-lb-muted"}`}>{item.label}</button>)}</nav>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className={`grid min-h-[360px] place-content-center rounded-[32px] p-7 text-center ${glass}`}><div className="mx-auto grid size-14 place-items-center rounded-full bg-lb-navy text-sm font-black text-white">LB</div><h2 className="mb-2 mt-5 text-2xl font-black text-lb-navy">{title}</h2><p className="mx-auto mb-5 mt-0 max-w-md text-sm leading-6 text-lb-muted">{detail}</p>{action}</div>;
}

export function CustomerOrderingApp() {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<CustomerView>("home");
  const [cart, setCart] = useState<CartState>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<CustomerProduct | null>(null);
  const [fulfilment, setFulfilment] = useState<FulfilmentMode>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [profile, setProfile] = useState<CustomerProfile>({ name: "", phone: "", address: "" });
  const [orders, setOrders] = useState<OrderPreview[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderPreview | null>(null);
  const [promoMessage, setPromoMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("view") as CustomerView | null;
    const allowed: CustomerView[] = ["home", "menu", "cart", "checkout", "confirmation", "track", "history", "account"];
    if (requested && allowed.includes(requested)) setView(requested);
    const requestedCategory = params.get("category");
    if (requestedCategory) setCategory(requestedCategory);
    try {
      setCart(JSON.parse(localStorage.getItem("lb.cart") ?? "{}") as CartState);
      setOrders(JSON.parse(localStorage.getItem("lb.orders.preview") ?? "[]") as OrderPreview[]);
      setProfile(JSON.parse(localStorage.getItem("lb.profile") ?? JSON.stringify({ name: "", phone: "", address: "" })) as CustomerProfile);
    } catch {
      localStorage.removeItem("lb.cart");
      localStorage.removeItem("lb.orders.preview");
      localStorage.removeItem("lb.profile");
    }
    const productSlug = params.get("product");
    if (productSlug) setSelectedProduct(customerProducts.find((item) => item.slug === productSlug) ?? null);
    setHydrated(true);
    track("order_app_opened", { initial_view: requested ?? "home" });
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem("lb.cart", JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("lb.profile", JSON.stringify(profile)); }, [profile, hydrated]);

  const go = (next: CustomerView) => {
    setView(next);
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/order?view=${next}`);
    if (next === "menu") track("menu_view");
    if (next === "cart") track("cart_view");
    if (next === "checkout") track("checkout_started", { fulfilment });
    if (next === "track") track("tracking_view", { order: activeOrder?.id });
  };

  const cartLines = useMemo(() => customerProducts.filter((product) => (cart[product.id] ?? 0) > 0).map((product) => ({ product, quantity: cart[product.id] })), [cart]);
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const quote = quoteOrder({ subtotal, paymentMethod });

  const filteredProducts = useMemo(() => customerProducts.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const haystack = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    return matchesCategory && haystack.includes(query.toLowerCase().trim());
  }), [category, query]);

  const openProduct = (product: CustomerProduct) => { setSelectedProduct(product); track("product_view", { product: product.id, surface: "order_app" }); };
  const addProduct = (product: CustomerProduct, quantity = 1) => {
    setCart((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] ?? 0) + quantity) }));
    track("add_to_cart", { product: product.id, quantity, price: product.price });
  };
  const setQuantity = (productId: string, quantity: number) => setCart((current) => ({ ...current, [productId]: Math.max(0, quantity) }));

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile.name.trim() || !profile.phone.trim() || (fulfilment === "delivery" && !profile.address.trim()) || cartLines.length === 0) return;
    const order: OrderPreview = {
      id: `LB-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      fulfilment,
      total: quote.total,
      status: "Accepted",
      items: cartLines.map((line) => ({ id: line.product.id, quantity: line.quantity })),
      customer: profile,
    };
    const nextOrders = [order, ...orders].slice(0, 20);
    setOrders(nextOrders);
    setActiveOrder(order);
    setCart({});
    localStorage.setItem("lb.orders.preview", JSON.stringify(nextOrders));
    track("order_preview_created", { order: order.id, total: order.total, fulfilment, payment: paymentMethod });
    go("confirmation");
  };

  const reorder = (order: OrderPreview) => {
    const nextCart: CartState = {};
    order.items.forEach((item) => { nextCart[item.id] = item.quantity; });
    setCart(nextCart);
    track("reorder_clicked", { order: order.id });
    go("cart");
  };

  const applyPromo = () => {
    if (quote.discountPercent > 0) setPromoMessage(`${quote.discountLabel} is already the best eligible discount (${quote.discountPercent}%). Discounts do not stack.`);
    else setPromoMessage("No configured promotion applies to this basket. No unverified discount has been added.");
  };

  const renderHome = () => <div className="grid gap-3">
    <section className={`relative overflow-hidden rounded-[36px] p-6 sm:p-8 ${glass}`}><div className="absolute -right-20 -top-20 size-72 rounded-full bg-lb-red/10 blur-3xl" /><div className="relative grid gap-6 xl:grid-cols-[1fr_0.86fr] xl:items-center"><div><span className="text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Order direct</span><h1 className="my-3 max-w-2xl text-4xl font-black leading-[0.96] tracking-[-0.055em] text-lb-navy sm:text-6xl">What are you craving right now?</h1><p className="max-w-xl text-sm leading-6 text-lb-muted">Search the menu, choose delivery or pickup, keep your cart as you move around, and track the order from the same experience.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => go("menu")}>Explore menu</button><button type="button" className={secondary} onClick={() => go("history")}>Reorder</button></div></div><div className="grid grid-cols-2 gap-2">{popularProducts.slice(0, 4).map((product) => <button type="button" key={product.id} onClick={() => openProduct(product)} className="group relative aspect-square overflow-hidden rounded-[24px] border-0 bg-[#e8ebef] p-0 text-left"><img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-lb-navy/75 to-transparent" /><span className="absolute bottom-3 left-3 right-3 text-xs font-black text-white">{product.name}</span></button>)}</div></div></section>
    <div className="grid gap-3 md:grid-cols-3">{[["Delivery", "Send it to your saved or entered address."], ["Pickup", "Build the order before you reach the counter."], ["Track", "Return to the order status from any browser."]].map(([title, detail]) => <button type="button" key={title} onClick={() => title === "Track" ? go("track") : go("menu")} className={`rounded-[26px] p-5 text-left ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.12em] text-lb-red">{title}</span><strong className="mt-2 block text-base text-lb-navy">{detail}</strong></button>)}</div>
    <section className={`rounded-[32px] p-5 sm:p-6 ${glass}`}><div className="mb-4 flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Popular</span><h2 className="mb-0 mt-1 text-2xl font-black text-lb-navy">Quick adds</h2></div><button type="button" onClick={() => go("menu")} className="text-xs font-black text-lb-navy">Full menu →</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{popularProducts.map((product) => <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} onAdd={() => addProduct(product)} />)}</div></section>
  </div>;

  const renderMenu = () => <div className="grid gap-3"><section className={`rounded-[30px] p-4 sm:p-5 ${glass}`}><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><label className="grid gap-1.5"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-lb-muted">Search menu</span><input value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value.length === 2) track("search_used", { query: event.target.value }); }} placeholder="Burger, pizza, wings..." className={field} /></label><div className="flex max-w-full items-end gap-2 overflow-x-auto pb-1">{customerCategories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`min-h-12 shrink-0 rounded-full px-4 text-xs font-black ${category === item ? "bg-lb-navy text-white" : "border border-lb-navy/10 bg-white/75 text-lb-navy"}`}>{item}</button>)}</div></div></section>{filteredProducts.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} onAdd={() => addProduct(product)} />)}</div> : <EmptyState title="No match yet" detail="Try another search or switch the category. The menu search never hides your cart." action={<button type="button" className={primary} onClick={() => { setQuery(""); setCategory("All"); }}>Reset menu</button>} />}</div>;

  const renderCart = () => cartLines.length === 0 ? <EmptyState title="Your bag is empty" detail="Add a London Bite favourite and your cart will stay saved in this browser while you continue browsing." action={<button type="button" className={primary} onClick={() => go("menu")}>Browse menu</button>} /> : <div className="grid gap-3 xl:grid-cols-[1fr_390px]"><section className={`rounded-[32px] p-5 ${glass}`}><div className="mb-5 flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Your bag</span><h2 className="mb-0 mt-1 text-2xl font-black text-lb-navy">{cartCount} item{cartCount === 1 ? "" : "s"}</h2></div><button type="button" onClick={() => go("menu")} className="text-xs font-black text-lb-navy">Add more →</button></div><div className="grid gap-2">{cartLines.map(({ product, quantity }) => <div key={product.id} className={`grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-[22px] p-2.5 ${softGlass}`}><img src={product.image} alt="" className="size-[70px] rounded-[17px] object-cover" /><div><strong className="block text-sm text-lb-navy">{product.name}</strong><span className="text-[11px] text-lb-muted">{money(product.price)} each</span><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => setQuantity(product.id, quantity - 1)} className="grid size-8 place-items-center rounded-full border border-lb-navy/10 bg-white text-sm font-black text-lb-navy">−</button><strong className="min-w-5 text-center text-xs">{quantity}</strong><button type="button" onClick={() => setQuantity(product.id, quantity + 1)} className="grid size-8 place-items-center rounded-full bg-lb-navy text-sm font-black text-white">+</button></div></div><strong className="text-sm text-lb-navy">{money(product.price * quantity)}</strong></div>)}</div></section><aside className={`self-start rounded-[32px] p-5 xl:sticky xl:top-24 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Basket summary</span><div className="mt-4 grid gap-2 text-sm"><div className="flex justify-between"><span className="text-lb-muted">Subtotal</span><strong>{money(quote.subtotal)}</strong></div>{quote.discountPercent > 0 && <div className="flex justify-between text-lb-green"><span>{quote.discountLabel} ({quote.discountPercent}%)</span><strong>−{money(quote.discountAmount)}</strong></div>}<div className="mt-2 flex justify-between border-t border-lb-navy/10 pt-4 text-base"><strong className="text-lb-navy">Estimated total</strong><strong className="text-lb-navy">{money(quote.total)}</strong></div></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setFulfilment("delivery"); track("fulfilment_changed", { mode: "delivery" }); }} className={`min-h-12 rounded-[16px] text-xs font-black ${fulfilment === "delivery" ? "bg-lb-navy text-white" : "bg-white/75 text-lb-navy"}`}>Delivery</button><button type="button" onClick={() => { setFulfilment("pickup"); track("fulfilment_changed", { mode: "pickup" }); }} className={`min-h-12 rounded-[16px] text-xs font-black ${fulfilment === "pickup" ? "bg-lb-navy text-white" : "bg-white/75 text-lb-navy"}`}>Pickup</button></div><button type="button" className={`${primary} mt-4 w-full`} onClick={() => go("checkout")}>Continue to checkout</button><p className="mb-0 mt-3 text-[10px] leading-4 text-lb-muted">This branch is a pre-production commerce preview. A production order is not sent until the backend/order adapter is connected and released.</p></aside></div>;

  const renderCheckout = () => <form onSubmit={submitOrder} className="grid gap-3 xl:grid-cols-[1fr_390px]"><section className={`rounded-[32px] p-5 sm:p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Guest checkout</span><h2 className="mb-5 mt-1 text-2xl font-black text-lb-navy">No account required.</h2><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-black text-lb-navy">Name<input required value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className={field} placeholder="Your name" /></label><label className="grid gap-1.5 text-xs font-black text-lb-navy">Phone<input required value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} className={field} inputMode="tel" placeholder="03xx xxxxxxx" /></label></div>{fulfilment === "delivery" && <label className="mt-3 grid gap-1.5 text-xs font-black text-lb-navy">Delivery address<textarea required value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} className={`${field} min-h-28 resize-y py-3`} placeholder="House / street / block / landmark" /></label>}<div className="mt-5"><span className="text-xs font-black text-lb-navy">Payment method</span><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setPaymentMethod("cash")} className={`min-h-16 rounded-[18px] p-3 text-left text-xs font-black ${paymentMethod === "cash" ? "bg-lb-navy text-white" : "border border-lb-navy/10 bg-white/75 text-lb-navy"}`}>Cash <span className={`mt-1 block text-[10px] font-normal ${paymentMethod === "cash" ? "text-white/65" : "text-lb-muted"}`}>Pay on delivery / pickup</span></button><button type="button" onClick={() => setPaymentMethod("online")} className={`min-h-16 rounded-[18px] p-3 text-left text-xs font-black ${paymentMethod === "online" ? "bg-lb-navy text-white" : "border border-lb-navy/10 bg-white/75 text-lb-navy"}`}>Online <span className={`mt-1 block text-[10px] font-normal ${paymentMethod === "online" ? "text-white/65" : "text-lb-muted"}`}>Quote logic ready; live gateway still release-gated</span></button></div></div><div className="mt-5"><label className="grid gap-1.5 text-xs font-black text-lb-navy">Promotion / membership<input className={field} placeholder="Configured offers apply automatically" readOnly /></label><button type="button" onClick={applyPromo} className="mt-2 text-[11px] font-black text-lb-blue">Check eligibility</button>{promoMessage && <p className="mt-2 rounded-[14px] bg-lb-blue/5 p-3 text-[11px] leading-5 text-lb-muted">{promoMessage}</p>}</div></section><aside className={`self-start rounded-[32px] p-5 xl:sticky xl:top-24 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Review</span><div className="my-4 grid gap-2">{cartLines.map(({ product, quantity }) => <div className="flex justify-between gap-3 text-xs" key={product.id}><span>{quantity} × {product.name}</span><strong>{money(product.price * quantity)}</strong></div>)}</div><div className="grid gap-2 border-t border-lb-navy/10 pt-4 text-sm"><div className="flex justify-between"><span className="text-lb-muted">Subtotal</span><strong>{money(quote.subtotal)}</strong></div>{quote.discountPercent > 0 && <div className="flex justify-between text-lb-green"><span>{quote.discountLabel}</span><strong>−{money(quote.discountAmount)}</strong></div>}<div className="flex justify-between pt-2 text-base"><strong>Total</strong><strong>{money(quote.total)}</strong></div></div><button type="submit" className={`${primary} mt-5 w-full`} disabled={cartLines.length === 0}>Create preview order</button><p className="mb-0 mt-3 text-[10px] leading-4 text-lb-muted">Safety gate: this feature branch creates a browser-local preview order only. It does not charge or transmit an order to restaurant operations.</p></aside></form>;

  const renderConfirmation = () => activeOrder ? <div className="mx-auto max-w-3xl"><section className={`rounded-[36px] p-7 text-center sm:p-10 ${glass}`}><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eaf8f0] text-2xl font-black text-lb-green">✓</span><span className="mt-5 block text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Preview order created</span><h2 className="mb-2 mt-2 text-3xl font-black tracking-[-0.04em] text-lb-navy">{activeOrder.id}</h2><p className="mx-auto max-w-lg text-sm leading-6 text-lb-muted">The customer journey is complete through confirmation. This remains a preview until the production order backend and payment adapter are released.</p><div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2"><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] uppercase tracking-[0.12em] text-lb-muted">Mode</span><strong className="mt-1 block text-xs capitalize text-lb-navy">{activeOrder.fulfilment}</strong></div><div className={`rounded-[18px] p-3 ${softGlass}`}><span className="block text-[9px] uppercase tracking-[0.12em] text-lb-muted">Total</span><strong className="mt-1 block text-xs text-lb-navy">{money(activeOrder.total)}</strong></div></div><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><button type="button" className={primary} onClick={() => go("track")}>Track this order</button><button type="button" className={secondary} onClick={() => go("menu")}>Start another</button></div></section></div> : <EmptyState title="No active order" detail="Create a preview order first, or open order history to select a previous preview." action={<button type="button" className={primary} onClick={() => go("menu")}>Open menu</button>} />;

  const renderTrack = () => {
    const order = activeOrder ?? orders[0] ?? null;
    if (!order) return <EmptyState title="Nothing to track yet" detail="Once an order is created, this surface will show its timeline without requiring an app installation." action={<button type="button" className={primary} onClick={() => go("menu")}>Start an order</button>} />;
    const steps = order.fulfilment === "delivery" ? ["Accepted", "Preparing", "Ready", "Out for Delivery", "Delivered"] : ["Accepted", "Preparing", "Ready", "Delivered"];
    const currentIndex = Math.max(0, steps.indexOf(order.status));
    return <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]"><section className={`rounded-[32px] p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Order {order.id}</span><h2 className="mb-2 mt-2 text-3xl font-black tracking-[-0.04em] text-lb-navy">{order.status}</h2><p className="text-sm leading-6 text-lb-muted">Preview timeline for the customer experience. Production events will replace this local state when the operations backend is connected.</p><div className="mt-7 grid gap-2 sm:grid-cols-5">{steps.map((step, index) => <div key={step} className={`rounded-[18px] p-3 ${index <= currentIndex ? "bg-lb-navy text-white" : "border border-lb-navy/10 bg-white/65 text-lb-muted"}`}><span className="block text-[9px] font-black">0{index + 1}</span><strong className="mt-1 block text-[10px]">{step}</strong></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><a href={`${londonBiteFacts.whatsappUrl}?text=${encodeURIComponent(`London Bite order ${order.id}`)}`} onClick={() => track("support_opened", { surface: "tracking", order: order.id })} className={secondary}>Support with order ID</a><button type="button" className={secondary} onClick={() => go("history")}>Order history</button></div></section><aside className={`rounded-[32px] p-5 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Order summary</span><div className="mt-4 grid gap-2">{order.items.map((line) => { const product = customerProducts.find((item) => item.id === line.id); return product ? <div className="flex justify-between gap-3 text-xs" key={line.id}><span>{line.quantity} × {product.name}</span><strong>{money(product.price * line.quantity)}</strong></div> : null; })}</div><div className="mt-4 flex justify-between border-t border-lb-navy/10 pt-4 text-sm"><strong>Total</strong><strong>{money(order.total)}</strong></div></aside></div>;
  };

  const renderHistory = () => orders.length === 0 ? <EmptyState title="No order history yet" detail="Your preview orders will appear here with one-tap reorder. Production history will later be account-backed rather than browser-local." action={<button type="button" className={primary} onClick={() => go("menu")}>Place first order</button>} /> : <div className="grid gap-3"><section className={`rounded-[32px] p-5 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Order history</span><h2 className="mb-5 mt-1 text-2xl font-black text-lb-navy">Order again without rebuilding the basket.</h2><div className="grid gap-2">{orders.map((order) => <article key={order.id} className={`grid gap-3 rounded-[22px] p-4 sm:grid-cols-[1fr_auto] sm:items-center ${softGlass}`}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-lb-navy">{order.id}</strong><span className="rounded-full bg-lb-navy/5 px-2 py-1 text-[9px] font-black uppercase text-lb-muted">{order.fulfilment}</span></div><p className="mb-0 mt-1 text-[11px] text-lb-muted">{new Date(order.createdAt).toLocaleString("en-PK")} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {money(order.total)}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setActiveOrder(order); go("track"); }} className="min-h-10 rounded-full border border-lb-navy/10 bg-white/80 px-4 text-xs font-black text-lb-navy">Track</button><button type="button" onClick={() => reorder(order)} className="min-h-10 rounded-full bg-lb-navy px-4 text-xs font-black text-white">Reorder</button></div></article>)}</div></section></div>;

  const renderAccount = () => <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]"><section className={`rounded-[32px] p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Customer profile</span><h2 className="mb-5 mt-1 text-2xl font-black text-lb-navy">Make the next checkout faster.</h2><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-black text-lb-navy">Name<input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className={field} placeholder="Your name" /></label><label className="grid gap-1.5 text-xs font-black text-lb-navy">Phone<input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} className={field} placeholder="03xx xxxxxxx" /></label></div><label className="mt-3 grid gap-1.5 text-xs font-black text-lb-navy">Default address<textarea value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} className={`${field} min-h-28 resize-y py-3`} placeholder="Saved delivery address" /></label><p className="mb-0 mt-4 text-[10px] leading-4 text-lb-muted">Preview privacy boundary: this branch stores profile data only in this browser. Production accounts will require authenticated storage, consent and deletion controls.</p></section><section className={`rounded-[32px] p-6 ${glass}`}><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">Customer value</span><h2 className="mb-3 mt-1 text-2xl font-black text-lb-navy">Retention comes after a good first order.</h2><div className="grid gap-2">{[["Reorder", "One tap from your previous basket."], ["Saved address", "Reduce friction on repeat delivery."], ["Loyalty ready", "Add points/stamps only after economics are approved."], ["Consent-led offers", "No silent marketing opt-in."]].map(([title, detail]) => <div key={title} className={`rounded-[19px] p-3.5 ${softGlass}`}><strong className="text-xs text-lb-navy">{title}</strong><p className="mb-0 mt-1 text-[11px] leading-4 text-lb-muted">{detail}</p></div>)}</div></section></div>;

  const renderView = () => {
    if (view === "home") return renderHome();
    if (view === "menu") return renderMenu();
    if (view === "cart") return renderCart();
    if (view === "checkout") return renderCheckout();
    if (view === "confirmation") return renderConfirmation();
    if (view === "track") return renderTrack();
    if (view === "history") return renderHistory();
    return renderAccount();
  };

  return <main className="min-h-screen bg-[#f4f6f3] pb-28 text-lb-ink lg:pb-8"><div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"><div className="absolute -left-28 -top-28 size-[400px] rounded-full bg-lb-blue/10 blur-3xl" /><div className="absolute right-[-100px] top-[12%] size-[360px] rounded-full bg-lb-red/10 blur-3xl" /></div><div className="relative z-10 pt-3"><CustomerHeader cartCount={cartCount} onCart={() => go("cart")} /><div className="mx-auto mt-4 hidden max-w-[1450px] items-center gap-1 px-5 lg:flex">{([{ id: "home", label: "Discover" }, { id: "menu", label: "Menu" }, { id: "track", label: "Track order" }, { id: "history", label: "Order history" }, { id: "account", label: "Account" }] as { id: CustomerView; label: string }[]).map((item) => <button type="button" key={item.id} onClick={() => go(item.id)} className={`rounded-full px-4 py-2 text-xs font-black ${view === item.id ? "bg-lb-navy text-white" : "text-lb-muted hover:bg-white/70"}`}>{item.label}</button>)}</div><div className="mx-auto mt-4 max-w-[1450px] px-4 sm:px-5 lg:px-6">{hydrated ? renderView() : <div className={`h-[520px] animate-pulse rounded-[34px] ${glass}`} />}</div></div>{selectedProduct && <div className="fixed inset-0 z-50 grid place-items-end bg-lb-navy/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedProduct(null); }}><section className="max-h-[92vh] w-full max-w-[760px] overflow-auto rounded-t-[34px] border border-white/80 bg-[#f7f8f5] p-3 shadow-2xl sm:rounded-[34px]"><ProductVisual product={selectedProduct} priority /><div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-lb-red">{selectedProduct.category}</span><h2 className="mb-0 mt-1 text-3xl font-black tracking-[-0.04em] text-lb-navy">{selectedProduct.name}</h2></div><button type="button" onClick={() => setSelectedProduct(null)} className="grid size-10 place-items-center rounded-full bg-white text-lg font-black text-lb-navy shadow-sm">×</button></div><p className="mt-3 text-sm leading-6 text-lb-muted">{selectedProduct.description}</p><div className="mt-5 flex items-center justify-between gap-3"><strong className="text-2xl text-lb-navy">{money(selectedProduct.price)}</strong><button type="button" className={primary} onClick={() => { addProduct(selectedProduct); setSelectedProduct(null); }}>Add to bag +</button></div><div className="mt-4 rounded-[18px] bg-white/75 p-3 text-[10px] leading-4 text-lb-muted">Modifier/add-on UI is structurally ready for the production catalog adapter. The current repository seed does not contain verified modifier records, so none are invented here.</div></div></section></div>}<OrderNav view={view} onChange={go} /></main>;
}
