"use client";

import { useEffect } from "react";

import { isBrowser } from "@/lib/runtime";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!isBrowser()) return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error: unknown) => {
          console.warn("SW registration failed", error);
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => { window.removeEventListener("load", onLoad); };
  }, []);

  return null;
}
