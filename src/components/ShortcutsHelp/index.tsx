"use client";

import { useId, useRef } from "react";

import { useEscapeKey } from "@/lib/useEscapeKey";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface Props {
    onClose: () => void;
    open: boolean;
}

export default function ShortcutsHelp(props: Props) {
    if (!props.open) return null;
    return <ShortcutsHelpContent onClose={props.onClose} />;
}

const SHORTCUTS: { description: string; keys: string[] }[] = [
    { description: "Focus search", keys: ["⌘K", "Ctrl+K", "/"] },
    { description: "New todo", keys: ["N"] },
    { description: "Show shortcuts", keys: ["?"] },
    { description: "Close overlay", keys: ["Esc"] },
];

function ShortcutsHelpContent({ onClose }: { onClose: () => void }) {
    const panelRef = useRef<HTMLDivElement>(null);
    const headingId = useId();

    useFocusTrap(panelRef);
    useEscapeKey(onClose);

    return (
        <div
            aria-labelledby={headingId}
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-md animate-fade-in"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
        >
            <div
                className="mx-5 w-full max-w-xs rounded-2xl border border-line bg-card shadow-pop animate-pop-in"
                ref={panelRef}
            >
                <div className="flex items-center justify-between px-5 pb-3 pt-5">
                    <h2
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-faint"
                        id={headingId}
                    >
                        Keyboard shortcuts
                    </h2>
                    <button
                        aria-label="Close"
                        className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
                        onClick={onClose}
                        type="button"
                    >
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
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <table className="w-full border-collapse px-5 pb-5">
                    <tbody>
                        {SHORTCUTS.map(({ description, keys }) => (
                            <tr
                                className="border-t border-line first:border-t-0"
                                key={description}
                            >
                                <td className="py-2.5 pl-5 pr-3">
                                    <span className="flex flex-wrap gap-1">
                                        {keys.map((k) => (
                                            <kbd
                                                className="inline-flex items-center rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg"
                                                key={k}
                                            >
                                                {k}
                                            </kbd>
                                        ))}
                                    </span>
                                </td>
                                <td className="py-2.5 pl-3 pr-5 text-sm text-muted">
                                    {description}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
