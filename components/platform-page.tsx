"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import type { PlatformRoute } from "@/lib/platform";
import { evaluateCheckIn, evaluateRiderKpi, quoteOrder } from "@/lib/business-rules";

const money = (value: number) => `Rs ${Math.round(value).toLocaleString("en-PK")}`;
const glassPanel = "rounded-[28px] border border-white/75 bg-white/70 p-5 shadow-[0_18px_55px_rgba(7,24,47,0.07)] backdrop-blur-2xl";
const softGlass = "rounded-[20px] border border-white/80 bg-white/60 backdrop-blur-xl";
const eyebrow = "text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue";
const muted = "text-xs text-lb-muted";
const primaryButton = "rounded-[14px] border border-lb-navy bg-lb-navy px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(7,24,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0b2748] disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "rounded-[14px] border border-white/90 bg-white/75 px-4 py-2.5 text-sm font-black text-lb-navy shadow-sm backdrop-blur-xl transition hover:bg-white";
const input = "rounded-[14px] border border-white/90 bg-white/75 px-3 py-2.5 text-lb-ink shadow-inner outline-none backdrop-blur-xl focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";

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

const demoStaff = [
  { id: "LB-1007", name: "Demo Shift Manager", role: "Shift Manager", station: "Front Counter", shift: "3:00 PM – 3:00 AM", status: "On shift", attendance: "On time" },
  { id: "LB-1016", name: "Demo Kitchen Crew", role: "Kitchen Crew", station: "Hot Kitchen", shift: "3:00 PM – 3:00 AM", status: "On shift", attendance: "On time" },
  { id: "LB-1024", name: "Demo Cashier", role: "Cashier", station: "iPOS 01", shift: "3:00 PM – 3:00 AM", status: "On shift", attendance: "Late" },
  { id: "LB-1033", name: "Demo Rider", role: "Rider", station: "Delivery", shift: "4:00 PM – 2:00 AM", status: "Delivery", attendance: "On time" },
];

function PanelTitle({ title, meta }: { title: string; meta: ReactNode }) {
  return <div className="mb-4 flex items-center justify-between gap-3"><h2 className="m-0 text-base font-bold text-lb-navy">{title}</h2><span className="text-[10px] text-lb-muted">{meta}</span></div>;
}

function SectionHeader({ route }: { route: PlatformRoute }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div><span className={eyebrow}>{route.module}</span><h1 className="my-1 text-[30px] font-bold tracking-[-0.04em] text-lb-navy">{route.title}</h1><p className="m-0 max-w-2xl text-sm text-lb-muted">{route.purpose}</p></div>
      <span className="hidden rounded-full border border-white/80 bg-white/60 px-3 py-1.5 font-mono text-[10px] text-lb-muted backdrop-blur-xl md:inline">{route.path}</span>
    </div>
  );
}

