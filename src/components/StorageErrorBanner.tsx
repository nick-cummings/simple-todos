"use client";

import Link from "next/link";

import { type StorageError } from "@/lib/storage";

interface Props {
  error: StorageError;
  onDismiss: () => void;
}

/**
 * Surfaced above the todo list when a write to localStorage failed.
 * The dominant case is `quota_exceeded` (Safari's ~5MB cap) — copy
 * is tuned for that path and directs the user to Settings to export
 * and free space.
 */
export default function StorageErrorBanner({ error, onDismiss }: Props) {
  const { body, heading } = copyFor(error);
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl border border-danger bg-danger-bg p-5 sm:flex-row sm:items-start"
      role="alert"
    >
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="text-base font-semibold text-danger">{heading}</h2>
        <p className="text-[13px] text-fg">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-danger bg-card px-3 text-[13px] font-medium text-danger hover:bg-danger hover:text-white"
          href="/settings"
        >
          Open Settings
        </Link>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-subtle px-3 text-[13px] font-medium text-muted hover:bg-subtle-hover hover:text-fg"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}

function copyFor(error: StorageError): { body: string; heading: string } {
  if (error === "quota_exceeded") {
    return {
      body: "Your browser's storage for this app is full, so the most recent change couldn't be saved. Export a backup from Settings, then clear completed todos to free up space.",
      heading: "Storage is full",
    };
  }
  if (error === "unavailable") {
    return {
      body: "localStorage isn't available in this browsing context (private mode? disabled cookies?). Changes you make won't persist past a reload.",
      heading: "Storage isn't available",
    };
  }
  return {
    body: "Saving to localStorage failed for an unknown reason. Try again, and if the problem persists, export a backup from Settings.",
    heading: "Couldn't save",
  };
}
