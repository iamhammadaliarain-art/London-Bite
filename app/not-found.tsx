import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return <main className="relative grid min-h-screen place-content-center overflow-hidden bg-[#f4f7fb] p-5 text-center"><div className="absolute -left-20 -top-20 size-72 rounded-full bg-lb-blue/10 blur-3xl" /><div className="absolute -bottom-20 -right-20 size-72 rounded-full bg-lb-red/10 blur-3xl" /><section className="relative rounded-[30px] border border-white/80 bg-white/70 p-8 shadow-[0_18px_55px_rgba(7,24,47,0.08)] backdrop-blur-2xl"><div className="mx-auto grid size-20 place-items-center overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-black/5"><Image src="/brand/london-bite-logo.png" alt="London Bite" width={80} height={80} className="h-full w-full object-contain" /></div><h1 className="mb-0 mt-5 text-3xl font-bold text-lb-navy">Page not found</h1><p className="text-lb-muted">This route is not part of the London Bite platform.</p><Link className="mx-auto mt-2 inline-block rounded-[14px] bg-lb-navy px-4 py-2.5 font-black text-white no-underline shadow-[0_10px_24px_rgba(7,24,47,0.18)]" href="/management/dashboard">Open dashboard</Link></section></main>;
}
