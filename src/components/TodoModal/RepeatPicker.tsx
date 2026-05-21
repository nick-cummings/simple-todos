import type { Recurrence, RecurrenceUnit } from "@/lib/todos";

type Preset = "custom" | "daily" | "monthly" | "never" | "weekly";

const PRESETS: { label: string; value: Preset }[] = [
  { label: "Never", value: "never" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Custom…", value: "custom" },
];

export function RepeatPicker({
  onChange,
  value,
}: {
  onChange: (next: Recurrence | undefined) => void;
  value: Recurrence | undefined;
}) {
  const preset = recurrenceToPreset(value);
  const customEvery = preset === "custom" ? (value?.every ?? 2) : 2;
  const customUnit: RecurrenceUnit =
    preset === "custom" ? (value?.unit ?? "week") : "week";

  function handlePreset(p: Preset) {
    if (p === "custom") {
      onChange({ every: customEvery, unit: customUnit });
      return;
    }
    onChange(presetToRecurrence(p));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">
        Repeat <span className="text-faint">(optional)</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = preset === p.value;
          return (
            <button
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                active
                  ? "border-primary-border bg-primary-bg text-primary"
                  : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg"
              }`}
              key={p.value}
              onClick={() => {
                handlePreset(p.value);
              }}
              type="button"
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle p-3 text-[13px]">
          <span className="text-muted">Every</span>
          <input
            aria-label="Every (number)"
            className="h-9 w-16 rounded-md border border-line-strong bg-card px-2 text-center font-medium"
            min={1}
            onChange={(e) => {
              const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
              onChange({ every: n, unit: customUnit });
            }}
            type="number"
            value={customEvery}
          />
          <select
            aria-label="Every (unit)"
            className="h-9 rounded-md border border-line-strong bg-card px-2 font-medium"
            onChange={(e) => {
              const unit = e.target.value as RecurrenceUnit;
              onChange({ every: customEvery, unit });
            }}
            value={customUnit}
          >
            <option value="day">days</option>
            <option value="week">weeks</option>
            <option value="month">months</option>
          </select>
        </div>
      )}
    </div>
  );
}

function presetToRecurrence(p: Preset): Recurrence | undefined {
  switch (p) {
    case "daily": {
      return { every: 1, unit: "day" };
    }
    case "monthly": {
      return { every: 1, unit: "month" };
    }
    case "weekly": {
      return { every: 1, unit: "week" };
    }
    default: {
      return undefined;
    }
  }
}

function recurrenceToPreset(r: Recurrence | undefined): Preset {
  if (!r) return "never";
  if (r.every === 1 && r.unit === "day") return "daily";
  if (r.every === 1 && r.unit === "week") return "weekly";
  if (r.every === 1 && r.unit === "month") return "monthly";
  return "custom";
}
