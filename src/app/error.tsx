"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  // Next 16's error file convention. Calling this prompts Next to
  // re-fetch and re-render this segment's tree.
  unstable_retry: () => void;
}

export default function PageErrorBoundary({
  error,
  unstable_retry,
}: ErrorProps) {
  useEffect(() => {
    // Log to console so the user can see what happened in DevTools.
    // (No remote error reporter is wired up yet; that's a future
    // production-readiness ticket.)
    console.error("Page-level error boundary caught:", error);
  }, [error]);

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-start justify-center gap-5 px-5 py-10 sm:px-8"
      role="alert"
    >
      <h1 className="text-4xl font-semibold tracking-[-0.045em] leading-none">
        Something went wrong
      </h1>
      <p className="text-muted">
        The page hit an unexpected error. Your todos are stored in this browser
        and aren&rsquo;t affected — they&rsquo;ll still be there after a reload.
      </p>
      {error.digest && (
        <p className="text-faint text-[13px]">
          Error reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-primary-border bg-primary-bg px-4 text-sm font-medium text-primary hover:bg-primary-bg-hover"
          onClick={() => {
            unstable_retry();
          }}
          type="button"
        >
          Try again
        </button>
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-4 text-sm font-medium hover:bg-card-hover"
          onClick={() => {
            globalThis.location.reload();
          }}
          type="button"
        >
          Reload page
        </button>
      </div>
    </main>
  );
}
