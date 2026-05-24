// Tiny detection helpers for PWA install state.
//
// The iOS install flow is unusual: there's no `beforeinstallprompt`
// event, the user has to manually tap Share → Add to Home Screen.
// And reminders + Web Push *only work in the installed PWA on iOS*,
// so detecting "iOS Safari, not installed yet" is what drives the
// nudge in `<InstallBanner>`.

import { isBrowser } from "./runtime";

/**
 * True if running on an iOS device (iPhone, iPad, iPod, or an
 * iPad in desktop-Safari mode that still reports as Mac but
 * supports touch). UA-sniffing is the only reliable signal here
 * — `navigator.platform` is deprecated and Apple has been
 * inconsistent about reporting iPad correctly across versions.
 */
export function isIOS(): boolean {
  if (!isBrowser()) return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac unless desktop-mode is explicitly off.
  // Hint: real Macs don't have touch.
  if (
    ua.includes("Macintosh") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

/**
 * True if the app is currently running as an installed PWA, i.e.
 * launched from the home screen rather than inside a browser tab.
 *
 * Two independent signals because each browser surfaces this
 * differently:
 * - iOS Safari sets `navigator.standalone` (legacy, non-standard,
 *   but the only reliable iOS signal).
 * - Everyone else honors the `display-mode: standalone` media query.
 */
export function isStandalonePWA(): boolean {
  if (!isBrowser()) return false;
  // navigator.standalone is iOS-specific and not in the standard
  // TS lib types; cast to read it without a clash.
  const navAny = navigator as Navigator & { standalone?: boolean };
  if (navAny.standalone === true) return true;
  if (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }
  return false;
}
