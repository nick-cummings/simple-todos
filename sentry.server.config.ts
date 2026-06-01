// Sentry initialization for the Node.js runtime. Loaded by
// `src/instrumentation.ts` when NEXT_RUNTIME === "nodejs".
//
// If NEXT_PUBLIC_SENTRY_DSN is unset, Sentry init silently no-ops
// (`captureException` becomes a no-op, no network calls). This makes
// local development and PR previews zero-config; only Vercel
// production needs the DSN set.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Tag every event with the runtime so we can filter "server" vs.
    // "edge" in the Sentry UI even though both use this SDK.
    initialScope: { tags: { runtime: "nodejs" } },
    // We rely on Vercel for performance metrics; PostHog (planned) will
    // own product analytics. Sentry handles errors only.
    tracesSampleRate: 0,
});
