"use client";

import { useEffect } from "react";

import { isBrowser } from "@/lib/runtime";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!isBrowser()) return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    // Allow Playwright (running against a production build) to opt
    // out of SW registration. WebKit's SW + page.route() ordering
    // makes mocked POSTs unreliable; we test SW logic via dedicated
    // unit/integration tests instead.
    if (process.env.NEXT_PUBLIC_DISABLE_SW === "1") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error: unknown) => {
          console.warn("SW registration failed", error);
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
