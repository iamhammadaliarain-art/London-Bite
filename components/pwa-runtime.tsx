"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "lb.pwa.install.dismissed";

export function PwaRuntime() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);

  const isCustomerSurface = pathname === "/" || pathname.startsWith("/order") || pathname.startsWith("/feedback") || pathname.startsWith("/offline");

  useEffect(() => {
    setOnline(navigator.onLine);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        });
      }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    }
  }

  function dismissInstall() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return <>
    {!online && <div role="status" className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[18px] border border-amber-200 bg-amber-50/95 px-4 py-3 text-xs font-bold text-amber-900 shadow-xl backdrop-blur-xl">
      <span>You’re offline. Saved customer pages can still open, but new orders need a connection.</span>
      <span className="size-2 shrink-0 rounded-full bg-amber-500" />
    </div>}

    {updateReady && <div role="status" className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[90] flex w-[calc(100%-24px)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-[20px] border border-white/80 bg-lb-navy px-4 py-3 text-xs text-white shadow-2xl">
      <span className="font-bold">A newer London Bite version is ready.</span>
      <button type="button" onClick={() => window.location.reload()} className="min-h-9 rounded-full bg-white px-3 text-[10px] font-black text-lb-navy">Reload</button>
    </div>}

    {isCustomerSurface && installPrompt && !dismissed && online && !updateReady && <div className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[calc(100%-24px)] max-w-lg -translate-x-1/2 rounded-[24px] border border-white/80 bg-white/92 p-3 shadow-[0_22px_70px_rgba(7,24,47,0.20)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[15px] border border-lb-navy/10 bg-white"><img src="/brand/london-bite-logo.png" alt="" className="h-full w-full object-contain" /></div>
        <div className="min-w-0 flex-1"><strong className="block text-sm text-lb-navy">Add London Bite to your home screen</strong><span className="mt-0.5 block text-[11px] leading-4 text-lb-muted">Faster ordering, tracking and reorder access — no app-store download required.</span></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={dismissInstall} className="min-h-11 rounded-full border border-lb-navy/10 bg-white text-xs font-black text-lb-muted">Not now</button><button type="button" onClick={() => void install()} className="min-h-11 rounded-full bg-lb-navy text-xs font-black text-white">Install</button></div>
    </div>}
  </>;
}
