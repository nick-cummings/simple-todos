import type { StatusFilter } from "@/lib/todos";

import { CheckCircleIcon, CircleIcon } from "./Icons";

export function StatusChips({
  active,
  doneCount,
  onToggle,
  openCount,
}: {
  active: Set<StatusFilter>;
  doneCount: number;
  onToggle: (s: StatusFilter) => void;
  openCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip
        active={active.has("open")}
        count={openCount}
        label="Open"
        onClick={() => {
          onToggle("open");
        }}
        type="open"
      />
      <StatusChip
        active={active.has("done")}
        count={doneCount}
        label="Done"
        onClick={() => {
          onToggle("done");
        }}
        type="done"
      />
    </div>
  );
}

function StatusChip({
  active,
  count,
  label,
  onClick,
  type,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
  type: StatusFilter;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium active:scale-[0.97] ${
        active
          ? "border-primary-border bg-primary-bg text-primary"
          : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg"
      }`}
      onClick={onClick}
      style={{
        transition:
          "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), color var(--motion-fast) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth)",
      }}
      type="button"
    >
      {type === "open" ? <CircleIcon /> : <CheckCircleIcon />}
      <span>{label}</span>
      <span
        className={`tabular-nums text-[11px] ${
          active ? "text-primary opacity-75" : "text-faint"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
