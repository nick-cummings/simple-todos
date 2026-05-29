"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { isBrowser } from "./runtime";
import { safeWrite } from "./storage";
import {
  applyResolvedTheme,
  readStoredTheme,
  resolveTheme,
  Theme,
  THEME_KEY,
} from "./theme";

let cache: null | Theme = null;
const listeners = new Set<() => void>();

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // When "system" is selected, react live to OS-level changes.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyResolvedTheme(resolveTheme("system"));
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
    };
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    cache = next;
    // safeWrite swallows quota/unavailability (e.g. private mode) and
    // surfaces it via Sentry + the storage banner; state still updates.
    safeWrite(THEME_KEY, next);
    applyResolvedTheme(resolveTheme(next));
    emit();
  }, []);

  return { setTheme, theme };
}

function emit() {
  for (const l of listeners) l();
}

function getServerSnapshot(): Theme {
  return "system";
}

function getSnapshot(): Theme {
  if (!isBrowser()) return "system";
  cache ??= readStoredTheme();
  return cache;
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
  globalThis.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener("storage", onStorage);
  };
}
