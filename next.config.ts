import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";

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
        value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    },
];

const nextConfig: NextConfig = {
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

// `withSentryConfig` augments the build to upload source maps,
// inject Sentry's instrumentation, and tunnel client SDK requests
// through a Next route. With no SENTRY_AUTH_TOKEN it's a no-op for
// source-map upload; the runtime SDK still works (when DSN is set).
export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Suppress build-time SDK source map warnings in CI when no auth
    // token is configured — the SDK still functions at runtime.
    silent: !process.env.CI,
    // Tunnel client SDK requests through a same-origin route so ad-
    // blockers don't drop them. Path is arbitrary; pick something
    // boring that won't clash with our API surface.
    tunnelRoute: "/monitoring",
    // The default upload behavior is fine for our single-app project.
    widenClientFileUpload: true,
});
