"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readStoredLbSession } from "@/lib/lb-api";
import { getLaunchReadiness, type LaunchReadiness, type ReadinessItem } from "@/lib/lb-readiness-api";

const panel = "rounded-[28px] border border-white/75 bg-white/72 p-5 shadow-[0_18px_55px_rgba(7,24,47,0.07)] backdrop-blur-2xl";

const definitions: { key: keyof LaunchReadiness; title: string; detail: string }[] = [
  { key: "menu", title: "Live menu", detail: "Production catalog contains active products." },
  { key: "order_pipeline", title: "Order pipeline", detail: "Customer → operations → kitchen/rider state model is live." },
  { key: "cash_orders", title: "Cash ordering", detail: "Customers can submit server-priced cash orders." },
  { key: "employees", title: "Real employee roster", detail: "Load the actual London Bite staff records." },
  { key: "staff_accounts", title: "Staff account linking", detail: "Link real staff identities to their operational roles." },
  { key: "inventory", title: "Inventory baseline", detail: "Load current restaurant stock and thresholds." },
  { key: "geofence", title: "Branch geofence", detail: "Set the verified restaurant coordinates from the premises." },
  { key: "online_payment", title: "Online payment gateway", detail: "Requires approved merchant credentials; cash remains live meanwhile." },
  { key: "native_store_release", title: "App Store / Play Store release", detail: "Requires developer accounts, signing and store-review submission." },
];

function StatusPill({ item }: { item: ReadinessItem }) {
  if (item.ready) return <span className="rounded-full border border-[#cfeede] bg-[#eaf8f0] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-lb-green">Ready</span>;
  if (item.external) return <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-lb-blue">External activation</span>;
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-lb-amber">Needs setup</span>;
}

export function LaunchReadinessPanel() {
  const [data, setData] = useState<LaunchReadiness | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const session = readStoredLbSession();
    if (!session?.access_token) {
      setData(null);
      setError("Sign in to Management above to read live launch readiness.");
      return;
    }
    setBusy(true);
    setError("");
    try { setData(await getLaunchReadiness(session.access_token)); }
    catch (value) { setError(value instanceof Error ? value.message : "Could not read launch readiness"); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const progress = useMemo(() => {
    if (!data) return { ready: 0, buildable: 0, total: definitions.length };
    const ready = definitions.filter(({ key }) => data[key].ready).length;
    const buildable = definitions.filter(({ key }) => !data[key].external).length;
    return { ready, buildable, total: definitions.length };
  }, [data]);

  return <section className={`${panel} mt-3`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><span className="text-[9px] font-black uppercase tracking-[0.16em] text-lb-blue">Go-live control</span><h2 className="mb-2 mt-1 text-2xl font-black tracking-[-0.03em] text-lb-navy">Launch readiness</h2><p className="mb-0 max-w-2xl text-xs leading-5 text-lb-muted">This checklist is read from the live London Bite database. It separates software readiness from restaurant data and external account activation.</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} className="min-h-11 rounded-full border border-lb-navy/10 bg-white px-4 text-xs font-black text-lb-navy disabled:opacity-50">{busy ? "Checking…" : "Refresh"}</button>
    </div>

    {data && <div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="rounded-[18px] bg-lb-navy p-4 text-white"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/60">Ready now</span><strong className="mt-1 block text-2xl">{progress.ready}/{progress.total}</strong></div><div className="rounded-[18px] border border-white/80 bg-white/65 p-4"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-lb-muted">Buildable/configurable</span><strong className="mt-1 block text-2xl text-lb-navy">{progress.buildable}</strong></div><div className="rounded-[18px] border border-white/80 bg-white/65 p-4"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-lb-muted">External gates</span><strong className="mt-1 block text-2xl text-lb-navy">{definitions.filter(({ key }) => data[key].external).length}</strong></div></div>}

    {error && <p role="status" className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">{error}</p>}

    {data && <div className="mt-4 grid gap-2 lg:grid-cols-2">{definitions.map(({ key, title, detail }) => {
      const item = data[key];
      return <article key={key} className="flex items-start justify-between gap-3 rounded-[20px] border border-white/80 bg-white/64 p-4 backdrop-blur-xl"><div className="min-w-0"><strong className="block text-sm text-lb-navy">{title}</strong><p className="mb-0 mt-1 text-[11px] leading-5 text-lb-muted">{detail}{typeof item.count === "number" ? ` Current count: ${item.count}.` : ""}</p></div><StatusPill item={item} /></article>;
    })}</div>}
  </section>;
}
