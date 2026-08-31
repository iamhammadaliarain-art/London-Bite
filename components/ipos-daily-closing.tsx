"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Secure } from "@/components/live-growth-performance";
import {
  addIposExpense,
  closeIposBusinessDay,
  getIposDailySummary,
  type DailyExpense,
  type IposDailySummary,
} from "@/lib/lb-daily-api";

const panel = "rounded-[28px] border border-white/75 bg-white/70 p-5 shadow-[0_18px_55px_rgba(7,24,47,0.07)] backdrop-blur-2xl";
const soft = "rounded-[20px] border border-white/80 bg-white/60 backdrop-blur-xl";
const field = "min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/80 px-3 text-sm text-lb-ink outline-none focus:border-lb-blue/40 focus:ring-4 focus:ring-lb-blue/10";
const primary = "min-h-11 rounded-[14px] bg-lb-navy px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40";
const danger = "min-h-11 rounded-[14px] bg-lb-red px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "min-h-11 rounded-[14px] border border-lb-navy/10 bg-white/75 px-4 text-xs font-black text-lb-navy disabled:cursor-not-allowed disabled:opacity-40";
const eyebrow = "text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue";
const money = (value: number) => `Rs ${Math.round(Number(value) || 0).toLocaleString("en-PK")}`;
const ticket = (value: number) => `LBSAG-${String(Math.max(1, Number(value) || 1)).padStart(4, "0")}`;

const categories = ["Supplies", "Chicken / Meat", "Vegetables", "Bread", "Gas", "Staff Meal", "Delivery", "Maintenance", "Petty Cash", "Other"];

function karachiClock() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const minute = read("minute");
  const minutes = hour * 60 + minute;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (hour < 14) date.setUTCDate(date.getUTCDate() - 1);
  return {
    operationalBusinessDate: date.toISOString().slice(0, 10),
    expenseWindowOpen: minutes >= 14 * 60 || minutes < 3 * 60,
    eodWindowOpen: minutes >= 2 * 60 && minutes <= 3 * 60 + 30,
  };
}

export function LiveIposDailyClosing() {
  return <Secure title="iPOS daily closing sign in">{(session, signOut) => <DailyClosingBody token={session.access_token} signOut={signOut} />}</Secure>;
}

