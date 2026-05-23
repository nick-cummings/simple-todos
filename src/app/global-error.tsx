"use client";

import "./globals.css";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

// Last-resort boundary: runs when the root layout itself throws or
// when error.tsx fails. Must define its own <html>/<body> because it
// replaces the layout. Keep the markup minimal and inline the
// fallback styles so a missing CSS bundle can't blank the screen.
export default function GlobalError({
  error,
  unstable_retry,
}: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0B0C10",
          color: "#F4F4F5",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          minHeight: "100dvh",
        }}
      >
        <GlobalErrorBody error={error} unstable_retry={unstable_retry} />
      </body>
    </html>
  );
}

// Exported for direct testing — happy-dom can't render a real <html>
// inside a test container, so the visible UI lives in a normal
// component the tests render in isolation.
export function GlobalErrorBody({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "global" },
    });
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <main
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        justifyContent: "center",
        margin: "0 auto",
        maxWidth: "40rem",
        minHeight: "100dvh",
        padding: "2.5rem 1.25rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
        Something went wrong
      </h1>
      <p style={{ color: "#A1A1AA", margin: 0 }}>
        The app couldn&rsquo;t render. Your todos live in this browser and
        should be safe — try reloading.
      </p>
      {error.digest && (
        <p
          style={{
            color: "#71717A",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: "0.8125rem",
            margin: 0,
          }}
        >
          Error reference: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button
          onClick={() => {
            unstable_retry();
          }}
          style={{
            backgroundColor: "#2563EB",
            border: "none",
            borderRadius: "0.5rem",
            color: "white",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "0.625rem 1rem",
          }}
          type="button"
        >
          Try again
        </button>
        <button
          onClick={() => {
            globalThis.location.reload();
          }}
          style={{
            backgroundColor: "transparent",
            border: "1px solid #3F3F46",
            borderRadius: "0.5rem",
            color: "inherit",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "0.625rem 1rem",
          }}
          type="button"
        >
          Reload page
        </button>
      </div>
    </main>
  );
}
