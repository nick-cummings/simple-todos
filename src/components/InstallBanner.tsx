"use client";

interface Props {
    onDismiss: () => void;
}

/**
 * One-time "Add to Home Screen" nudge for iOS Safari users who
 * haven't installed the PWA yet. Reminders + Web Push only work in
 * the installed PWA on iOS, so this is the only path to enabling
 * notifications on the primary target device.
 *
 * Rendered conditionally by `<TodoApp>` based on `useInstallPrompt`.
 * Visible exactly once: the user dismisses it (or installs and the
 * `isStandalonePWA` check suppresses on next load).
 */
export default function InstallBanner({ onDismiss }: Props) {
    return (
        <section
            aria-label="Install Simple Todos as an app"
            className="flex flex-col gap-3 rounded-2xl border border-primary-border bg-primary-bg p-5 sm:flex-row sm:items-center"
        >
            <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
            >
                <PlusIcon />
            </span>
            <div className="flex flex-1 flex-col gap-1">
                <h2 className="text-base font-semibold text-fg">
                    Install Simple Todos
                </h2>
                <p className="text-[13px] text-muted">
                    Tap <ShareIcon className="inline-block translate-y-[3px]" />{" "}
                    Share, then <strong>Add to Home Screen</strong>. Reminders
                    and push notifications only work in the installed app on
                    iOS.
                </p>
            </div>
            <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-[13px] font-medium text-muted hover:bg-card-hover hover:text-fg sm:flex-shrink-0"
                onClick={onDismiss}
                type="button"
            >
                Dismiss
            </button>
        </section>
    );
}

function PlusIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
        >
            <line x1="12" x2="12" y1="5" y2="19" />
            <line x1="5" x2="19" y1="12" y2="12" />
        </svg>
    );
}

function ShareIcon({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden
            className={className}
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
        >
            <path d="M12 16V4" />
            <path d="m6 10 6-6 6 6" />
            <path d="M20 17v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
        </svg>
    );
}
