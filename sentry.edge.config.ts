// Sentry initialization for the Edge runtime. Loaded by
// `src/instrumentation.ts` when NEXT_RUNTIME === "edge".
//
// Currently no route uses the edge runtime, but we initialize anyway
// so any future edge routes get captured automatically.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  initialScope: { tags: { runtime: "edge" } },
  tracesSampleRate: 0,
});
