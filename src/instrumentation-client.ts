// Sentry initialization for the browser. Next 16 auto-loads
// `src/instrumentation-client.ts` on the client side, parallel to the
// server's `src/instrumentation.ts`.
//
// Same DSN gating as the server config: missing DSN = no-op SDK,
// zero network traffic.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Tag client events distinctly from server/edge.
  initialScope: { tags: { runtime: "browser" } },
  // Errors only — no perf monitoring, no session replay, no auto-
  // breadcrumb noise from XHR/fetch (we'll add specific breadcrumbs
  // at the call sites that matter).
  integrations: [],
  tracesSampleRate: 0,
});

// Required for App Router navigation breadcrumbs. Even with
// `integrations: []`, this hook is what the SDK uses to thread
// router transitions onto Sentry events. Documented in
// https://docs.sentry.io/platforms/javascript/guides/nextjs/#configure
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