function Dashboard() {
  const metrics = [["Live Orders", "18", "+4 last hour"], ["Preparing", "7", "Target 15–17 min"], ["Ready", "3", "Awaiting handoff"], ["Today Sales", "Rs 67,480", "Live counter total"]];
  return <>
    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, note]) => <article className={`${glassPanel} grid gap-2`} key={label}><span className={muted}>{label}</span><strong className="text-[27px] tracking-[-0.04em] text-lb-navy">{value}</strong><small className={muted}>{note}</small></article>)}</div>
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
      <section className={glassPanel}><PanelTitle title="Order pulse" meta={<span className="rounded-full bg-[#eaf8f0] px-2.5 py-1 font-bold text-lb-green">Live</span>} />{[["LBSAG-0184", "Preparing", "Rs 2,149"], ["LBSAG-0183", "Out for Delivery", "Rs 1,698"], ["LBSAG-0182", "Ready", "Rs 899"], ["LBSAG-0181", "Accepted", "Rs 2,399"]].map((o) => <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-lb-navy/5 py-3 last:border-b-0" key={o[0]}><strong className="text-sm text-lb-navy">{o[0]}</strong><span className={muted}>{o[1]}</span><b className="text-xs">{o[2]}</b></div>)}</section>
      <section className={glassPanel}><PanelTitle title="Needs attention" meta="Operations" /><div className="grid gap-2"><div className={`${softGlass} border-l-4 border-l-lb-amber p-3`}><b className="text-sm text-lb-navy">Kitchen SLA</b><span className="mt-1 block text-xs text-lb-muted">2 tickets are above 17 minutes.</span></div><div className={`${softGlass} border-l-4 border-l-lb-blue p-3`}><b className="text-sm text-lb-navy">Attendance</b><span className="mt-1 block text-xs text-lb-muted">1 employee check-in is outside the normal window.</span></div><div className={`${softGlass} border-l-4 border-l-lb-green p-3`}><b className="text-sm text-lb-navy">Delivery</b><span className="mt-1 block text-xs text-lb-muted">Active rider jobs are currently within KPI.</span></div></div></section>
    </div>
  </>;
}

function EmployeeHome() {
  const tasks = [
    { label: "Station readiness", detail: "Confirm counter, printer and cash drawer before service.", done: true },
    { label: "Uniform & hygiene check", detail: "Complete the shift-start hygiene checklist.", done: true },
    { label: "Mid-shift station reset", detail: "Clean and restock the assigned station at 8:00 PM.", done: false },
    { label: "Shift close", detail: "Complete handover before checkout.", done: false },
  ];

  return <div className="grid gap-3">
    <section className={`${glassPanel} overflow-hidden`}>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-[22px] bg-lb-navy text-lg font-black text-white shadow-[0_14px_30px_rgba(7,24,47,0.2)]">LB</div>
          <div><span className={eyebrow}>Employee LB-1042</span><h2 className="my-1 text-2xl font-bold text-lb-navy">Today’s shift</h2><p className="m-0 text-sm text-lb-muted">Crew Member · SA Gardens · Front Counter</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className={`${softGlass} p-3 text-center`}><span className="block text-[10px] text-lb-muted">Starts</span><strong className="text-sm text-lb-navy">3:00 PM</strong></div>
          <div className={`${softGlass} p-3 text-center`}><span className="block text-[10px] text-lb-muted">Ends</span><strong className="text-sm text-lb-navy">3:00 AM</strong></div>
          <div className={`${softGlass} col-span-2 p-3 text-center sm:col-span-1`}><span className="block text-[10px] text-lb-muted">Status</span><strong className="text-sm text-lb-green">On shift</strong></div>
        </div>
      </div>
    </section>

    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
      <section className={glassPanel}>
        <PanelTitle title="Today’s work" meta="2 of 4 complete" />
        <div className="grid gap-2">{tasks.map((task, index) => <div className={`${softGlass} flex gap-3 p-3.5`} key={task.label}><span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${task.done ? "bg-[#e7f6ee] text-lb-green" : "bg-[#eef4fa] text-lb-blue"}`}>{task.done ? "✓" : index + 1}</span><div><strong className="block text-sm text-lb-navy">{task.label}</strong><p className="mb-0 mt-1 text-xs leading-5 text-lb-muted">{task.detail}</p></div></div>)}</div>
      </section>
      <section className={glassPanel}>
        <PanelTitle title="Shift actions" meta="Employee" />
        <div className="grid grid-cols-2 gap-2">
          {["Check attendance", "Request leave", "View pay", "Read notices"].map((action) => <button className={`${softGlass} min-h-24 p-3 text-left text-sm font-black text-lb-navy transition hover:bg-white/85`} key={action}>{action}<span className="mt-2 block text-[10px] font-normal text-lb-muted">Open employee workspace</span></button>)}
        </div>
        <div className="mt-3 rounded-[20px] border border-[#cfeede] bg-[#eaf8f0]/75 p-4 backdrop-blur-xl"><span className={eyebrow}>Attendance</span><strong className="mt-1 block text-sm text-lb-green">Checked in on time</strong><p className="mb-0 mt-1 text-xs text-lb-muted">3:01 PM · inside restaurant geofence</p></div>
      </section>
    </div>

    <section className={glassPanel}>
      <PanelTitle title="Latest notice" meta="Management · Today" />
      <div className={`${softGlass} p-4`}><strong className="text-sm text-lb-navy">Weekend service briefing</strong><p className="mb-0 mt-1 text-xs leading-5 text-lb-muted">All front-counter and kitchen employees should complete station readiness before the 5:30 PM rush. Shift manager will confirm handover responsibilities.</p></div>
    </section>
  </div>;
}

function EmployeeProfile() {
  const rows = [["Employee ID", "LB-1042"], ["Role", "Crew Member"], ["Branch", "SA Gardens"], ["Primary station", "Front Counter"], ["Joining date", "12 May 2026"], ["Employment status", "Active"]];
  const docs = [["Identity document", "On file"], ["Employment contract", "Signed"], ["Emergency contact", "Complete"], ["Medical record", "Review due"]];

  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
    <section className={glassPanel}><PanelTitle title="Employment profile" meta="Employee LB-1042" /><div className="grid gap-1">{rows.map(([label, value]) => <div className="flex items-center justify-between gap-4 border-b border-lb-navy/5 py-3 last:border-0" key={label}><span className="text-xs text-lb-muted">{label}</span><strong className="text-right text-sm text-lb-navy">{value}</strong></div>)}</div><button className={`${secondaryButton} mt-4`}>Request profile correction</button></section>
    <section className={glassPanel}><PanelTitle title="My documents" meta="4 records" /><div className="grid gap-2">{docs.map(([label, status]) => <div className={`${softGlass} flex items-center justify-between gap-3 p-3.5`} key={label}><div><strong className="block text-sm text-lb-navy">{label}</strong><span className="text-[10px] text-lb-muted">Management-controlled record</span></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${status === "Review due" ? "bg-[#fff6dc] text-[#8a6200]" : "bg-[#eaf8f0] text-lb-green"}`}>{status}</span></div>)}</div></section>
  </div>;
}

