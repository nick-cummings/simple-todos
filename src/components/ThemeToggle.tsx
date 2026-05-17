"use client";

import { useTheme } from "@/lib/useTheme";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System theme", icon: <SystemIcon /> },
  { value: "light", label: "Light theme", icon: <SunIcon /> },
  { value: "dark", label: "Dark theme", icon: <MoonIcon /> },
];

// Each button is h-7 w-7 (28px). gap-0.5 = 2px between buttons. Container
// p-0.5 = 2px padding. So the indicator slides 30px between adjacent slots.
const SLOT_PX = 30;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === theme);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="relative inline-flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5 shadow-soft"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-primary shadow-soft"
        style={{
          transform: `translateX(${index * SLOT_PX}px)`,
          transition:
            "transform var(--motion-base) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth)",
        }}
      />
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => setTheme(opt.value)}
            className={
              "relative z-10 flex h-7 w-7 items-center justify-center rounded-full " +
              (active ? "text-on-primary" : "text-muted hover:text-fg")
            }
            style={{
              transition: "color var(--motion-base) var(--ease-smooth)",
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

function SystemIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
