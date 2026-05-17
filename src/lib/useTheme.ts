"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  Theme,
  THEME_KEY,
  applyResolvedTheme,
  readStoredTheme,
  resolveTheme,
} from "./theme";

let cache: Theme | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "system";
  if (cache === null) cache = readStoredTheme();
  return cache;
}

function getServerSnapshot(): Theme {
  return "system";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      cache = readStoredTheme();
      applyResolvedTheme(resolveTheme(cache));
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // When "system" is selected, react live to OS-level changes.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyResolvedTheme(resolveTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    cache = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // localStorage may be unavailable (e.g. private mode); state still updates.
    }
    applyResolvedTheme(resolveTheme(next));
    emit();
  }, []);

  return { theme, setTheme };
}
