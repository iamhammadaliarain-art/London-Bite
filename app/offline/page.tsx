import Link from "next/link";

export default function OfflinePage() {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(14,74,134,0.12),transparent_34%),#f4f7fb] p-5 text-lb-ink">
    <section className="w-full max-w-xl rounded-[34px] border border-white/80 bg-white/82 p-7 text-center shadow-[0_24px_80px_rgba(7,24,47,0.12)] backdrop-blur-2xl sm:p-10">
      <div className="mx-auto grid size-20 place-items-center overflow-hidden rounded-[22px] border border-lb-navy/10 bg-white shadow-sm"><img src="/brand/london-bite-logo.png" alt="London Bite" className="h-full w-full object-contain" /></div>
      <span className="mt-6 block text-[10px] font-black uppercase tracking-[0.16em] text-lb-red">Connection unavailable</span>
      <h1 className="mb-3 mt-2 text-3xl font-black tracking-[-0.04em] text-lb-navy sm:text-4xl">Your saved London Bite experience is still here.</h1>
      <p className="mx-auto max-w-md text-sm leading-6 text-lb-muted">Reconnect before placing a new order or refreshing live order status. Previously cached public pages can still be opened from this device.</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2"><Link href="/order?view=home" className="inline-flex min-h-12 items-center justify-center rounded-full bg-lb-navy px-5 text-xs font-black text-white no-underline">Open order app</Link><Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full border border-lb-navy/10 bg-white px-5 text-xs font-black text-lb-navy no-underline">Back to home</Link></div>
    </section>
  </main>;
}
