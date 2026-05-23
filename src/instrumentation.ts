// Next 16 `instrumentation.ts` — runs once per server-runtime startup.
// We use it as the registration point for Sentry on both the Node
// and Edge runtimes, and to forward server-side errors that Next
// catches to Sentry.
//
// See https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

import type { Instrumentation } from "next";

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  Sentry.captureRequestError(error, request, context);
};
