"use client";

import { useEffect, useState } from "react";

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration skipped:", err);
      });
    }

    // 2. Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install banner if not dismissed before
      if (!localStorage.getItem("fieldos_pwa_dismissed")) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem("fieldos_pwa_dismissed", "true");
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed top-2 left-3 right-3 z-50 rounded-2xl border border-teal-500/30 bg-[var(--navy)] p-3 text-white shadow-2xl backdrop-blur-md lg:hidden flex items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--teal)] font-black text-[var(--navy)] text-sm">
          A
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight">Install AURA FieldOS</p>
          <p className="text-[10px] text-slate-300">Run as full-screen app on your phone</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="rounded-xl bg-[var(--teal)] px-3 py-1.5 text-xs font-bold text-[var(--navy)] shadow-sm hover:brightness-105"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-white text-xs"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