function DailyClosingBody({ token, signOut }: { token: string; signOut: () => void }) {
  const [summary, setSummary] = useState<IposDailySummary | null>(null);
  const [liveBusinessDate, setLiveBusinessDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<DailyExpense["payment_method"]>("cash");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (date?: string, markAsCurrent = false) => {
    setLoading(true);
    try {
      const result = await getIposDailySummary(token, date);
      setSummary(result);
      setSelectedDate(result.business_date);
      if (!date || markAsCurrent) setLiveBusinessDate(result.business_date);
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Daily sheet could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(undefined, true); }, [load]);

  const clock = karachiClock();
  const isHistory = Boolean(summary && liveBusinessDate && summary.business_date !== liveBusinessDate);
  const isUpcomingSheet = Boolean(summary && summary.business_date > clock.operationalBusinessDate);
  const canEdit = Boolean(summary && !isHistory && summary.status === "open");
  const canAddExpense = canEdit && !isUpcomingSheet && clock.expenseWindowOpen;
  const canCloseDay = canEdit && !isUpcomingSheet && clock.eodWindowOpen;

  const addExpense = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !canAddExpense) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await addIposExpense(token, { category, detail, amount: value, paymentMethod });
      setSummary(result);
      setSelectedDate(result.business_date);
      setLiveBusinessDate(result.business_date);
      setAmount("");
      setDetail("");
      setMessage("Expense current business day mein save ho gaya.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Expense save failed.");
    } finally {
      setBusy(false);
    }
  };

  const closeDay = async () => {
    if (!canCloseDay || busy || !summary) return;
    const confirmed = window.confirm(`End of Day ${summary.business_date} close karna hai? Purana din archive hoga aur next day ki blank sheet khul jayegi.`);
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await closeIposBusinessDay(token);
      setSummary(result);
      setSelectedDate(result.business_date);
      setLiveBusinessDate(result.business_date);
      setAmount("");
      setDetail("");
      setMessage(`End of Day closed. ${result.business_date} ki fresh blank sheet ready hai; next shift ka pehla order ${ticket(1)} hoga.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "End of Day close failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !summary) return <section className={panel}>Loading current business day…</section>;

  return <div className="grid gap-3">
    <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <span className={eyebrow}>iPOS · Business day control</span>
          <h2 className="mb-2 mt-1 text-2xl font-black tracking-[-0.04em] text-lb-navy">End of Day + Expense Sheet</h2>
          <p className="m-0 max-w-3xl text-xs leading-5 text-lb-muted">Expense entry <strong className="text-lb-navy">2:00 PM–3:00 AM</strong>. End of Day <strong className="text-lb-navy">2:00 AM–3:30 AM</strong>. EOD close hote hi purani sheet archive hoti hai, next sheet blank khulti hai aur next shift ka visible ticket phir <strong className="text-lb-navy">LBSAG-0001</strong> se start hota hai.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={secondary} onClick={() => void load(undefined, true)} disabled={loading}>Current day</button>
          <button className={secondary} onClick={signOut}>Sign out</button>
        </div>
      </div>

      {message && <p className="mb-0 mt-4 rounded-[14px] bg-lb-blue/5 p-3 text-xs font-bold text-lb-muted">{message}</p>}

      <div className="mt-5 flex flex-col gap-2 rounded-[18px] border border-lb-navy/10 bg-white/55 p-3 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1 text-[10px] font-black uppercase tracking-wide text-lb-muted">View business date
          <input type="date" className={field} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        <button className={secondary} onClick={() => selectedDate && void load(selectedDate)} disabled={!selectedDate || loading}>Open history</button>
        {isHistory && <span className="rounded-full bg-amber-100 px-3 py-2 text-[10px] font-black uppercase text-amber-800">History · read only</span>}
        {isUpcomingSheet && !isHistory && <span className="rounded-full bg-sky-100 px-3 py-2 text-[10px] font-black uppercase text-sky-800">Next day ready</span>}
      </div>
    </section>

    {summary && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Business date" value={summary.business_date} detail={summary.status === "closed" ? "Closed / archived" : isUpcomingSheet ? "Fresh next-day sheet" : "Open now"} />
        <Metric label="Orders" value={String(summary.order_count)} detail={`Next ${ticket(summary.next_order_number)}`} />
        <Metric label="Paid sales" value={money(summary.paid_sales)} detail={`Cash ${money(summary.cash_sales)} · Online ${money(summary.online_sales)}`} />
        <Metric label="Expenses" value={money(summary.expense_total)} detail={`${summary.expenses.length} entries`} />
        <Metric label="Net after expenses" value={money(summary.net_after_expenses)} detail={`Unpaid ${summary.unpaid_count} · ${money(summary.unpaid_total)}`} />
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
        <section className={panel}>
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><span className={eyebrow}>{isHistory ? "Archived sheet" : "Current sheet only"}</span><h3 className="mb-0 mt-1 text-xl font-black text-lb-navy">Expenses · {summary.business_date}</h3></div>
            <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase ${summary.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>{summary.status}</span>
          </div>
          <div className="grid gap-2">
            {summary.expenses.map((expense) => <article key={expense.id} className={`${soft} grid gap-2 p-3.5 sm:grid-cols-[1fr_auto] sm:items-center`}>
              <div><strong className="text-sm text-lb-navy">{expense.category}</strong><p className="mb-0 mt-1 text-xs text-lb-muted">{expense.detail || "No detail"} · {expense.payment_method} · {new Date(expense.created_at).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" })}</p></div>
              <strong className="text-sm text-lb-navy">{money(expense.amount)}</strong>
            </article>)}
            {!summary.expenses.length && <div className="rounded-[18px] border border-dashed border-lb-navy/15 bg-white/45 p-8 text-center"><strong className="text-sm text-lb-navy">Fresh expense sheet</strong><p className="mb-0 mt-1 text-xs text-lb-muted">Is business day ke abhi koi expenses nahi hain.</p></div>}
          </div>
        </section>

        <aside className="grid self-start gap-3 xl:sticky xl:top-24">
          <section className={panel}>
            <span className={eyebrow}>Add expense</span>
            <form onSubmit={addExpense} className="mt-3 grid gap-2">
              <select className={field} value={category} onChange={(event) => setCategory(event.target.value)} disabled={!canAddExpense}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
              <input className={field} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Expense detail" disabled={!canAddExpense} />
              <input type="number" min="1" step="1" className={field} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount Rs" disabled={!canAddExpense} />
              <select className={field} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as DailyExpense["payment_method"])} disabled={!canAddExpense}>
                <option value="cash">Cash</option><option value="online">Online</option><option value="bank">Bank</option><option value="other">Other</option>
              </select>
              <button className={primary} disabled={!canAddExpense || busy || Number(amount) <= 0}>{busy ? "Saving…" : "Add expense"}</button>
            </form>
            {!canAddExpense && <p className="mb-0 mt-3 text-[10px] leading-4 text-lb-muted">{isHistory ? "History read-only hai." : isUpcomingSheet ? "Next-day sheet ready hai; expense entry 2:00 PM par open hogi." : "Expense entry sirf 2:00 PM se 3:00 AM tak open hai."}</p>}
          </section>

          <section className={`${panel} border-lb-red/15`}>
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-red">Daily reset</span>
            <h3 className="mb-2 mt-1 text-lg font-black text-lb-navy">Close End of Day</h3>
            <p className="text-xs leading-5 text-lb-muted">EOD sirf 2:00 AM–3:30 AM close hoga. Purana data delete nahi hoga; archive/history mein rahega. Close ke baad next day ki blank sheet foran nazar aayegi.</p>
            <button className={`${danger} mt-2 w-full`} onClick={() => void closeDay()} disabled={!canCloseDay || busy}>{busy ? "Closing…" : isUpcomingSheet ? "Next day ready" : !clock.eodWindowOpen ? "EOD opens 2:00 AM" : "End of Day · Close & Archive"}</button>
          </section>
        </aside>
      </div>
    </>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className={panel}><span className="text-[10px] font-black uppercase tracking-wide text-lb-muted">{label}</span><strong className="mt-2 block text-xl font-black text-lb-navy">{value}</strong><span className="mt-1 block text-[10px] leading-4 text-lb-muted">{detail}</span></article>;
}
