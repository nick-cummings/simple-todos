import type { CSSProperties } from "react";

import type { Label } from "@/lib/labels";

import { tagDotStyle } from "@/lib/tagColors";

export function FilterChips({
  activeLabels,
  allCount,
  counts,
  labelRegistry,
  labels,
  onClear,
  onManage,
  onToggle,
}: {
  activeLabels: string[];
  allCount: number;
  counts: Map<string, number>;
  labelRegistry: Label[];
  labels: string[];
  onClear: () => void;
  onManage: () => void;
  onToggle: (label: string) => void;
}) {
  const allActive = activeLabels.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        aria-label="Manage labels"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg"
        onClick={onManage}
        title="Manage labels"
        type="button"
      >
        <svg
          aria-hidden
          fill="none"
          height="13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="13"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
      <FilterChip
        active={allActive}
        count={allCount}
        label="All"
        onClick={onClear}
        showPrimaryDot
      />
      {labels.map((l) => (
        <FilterChip
          active={activeLabels.includes(l)}
          count={counts.get(l) ?? 0}
          key={l}
          label={l}
          labelRegistry={labelRegistry}
          onClick={() => {
            onToggle(l);
          }}
          tagDotForLabel={l}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  count,
  label,
  labelRegistry,
  onClick,
  showPrimaryDot,
  tagDotForLabel,
}: {
  active: boolean;
  count: number;
  label: string;
  labelRegistry?: Label[];
  onClick: () => void;
  showPrimaryDot?: boolean;
  tagDotForLabel?: string;
}) {
  let dotStyle: CSSProperties | undefined;
  if (showPrimaryDot) {
    dotStyle = { backgroundColor: "var(--primary)" };
  } else if (tagDotForLabel && labelRegistry) {
    dotStyle = tagDotStyle(tagDotForLabel, labelRegistry);
  }

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
      {dotStyle && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={dotStyle}
        />
      )}
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