function StaffDirectory() {
  const [query, setQuery] = useState("");
  const filtered = demoStaff.filter((employee) => `${employee.id} ${employee.name} ${employee.role}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="grid gap-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["Active staff", "24", "Across all roles"], ["On shift", "18", "Current service window"], ["Needs attention", "2", "Attendance or documents"]].map(([label, value, note]) => <article className={`${glassPanel} grid gap-1`} key={label}><span className={muted}>{label}</span><strong className="text-3xl tracking-[-0.04em] text-lb-navy">{value}</strong><small className={muted}>{note}</small></article>)}
    </div>
    <section className={glassPanel}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PanelTitle title="Staff directory" meta="Demo data · backend not connected" /><input className={`${input} w-full sm:w-72`} placeholder="Search employee or role" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-xs"><thead><tr className="text-lb-muted"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Station</th><th className="px-3 py-2">Shift</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{filtered.map((employee) => <tr className="bg-white/60 backdrop-blur-xl" key={employee.id}><td className="rounded-l-[16px] px-3 py-3"><strong className="block text-lb-navy">{employee.name}</strong><span className="text-[10px] text-lb-muted">{employee.id}</span></td><td className="px-3 py-3">{employee.role}</td><td className="px-3 py-3">{employee.station}</td><td className="px-3 py-3">{employee.shift}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${employee.attendance === "Late" ? "bg-[#fff6dc] text-[#8a6200]" : "bg-[#eaf8f0] text-lb-green"}`}>{employee.attendance}</span></td><td className="rounded-r-[16px] px-3 py-3 font-bold text-lb-navy">{employee.status}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex flex-wrap gap-2"><button className={primaryButton}>Add employee</button><button className={secondaryButton}>Manage documents</button><button className={secondaryButton}>Open contracts</button></div>
    </section>
  </div>;
}

