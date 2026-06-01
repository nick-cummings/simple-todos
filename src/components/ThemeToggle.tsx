"use client";

import type { Theme } from "@/lib/theme";

import { useTheme } from "@/lib/useTheme";

const OPTIONS: { icon: React.ReactNode; label: string; value: Theme }[] = [
    { icon: <SystemIcon />, label: "System theme", value: "system" },
    { icon: <SunIcon />, label: "Light theme", value: "light" },
    { icon: <MoonIcon />, label: "Dark theme", value: "dark" },
];

// Each button is 32px (h-8 w-8); container gap-0.5 = 2px; p-1 = 4px.
const SLOT_PX = 34;

export default function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const index = OPTIONS.findIndex((o) => o.value === theme);

    return (
        <div
            aria-label="Theme"
            className="relative inline-flex items-center gap-0.5 rounded-full border border-line bg-subtle p-1"
            role="radiogroup"
        >
            <span
                aria-hidden
                className="pointer-events-none absolute top-1 left-1 h-8 w-8 rounded-full bg-card-hover"
                style={{
                    boxShadow: "inset 0 0 0 1px var(--line-strong)",
                    transform: `translateX(${index * SLOT_PX}px)`,
                    transition:
                        "transform var(--motion-base) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth)",
                }}
            />
            {OPTIONS.map((opt) => {
                const active = theme === opt.value;
                return (
                    <button
                        aria-checked={active}
                        aria-label={opt.label}
                        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                            active ? "text-fg" : "text-muted hover:text-fg"
                        }`}
                        key={opt.value}
                        onClick={() => {
                            setTheme(opt.value);
                        }}
                        role="radio"
                        style={{
                            transition:
                                "color var(--motion-base) var(--ease-smooth)",
                        }}
                        type="button"
                    >
                        {opt.icon}
                    </button>
                );
            })}
        </div>
    );
}

function MoonIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="15"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="15"
        >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    );
}
function SunIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="15"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="15"
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
    );
}
function SystemIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="15"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="15"
        >
            <rect height="13" rx="2" width="18" x="3" y="4" />
            <path d="M9 21h6M12 17v4" />
        </svg>
    );
}
