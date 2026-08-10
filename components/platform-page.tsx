"use client";

import { useMemo, useState } from "react";
import type { PlatformRoute } from "@/lib/platform";
import { evaluateCheckIn, evaluateRiderKpi, quoteOrder } from "@/lib/business-rules";

const money = (value: number) => `Rs ${Math.round(value).toLocaleString("en-PK")}`;

const menu = [
  { id: "fillet", name: "Fillet Burger", price: 399, category: "Burgers" },
  { id: "peri", name: "Peri Peri Burger", price: 699, category: "Burgers" },
  { id: "tower", name: "Tower Burger", price: 899, category: "Burgers" },
  { id: "pizza-classic", name: "Classic Pizza", price: 599, category: "Pizza" },
  { id: "pizza-premium", name: "Premium Pizza", price: 1449, category: "Pizza" },
  { id: "broast", name: "Quarter Broast", price: 799, category: "Fried" },
  { id: "paratha", name: "Pizza Paratha", price: 550, category: "Sides" },
  { id: "wings", name: "Wings 10 pcs", price: 699, category: "Sides" },
];

function SectionHeader({ route }: { route: PlatformRoute }) {
  return <div className="pageHead"><div><span className="eyebrow">{route.module}</span><h1>{route.title}</h1><p>{route.purpose}</p></div><span className="routeTag">{route.path}</span></div>;
}

function Dashboard() {
  const metrics = [
    ["Live Orders", "18", "+4 last hour"],
    ["Preparing", "7", "Target 15–17 min"],
    ["Ready", "3", "Awaiting handoff"],
    ["Today Sales", "Rs 67,480", "Live counter total"],
  ];
  return <>
    <div className="metricGrid">{metrics.map(([label, value, note]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="twoCol">
      <section className="panel"><div className="panelTitle"><h2>Order pulse</h2><span className="statusPill good">Live</span></div><div className="orderList">
        {[["LBSAG-0184", "Preparing", "Rs 2,149"], ["LBSAG-0183", "Out for Delivery", "Rs 1,698"], ["LBSAG-0182", "Ready", "Rs 899"], ["LBSAG-0181", "Accepted", "Rs 2,399"]].map((o) => <div className="orderRow" key={o[0]}><strong>{o[0]}</strong><span>{o[1]}</span><b>{o[2]}</b></div>)}
      </div></section>
      <section className="panel"><div className="panelTitle"><h2>Needs attention</h2><span>Operations</span></div><div className="alertStack"><div className="alert warn"><b>Kitchen SLA</b><span>2 tickets are above 17 minutes.</span></div><div className="alert"><b>Attendance</b><span>1 employee check-in is outside the normal window.</span></div><div className="alert goodBox"><b>Delivery</b><span>Active rider jobs are currently within KPI.</span></div></div></section>
    </div>
  </>;
}

function OrderComposer() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"cash" | "online">("cash");
  const [membership, setMembership] = useState(0);
  const subtotal = useMemo(() => menu.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0), [cart]);
  const quote = quoteOrder({ subtotal, paymentMethod: payment, membershipPercent: membership });
  const add = (id: string) => setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  return <div className="posGrid">
    <section className="panel"><div className="panelTitle"><h2>Menu</h2><span>Tap to add</span></div><div className="menuGrid">{menu.map((item) => <button className="menuCard" key={item.id} onClick={() => add(item.id)}><small>{item.category}</small><strong>{item.name}</strong><span>{money(item.price)}</span></button>)}</div></section>
    <section className="panel cart"><div className="panelTitle"><h2>Current bill</h2><span>LBSAG next</span></div>
      <div className="cartLines">{Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => { const item = menu.find((entry) => entry.id === id)!; return <div className="cartLine" key={id}><span>{qty} × {item.name}</span><strong>{money(item.price * qty)}</strong></div>; })}{subtotal === 0 && <div className="empty">Add an item to start the order.</div>}</div>
      <label className="field">Payment<select value={payment} onChange={(e) => setPayment(e.target.value as "cash" | "online")}><option value="cash">Cash</option><option value="online">Online</option></select></label>
      <label className="field">Membership discount<select value={membership} onChange={(e) => setMembership(Number(e.target.value))}><option value={0}>No membership</option><option value={5}>5%</option><option value={10}>10%</option></select></label>
      <div className="totals"><div><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div><div><span>{quote.discountLabel} ({quote.discountPercent}%)</span><strong>-{money(quote.discountAmount)}</strong></div><div className="grand"><span>Total</span><strong>{money(quote.total)}</strong></div></div>
      <button className="primaryButton" disabled={subtotal === 0}>Punch order</button><p className="micro">The engine applies the highest eligible discount rather than stacking promotions.</p>
    </section>
  </div>;
}

function KitchenBoard() {
  const tickets = [
    { bill: "0184", mins: 9, items: "Tower Burger ×1 · Wings ×1", state: "Preparing" },
    { bill: "0185", mins: 15, items: "Premium Pizza ×1", state: "Preparing" },
    { bill: "0186", mins: 4, items: "Peri Peri Burger ×2", state: "Accepted" },
  ];
  return <div className="ticketGrid">{tickets.map((ticket) => <article className="ticket" key={ticket.bill}><div><span className="eyebrow">LBSAG-{ticket.bill}</span><strong>{ticket.state}</strong></div><div className={`timer ${ticket.mins >= 15 ? "hot" : ""}`}>{ticket.mins}<small>min</small></div><p>{ticket.items}</p><div className="ticketActions"><button>Preparing</button><button className="primaryButton">Ready</button></div></article>)}</div>;
}

