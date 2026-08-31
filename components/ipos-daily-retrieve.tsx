"use client";

import { useCallback, useEffect, useState } from "react";
import { Secure } from "@/components/live-growth-performance";
import { getIposDailyOrders, getIposDailySummary, type DailyCounterOrder } from "@/lib/lb-daily-api";
import { markCounterPaid } from "@/lib/lb-route-api";

const panel = "rounded-[28px] border border-white/75 bg-white/70 p-5 shadow-[0_18px_55px_rgba(7,24,47,0.07)] backdrop-blur-2xl";
const soft = "rounded-[20px] border border-white/80 bg-white/60 backdrop-blur-xl";
const field = "min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/80 px-3 text-sm text-lb-ink outline-none focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const primary = "min-h-11 rounded-[14px] bg-lb-navy px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/75 px-4 text-xs font-black text-lb-navy disabled:cursor-not-allowed disabled:opacity-40";
const money = (value: number) => `Rs ${Math.round(Number(value) || 0).toLocaleString("en-PK")}`;
const ticket = (value: number) => `LBSAG-${String(Math.max(1, Number(value) || 1)).padStart(4, "0")}`;

export function LiveIposDailyRetrieve() {
  return <Secure title="Counter / management sign in">{(session, signOut) => <DailyRetrieveBody token={session.access_token} signOut={signOut} />}</Secure>;
}

function DailyRetrieveBody({ token, signOut }: { token: string; signOut: () => void }) {
  const [businessDate, setBusinessDate] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<DailyCounterOrder[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (date?: string, q = query) => {
    setBusy(true);
    setMessage("");
    try {
      const selected = date || businessDate || undefined;
      const rows = await getIposDailyOrders(token, q, selected);
      setOrders(rows);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Orders could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, [token, businessDate, query]);

  useEffect(() => {
    void (async () => {
      try {
        const summary = await getIposDailySummary(token);
        setBusinessDate(summary.business_date);
        setCurrentDate(summary.business_date);
        setOrders(await getIposDailyOrders(token, "", summary.business_date));
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Orders could not be loaded.");
      }
    })();
  }, [token]);

  const markPaid = async (orderId: string) => {
    setBusy(true);
    try {
      await markCounterPaid(token, orderId);
      await load(businessDate, query);
      setMessage("Payment updated.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Payment update failed.");
    } finally {
      setBusy(false);
    }
  };

  const openCurrent = async () => {
    try {
      const summary = await getIposDailySummary(token);
      setCurrentDate(summary.business_date);
      setBusinessDate(summary.business_date);
      setQuery("");
      await load(summary.business_date, "");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Current day could not be loaded.");
    }
  };

  const history = Boolean(currentDate && businessDate && businessDate !== currentDate);

  return <div className="grid gap-3">
    <section className={panel}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue">iPOS · Date-scoped retrieve</span>
          <h2 className="mb-2 mt-1 text-2xl font-black tracking-[-0.04em] text-lb-navy">Retrieve Orders</h2>
          <p className="m-0 max-w-2xl text-xs leading-5 text-lb-muted">Normal screen sirf selected business date load karti hai. Purane bills current day mein mix nahi honge. History dekhne ke liye pehle date select karein.</p>
        </div>
        <div className="flex gap-2">
          <button className={secondary} onClick={() => void openCurrent()} disabled={busy}>Current day</button>
          <button className={secondary} onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 lg:grid-cols-[190px_1fr_auto]">
        <input type="date" className={field} value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
        <input className={field} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="LBSAG-0001, phone or customer" />
        <button className={primary} onClick={() => void load(businessDate, query)} disabled={busy || !businessDate}>{busy ? "Loading…" : "Open date / Search"}</button>
      </div>
      {history && <p className="mb-0 mt-3 text-[10px] font-black uppercase tracking-wide text-amber-700">History mode · {businessDate}</p>}
      {message && <p className="mb-0 mt-3 rounded-[14px] bg-lb-blue/5 p-3 text-xs font-bold text-lb-muted">{message}</p>}
    </section>

    <section className={panel}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="m-0 text-xl font-black text-lb-navy">{businessDate || "Business day"}</h3>
        <span className="text-[10px] font-black uppercase text-lb-muted">{orders.length} orders</span>
      </div>
      <div className="grid gap-2">
        {orders.map((order) => <article key={order.id} className={`${soft} grid gap-3 p-3.5 lg:grid-cols-[1fr_auto] lg:items-center`}>
          <div>
            <strong className="text-sm text-lb-navy">{ticket(order.order_number)} · {order.customer_name || "Walk-in customer"}</strong>
            <p className="mb-0 mt-1 text-xs leading-5 text-lb-muted">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ") || "No item detail"}</p>
            <p className="mb-0 mt-1 text-[10px] text-lb-muted">{order.customer_phone || "No phone"} · {order.fulfilment} · {money(order.total)} · {order.payment_status}</p>
          </div>
          {order.payment_status !== "paid"
            ? <button className={primary} onClick={() => void markPaid(order.id)} disabled={busy}>Mark paid</button>
            : <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-800">Settled</span>}
        </article>)}
        {!orders.length && <div className="rounded-[18px] border border-dashed border-lb-navy/15 bg-white/45 p-8 text-center"><strong className="text-sm text-lb-navy">No orders on this date</strong><p className="mb-0 mt-1 text-xs text-lb-muted">Current day fresh ho to yahan kuch show nahi hoga jab tak pehla order create na ho.</p></div>}
      </div>
    </section>
  </div>;
}
