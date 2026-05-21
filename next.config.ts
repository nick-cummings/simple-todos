import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Block being embedded in iframes anywhere — clickjacking defense.
  { key: "X-Frame-Options", value: "DENY" },
  // Tell browsers not to MIME-sniff responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send origin (not full URL) when navigating cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful APIs we don't use; geolocation is opt-in on this
  // origin only (used by the AI description feature).
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
];

const nextConfig: NextConfig = {
  // Hide the Next.js dev indicator portal during Playwright runs so it
  // can't intercept clicks on the mobile viewport. Only suppressed when
  // PLAYWRIGHT=1 (set by the `start:test` script).
  devIndicators: process.env.PLAYWRIGHT === "1" ? false : undefined,
  headers() {
    return Promise.resolve([
      {
        headers: SECURITY_HEADERS,
        // Apply to every path. Vercel already sets HSTS automatically
        // for HTTPS responses; we only add what's missing.
        source: "/:path*",
      },
    ]);
  },
};

export default nextConfig;