function AttendancePanel({ management = false }: { management?: boolean }) {
  const [time, setTime] = useState("15:12");
  const [distance, setDistance] = useState(35);
  const result = evaluateCheckIn(time, distance);
  return <div className="twoCol"><section className="panel"><div className="panelTitle"><h2>{management ? "Attendance simulator" : "Check-in"}</h2><span>100m geofence</span></div><label className="field">Check-in time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label><label className="field">Distance from restaurant<input type="number" min={0} value={distance} onChange={(e) => setDistance(Number(e.target.value))} /><small>metres</small></label><div className={`resultBox ${result.accepted ? "ok" : "bad"}`}><strong>{result.status.replaceAll("-", " ")}</strong><span>{result.reason}</span><b>{result.fine === 0 ? "No fine" : result.fine === "full-shift" ? "Full shift cut" : `Fine: Rs ${result.fine}`}</b></div></section><section className="panel"><div className="panelTitle"><h2>Policy</h2><span>Current</span></div><ul className="policyList"><li>Check-in: 2:50 PM–3:05 PM</li><li>After 3:05 PM: Rs 200</li><li>After 4:00 PM: Rs 500</li><li>After 5:00 PM: full shift cut</li><li>Checkout: 3:00 AM–3:20 AM</li><li>Outside 100m: attendance rejected</li></ul></section></div>;
}

function RiderDelivery() {
  const kpi = evaluateRiderKpi(3, 22);
  return <div className="twoCol"><section className="panel"><div className="panelTitle"><h2>Active delivery</h2><span className="statusPill good">GPS active</span></div><div className="deliveryHero"><span className="eyebrow">LBSAG-0183</span><h2>Faisal Block · House 128</h2><p>Customer tracking link is active. Rider location should stream only during the delivery session.</p></div><div className="timeline"><span className="done">Order ready</span><span className="done">Rider assigned</span><span className="done">Out for delivery</span><span>Delivered</span></div><button className="primaryButton">Mark delivered</button></section><section className="panel"><div className="panelTitle"><h2>Delivery KPI</h2><span>3-order route</span></div><div className="bigKpi"><strong>{kpi.actualMinutes} min</strong><span>Target ≤ {kpi.targetMinutes} min</span><b>{kpi.late ? `Fine Rs ${kpi.fine}` : "Within KPI"}</b></div></section></div>;
}

function CustomerTrack() {
  return <section className="customerCard"><div className="customerBrand"><span className="brandMark">LB</span><div><strong>London Bite</strong><small>Every Bite, A London Story</small></div></div><span className="eyebrow">Order LBSAG-0183</span><h1>Your order is on the way</h1><p>Rider is currently delivering your order in Faisal Block.</p><div className="trackProgress"><div className="complete">Accepted</div><div className="complete">Preparing</div><div className="complete">Ready</div><div className="complete">On the way</div><div>Delivered</div></div><div className="mapMock"><span>Live delivery GPS</span><strong>Rider location appears here</strong><small>Location sharing ends after delivery.</small></div><div className="customerFoot"><span>Estimated status</span><strong>Arriving soon</strong></div></section>;
}

function GenericScreen({ route }: { route: PlatformRoute }) {
  return <div className="twoCol"><section className="panel"><div className="panelTitle"><h2>Core features</h2><span>{route.features.length}</span></div><div className="featureGrid">{route.features.map((feature, index) => <div className="feature" key={feature}><span>0{index + 1}</span><strong>{feature}</strong><p>Operational control for {route.module.toLowerCase()} workflow.</p></div>)}</div></section><section className="panel"><div className="panelTitle"><h2>System contract</h2><span>Migration</span></div><ul className="policyList"><li>Role-scoped access is required before production data is exposed.</li><li>Critical mutations must be auditable.</li><li>Uploads are capped at 5MB where required.</li><li>Production persistence must use the database adapter, not browser state.</li><li>Secrets stay in Vercel environment variables.</li></ul></section></div>;
}

export function PlatformPage({ route }: { route: PlatformRoute }) {
  let body;
  if (route.path === "/management/dashboard" || route.path === "/ipos" || route.path === "/kitchen" || route.path === "/rider" || route.path === "/employee") body = <Dashboard />;
  else if (route.path === "/ipos/new-order") body = <OrderComposer />;
  else if (route.module === "Kitchen") body = <KitchenBoard />;
  else if (route.path === "/management/attendance") body = <AttendancePanel management />;
  else if (route.path === "/employee/attendance") body = <AttendancePanel />;
  else if (route.path === "/rider/active-delivery") body = <RiderDelivery />;
  else if (route.path === "/customer/track") body = <CustomerTrack />;
  else body = <GenericScreen route={route} />;

  return <><SectionHeader route={route} />{body}</>;
}