function EmployeeLeave() {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
    <section className={glassPanel}><PanelTitle title="Request leave" meta="Manager approval required" /><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-extrabold text-lb-navy">From<input className={input} type="date" /></label><label className="grid gap-1.5 text-xs font-extrabold text-lb-navy">To<input className={input} type="date" /></label></div><label className="mt-3 grid gap-1.5 text-xs font-extrabold text-lb-navy">Reason<textarea className={`${input} min-h-28 resize-y`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the leave request" /></label><button className={`${primaryButton} mt-4`} disabled={!reason.trim()} onClick={() => setSubmitted(true)}>Submit request</button>{submitted && <div className="mt-3 rounded-[16px] bg-[#eaf8f0] p-3 text-xs font-bold text-lb-green">Request prepared for manager review. Production persistence will be connected in the backend phase.</div>}</section>
    <section className={glassPanel}><PanelTitle title="Leave history" meta="Current year" /><div className="grid gap-2">{[["18 Jul 2026", "Approved", "1 day"], ["02 Jun 2026", "Approved", "1 day"], ["21 Aug 2026", "Pending", "2 days"]].map(([date, status, duration]) => <div className={`${softGlass} flex items-center justify-between gap-3 p-3.5`} key={date}><div><strong className="text-sm text-lb-navy">{date}</strong><span className="mt-1 block text-[10px] text-lb-muted">{duration}</span></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${status === "Pending" ? "bg-[#fff6dc] text-[#8a6200]" : "bg-[#eaf8f0] text-lb-green"}`}>{status}</span></div>)}</div></section>
  </div>;
}

function EmployeePayroll() {
  const deductions = [["Late attendance", 200], ["Advance recovery", 1000]];
  const gross = 9000;
  const totalDeductions = deductions.reduce((sum, [, amount]) => sum + Number(amount), 0);
  const net = gross - totalDeductions;

  return <div className="grid gap-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><article className={`${glassPanel} grid gap-1`}><span className={muted}>Weekly gross</span><strong className="text-3xl text-lb-navy">{money(gross)}</strong><small className={muted}>Current payroll period</small></article><article className={`${glassPanel} grid gap-1`}><span className={muted}>Deductions</span><strong className="text-3xl text-lb-red">-{money(totalDeductions)}</strong><small className={muted}>Attendance + approved recovery</small></article><article className={`${glassPanel} grid gap-1`}><span className={muted}>Estimated net</span><strong className="text-3xl text-lb-green">{money(net)}</strong><small className={muted}>Before payroll close</small></article></div>
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]"><section className={glassPanel}><PanelTitle title="Pay breakdown" meta="This week" /><div className="flex justify-between border-b border-lb-navy/5 py-3 text-sm"><span>Gross pay</span><strong>{money(gross)}</strong></div>{deductions.map(([label, amount]) => <div className="flex justify-between border-b border-lb-navy/5 py-3 text-sm" key={String(label)}><span>{label}</span><strong className="text-lb-red">-{money(Number(amount))}</strong></div>)}<div className="flex justify-between pt-4 text-base"><strong className="text-lb-navy">Estimated net</strong><strong className="text-lb-green">{money(net)}</strong></div></section><section className={glassPanel}><PanelTitle title="Performance" meta="Current week" /><div className="grid place-content-center gap-2 py-8 text-center"><strong className="text-5xl tracking-[-0.05em] text-lb-navy">4.6</strong><span className="text-xs text-lb-muted">Performance score / 5</span><div className="mt-2 flex justify-center gap-1">{[1, 2, 3, 4, 5].map((star) => <span className={`text-xl ${star <= 4 ? "text-[#e6a600]" : "text-lb-navy/20"}`} key={star}>★</span>)}</div><b className="text-xs text-lb-green">Eligible for weekly recognition</b></div></section></div>
  </div>;
}

function EmployeeComms() {
  const [suggestion, setSuggestion] = useState("");
  const [sent, setSent] = useState(false);
  const notices = [
    ["Weekend service briefing", "Today", "Complete station readiness before the evening rush."],
    ["Uniform standard reminder", "Yesterday", "Name badge and approved uniform are required for every shift."],
    ["Kitchen safety check", "08 Aug", "Report damaged equipment to the shift manager immediately."],
  ];

  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_1fr]">
    <section className={glassPanel}><PanelTitle title="Management notices" meta={`${notices.length} recent`} /><div className="grid gap-2">{notices.map(([title, date, detail], index) => <article className={`${softGlass} p-4`} key={title}><div className="flex items-center justify-between gap-3"><strong className="text-sm text-lb-navy">{title}</strong><span className="text-[10px] text-lb-muted">{date}</span></div><p className="mb-0 mt-1 text-xs leading-5 text-lb-muted">{detail}</p>{index === 0 && <span className="mt-2 inline-block rounded-full bg-lb-blue/10 px-2 py-1 text-[9px] font-black text-lb-blue">Unread</span>}</article>)}</div></section>
    <section className={glassPanel}><PanelTitle title="Send a suggestion" meta="Private to management" /><p className="text-xs leading-5 text-lb-muted">Employees can report an operational issue or suggest an improvement without mixing it into customer channels.</p><textarea className={`${input} min-h-36 w-full resize-y`} value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="What should management know or improve?" /><button className={`${primaryButton} mt-3`} disabled={!suggestion.trim()} onClick={() => setSent(true)}>Submit suggestion</button>{sent && <div className="mt-3 rounded-[16px] bg-[#eaf8f0] p-3 text-xs font-bold text-lb-green">Suggestion prepared. Durable submission will be enabled with the employee backend.</div>}</section>
  </div>;
}

function OrderComposer() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"cash" | "online">("cash");
  const [membership, setMembership] = useState(0);
  const subtotal = useMemo(() => menu.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0), [cart]);
  const quote = quoteOrder({ subtotal, paymentMethod: payment, membershipPercent: membership });
  const add = (id: string) => setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.5fr)_390px]">
    <section className={glassPanel}><PanelTitle title="Menu" meta="Tap to add" /><div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{menu.map((item) => <button className="grid min-h-28 content-between rounded-[20px] border border-white/85 bg-white/65 p-4 text-left shadow-[0_8px_24px_rgba(7,24,47,0.05)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/85" key={item.id} onClick={() => add(item.id)}><small className="font-extrabold text-lb-blue">{item.category}</small><strong className="text-sm text-lb-navy">{item.name}</strong><span className="font-black">{money(item.price)}</span></button>)}</div></section>
    <section className={`${glassPanel} self-start xl:sticky xl:top-[94px]`}><PanelTitle title="Current bill" meta="LBSAG next" /><div className="mb-4 min-h-28 border-b border-lb-navy/5">{Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => { const item = menu.find((entry) => entry.id === id)!; return <div className="flex justify-between gap-2.5 py-2 text-xs" key={id}><span>{qty} × {item.name}</span><strong>{money(item.price * qty)}</strong></div>; })}{subtotal === 0 && <div className="py-8 text-center text-xs text-lb-muted">Add an item to start the order.</div>}</div>
      <label className="my-3 grid gap-1.5 text-xs font-extrabold text-lb-navy">Payment<select className={input} value={payment} onChange={(e) => setPayment(e.target.value as "cash" | "online")}><option value="cash">Cash</option><option value="online">Online</option></select></label>
      <label className="my-3 grid gap-1.5 text-xs font-extrabold text-lb-navy">Membership discount<select className={input} value={membership} onChange={(e) => setMembership(Number(e.target.value))}><option value={0}>No membership</option><option value={5}>5%</option><option value={10}>10%</option></select></label>
      <div className="my-4 grid gap-2 text-xs"><div className="flex justify-between"><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div><div className="flex justify-between"><span>{quote.discountLabel} ({quote.discountPercent}%)</span><strong>-{money(quote.discountAmount)}</strong></div><div className="flex justify-between border-t border-lb-navy/5 pt-3 text-base"><span>Total</span><strong>{money(quote.total)}</strong></div></div>
      <button className={primaryButton} disabled={subtotal === 0}>Punch order</button><p className="text-[10px] leading-4 text-lb-muted">The engine applies the highest eligible discount rather than stacking promotions.</p>
    </section>
  </div>;
}

function KitchenBoard() {
  const tickets = [{ bill: "0184", mins: 9, items: "Tower Burger ×1 · Wings ×1", state: "Preparing" }, { bill: "0185", mins: 15, items: "Premium Pizza ×1", state: "Preparing" }, { bill: "0186", mins: 4, items: "Peri Peri Burger ×2", state: "Accepted" }];
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{tickets.map((ticket) => <article className={`${glassPanel} grid grid-cols-[1fr_auto] gap-4`} key={ticket.bill}><div className="grid gap-1"><span className={eyebrow}>LBSAG-{ticket.bill}</span><strong className="text-lb-navy">{ticket.state}</strong></div><div className={`grid size-16 place-items-center rounded-full text-[22px] font-black leading-none shadow-inner ${ticket.mins >= 15 ? "bg-[#fff0ef]/90 text-lb-red" : "bg-[#eef4fa]/90 text-lb-blue"}`}>{ticket.mins}<small className="-mt-3 block text-[8px]">min</small></div><p className="col-span-full m-0 text-[13px] text-lb-muted">{ticket.items}</p><div className="col-span-full flex gap-2"><button className="flex-1 rounded-[14px] border border-white/90 bg-white/70 p-2 font-extrabold text-lb-navy backdrop-blur-xl">Preparing</button><button className={`${primaryButton} flex-1`}>Ready</button></div></article>)}</div>;
}

function AttendancePanel({ management = false }: { management?: boolean }) {
  const [time, setTime] = useState("15:12");
  const [distance, setDistance] = useState(35);
  const result = evaluateCheckIn(time, distance);
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]"><section className={glassPanel}><PanelTitle title={management ? "Attendance simulator" : "Check-in"} meta="100m geofence" /><label className="my-3 grid gap-1.5 text-xs font-extrabold text-lb-navy">Check-in time<input className={input} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label><label className="my-3 grid gap-1.5 text-xs font-extrabold text-lb-navy">Distance from restaurant<input className={input} type="number" min={0} value={distance} onChange={(e) => setDistance(Number(e.target.value))} /><small className="font-normal text-lb-muted">metres</small></label><div className={`${softGlass} mt-3 grid gap-1 border-l-4 p-3.5 ${result.accepted ? "border-l-lb-green" : "border-l-lb-red"}`}><strong className="capitalize text-lb-navy">{result.status.replaceAll("-", " ")}</strong><span className={muted}>{result.reason}</span><b className="text-xs">{result.fine === 0 ? "No fine" : result.fine === "full-shift" ? "Full shift cut" : `Fine: Rs ${result.fine}`}</b></div></section><section className={glassPanel}><PanelTitle title="Policy" meta="Current" /><ul className="grid list-disc gap-3 pl-5 text-[13px] text-[#505b6b]"><li>Check-in: 2:50 PM–3:05 PM</li><li>After 3:05 PM: Rs 200</li><li>After 4:00 PM: Rs 500</li><li>After 5:00 PM: full shift cut</li><li>Checkout: 3:00 AM–3:20 AM</li><li>Outside 100m: attendance rejected</li></ul></section></div>;
}

function RiderDelivery() {
  const kpi = evaluateRiderKpi(3, 22);
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]"><section className={glassPanel}><PanelTitle title="Active delivery" meta={<span className="rounded-full bg-[#eaf8f0] px-2.5 py-1 font-bold text-lb-green">GPS active</span>} /><span className={eyebrow}>LBSAG-0183</span><h2 className="my-2 text-2xl font-bold text-lb-navy">Faisal Block · House 128</h2><p className="text-[13px] leading-6 text-lb-muted">Customer tracking link is active. Rider location should stream only during the delivery session.</p><div className="my-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{["Order ready", "Rider assigned", "Out for delivery", "Delivered"].map((step, index) => <span key={step} className={`rounded-[14px] px-1.5 py-2 text-center text-[10px] backdrop-blur-xl ${index < 3 ? "bg-[#e7f6ee]/85 font-black text-lb-green" : "bg-white/60 text-[#707a89]"}`}>{step}</span>)}</div><button className={primaryButton}>Mark delivered</button></section><section className={glassPanel}><PanelTitle title="Delivery KPI" meta="3-order route" /><div className="grid min-h-52 place-content-center gap-2 text-center"><strong className="text-[39px] tracking-[-0.05em] text-lb-navy">{kpi.actualMinutes} min</strong><span className="text-lb-muted">Target ≤ {kpi.targetMinutes} min</span><b className="text-lb-green">{kpi.late ? `Fine Rs ${kpi.fine}` : "Within KPI"}</b></div></section></div>;
}

function CustomerTrack() {
  return <section className={`mx-auto max-w-[760px] ${glassPanel}`}><div className="mb-8 flex items-center gap-3"><div className="grid size-16 place-items-center overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5"><Image src="/brand/london-bite-logo.png" alt="London Bite" width={64} height={64} className="h-full w-full object-contain" /></div><div className="grid"><strong className="text-lb-navy">London Bite</strong><small className="text-lb-muted">Every Bite, A London Story</small></div></div><span className={eyebrow}>Order LBSAG-0183</span><h1 className="my-2 text-[32px] font-bold tracking-[-0.05em] text-lb-navy sm:text-[34px]">Your order is on the way</h1><p className="text-lb-muted">Rider is currently delivering your order in Faisal Block.</p><div className="my-6 grid grid-cols-1 gap-1.5 sm:grid-cols-5">{["Accepted", "Preparing", "Ready", "On the way", "Delivered"].map((step, index) => <div key={step} className={`rounded-[14px] px-1 py-2.5 text-center text-[10px] backdrop-blur-xl ${index < 4 ? "bg-[#e9f7ef]/85 font-black text-lb-green" : "bg-white/60 text-[#7b8390]"}`}>{step}</div>)}</div><div className="grid h-56 place-content-center gap-1.5 rounded-[24px] border border-white/80 bg-white/50 text-center shadow-inner backdrop-blur-2xl"><span className="text-[11px] text-[#657488]">Live delivery GPS</span><strong className="text-lb-navy">Rider location appears here</strong><small className="text-[11px] text-[#657488]">Location sharing ends after delivery.</small></div><div className="mt-5 flex justify-between border-t border-lb-navy/5 pt-4"><span>Estimated status</span><strong className="text-lb-navy">Arriving soon</strong></div></section>;
}

function GenericScreen({ route }: { route: PlatformRoute }) {
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]"><section className={glassPanel}><PanelTitle title="Core features" meta={route.features.length} /><div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{route.features.map((feature, index) => <div className={`${softGlass} p-3.5`} key={feature}><span className="text-[10px] font-black text-lb-red">0{index + 1}</span><strong className="my-2 block text-[13px] text-lb-navy">{feature}</strong><p className="m-0 text-[11px] leading-4 text-lb-muted">Operational control for {route.module.toLowerCase()} workflow.</p></div>)}</div></section><section className={glassPanel}><PanelTitle title="System contract" meta="Foundation" /><ul className="grid list-disc gap-3 pl-5 text-[13px] text-[#505b6b]"><li>Role-scoped access is required before production data is exposed.</li><li>Critical mutations must be auditable.</li><li>Uploads are capped at 5MB where required.</li><li>Production persistence must use the database adapter, not browser state.</li><li>Secrets stay in Vercel environment variables.</li></ul></section></div>;
}

export function PlatformPage({ route }: { route: PlatformRoute }) {
  let body;
  if (route.path === "/management/dashboard" || route.path === "/ipos" || route.path === "/rider") body = <Dashboard />;
  else if (route.path === "/management/employees") body = <StaffDirectory />;
  else if (route.path === "/employee") body = <EmployeeHome />;
  else if (route.path === "/employee/profile") body = <EmployeeProfile />;
  else if (route.path === "/employee/leave") body = <EmployeeLeave />;
  else if (route.path === "/employee/payroll" || route.path === "/employee/fines" || route.path === "/employee/stars") body = <EmployeePayroll />;
  else if (route.path === "/employee/announcements" || route.path === "/employee/suggestions") body = <EmployeeComms />;
  else if (route.path === "/ipos/new-order") body = <OrderComposer />;
  else if (route.module === "Kitchen") body = <KitchenBoard />;
  else if (route.path === "/management/attendance") body = <AttendancePanel management />;
  else if (route.path === "/employee/attendance") body = <AttendancePanel />;
  else if (route.path === "/rider/active-delivery") body = <RiderDelivery />;
  else if (route.path === "/customer/track") body = <CustomerTrack />;
  else body = <GenericScreen route={route} />;

  return <><SectionHeader route={route} />{body}</>;
}
