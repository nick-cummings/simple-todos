"use client";

import { useState } from "react";

interface Props {
    /** Fires the permission prompt + subscribe flow. */
    onEnable: () => Promise<boolean>;
}

/**
 * Permission-prompt card surfaced once. The user can enable
 * reminders (triggers Notification.requestPermission and subscribes
 * to push) or dismiss; either way we stop showing the card.
 */
export default function RemindersGate({ onEnable }: Props) {
    const [dismissed, setDismissed] = useState(false);
    const [busy, setBusy] = useState(false);

    if (dismissed) return null;

    async function handleEnable() {
        if (busy) return;
        setBusy(true);
        try {
            await onEnable();
        } finally {
            setBusy(false);
            setDismissed(true);
        }
    }

    return (
        <section
            aria-label="Reminders permission prompt"
            className="flex items-start gap-4 rounded-2xl border border-primary-border bg-primary-bg p-5"
        >
            <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
            >
                <BellIcon />
            </span>
            <div className="flex flex-col gap-2">
                <h2 className="text-[15px] font-semibold text-fg">
                    Get reminded for due dates?
                </h2>
                <p className="text-[13px] text-muted">
                    We&rsquo;ll send a notification on the day a todo is due.
                    Permission stays on this device.
                </p>
                <div className="mt-1 flex gap-2">
                    <button
                        className="rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
                        disabled={busy}
                        onClick={() => {
                            void handleEnable();
                        }}
                        type="button"
                    >
                        {busy ? "Enabling…" : "Enable reminders"}
                    </button>
                    <button
                        className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-subtle hover:text-fg"
                        onClick={() => {
                            setDismissed(true);
                        }}
                        type="button"
                    >
                        Not now
                    </button>
                </div>
            </div>
        </section>
    );
}

function BellIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
        >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    );
}
