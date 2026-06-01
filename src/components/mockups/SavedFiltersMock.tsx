"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Prototypes the proposed "Saved filters" feature: the user shapes the
 * current view (search text + label chips + status + sort), saves it as
 * a named view, and later switches between their saved views and a set
 * of built-in "smart" views from one chip row.
 *
 * Render anywhere to preview the flow, e.g. by temporarily mounting
 * <SavedFiltersMock /> from TodoApp.
 *
 * What it demonstrates:
 *  - Switch: tapping a smart or saved chip applies that view's whole
 *    filter (query/labels/status/sort) to the working state. The active
 *    chip is highlighted.
 *  - Save: when the working filter doesn't match any saved/smart view,
 *    an "Unsaved view" banner offers to save it. The save sheet captures
 *    a name plus a read-only summary of exactly what's being stored.
 *  - Manage: rename or delete saved views from an inline panel. Smart
 *    views are built-in and can't be edited or removed.
 *
 * In the real implementation the working filter is `useFilterParams`
 * (URL-backed, see ADR 0005); saved views would persist to localStorage
 * as a list of { id, name, filter } and a chip would write the view's
 * dimensions back through the existing setters. This mock fakes both
 * with local state and a static set of labels + counts.
 */

import { useMemo, useRef, useState } from "react";

type StatusKey = "open" | "done";

type SortKey =
  | "createdDesc"
  | "createdAsc"
  | "dueDate"
  | "titleAsc"
  | "completed";

const SORT_LABELS: Record<SortKey, string> = {
  createdDesc: "Newest",
  createdAsc: "Oldest",
  dueDate: "Due date",
  titleAsc: "Title A–Z",
  completed: "Completed",
};

type FilterState = {
  query: string;
  labels: string[];
  statuses: StatusKey[];
  sort: SortKey;
};

const DEFAULT_FILTER: FilterState = {
  query: "",
  labels: [],
  statuses: ["open"],
  sort: "createdDesc",
};

// A label's display color, keyed by name. Mirrors how the real app maps
// labels → colors; here it's just enough to make the chips legible.
const LABELS: { name: string; color: string }[] = [
  { name: "work", color: "#3F86E8" },
  { name: "home", color: "#3C9A5F" },
  { name: "bills", color: "#E0464F" },
  { name: "errands", color: "#E2733A" },
  { name: "someday", color: "#8A5CF0" },
];

const LABEL_COLOR = new Map(LABELS.map((l) => [l.name, l.color]));

type SmartView = {
  id: string;
  name: string;
  filter: FilterState;
};

// Built-in views. These are derived from common queries, not stored —
// the user can't rename or delete them.
const SMART_VIEWS: SmartView[] = [
  { id: "all", name: "All", filter: { ...DEFAULT_FILTER, statuses: ["open", "done"] } },
  { id: "open", name: "Open", filter: { ...DEFAULT_FILTER } },
  { id: "bills", name: "Bills", filter: { ...DEFAULT_FILTER, labels: ["bills"] } },
  { id: "done", name: "Completed", filter: { ...DEFAULT_FILTER, statuses: ["done"], sort: "completed" } },
];

type SavedView = {
  id: string;
  name: string;
  filter: FilterState;
};

const SEED_SAVED: SavedView[] = [
  {
    id: "s1",
    name: "Work this week",
    filter: { query: "", labels: ["work"], statuses: ["open"], sort: "dueDate" },
  },
  {
    id: "s2",
    name: "Errands & home",
    filter: { query: "", labels: ["errands", "home"], statuses: ["open"], sort: "createdDesc" },
  },
];

// Stable signature so we can tell whether the working filter matches a
// saved/smart view regardless of label/status ordering.
function signature(f: FilterState): string {
  return JSON.stringify({
    query: f.query.trim().toLowerCase(),
    labels: [...f.labels].sort(),
    statuses: [...f.statuses].sort(),
    sort: f.sort,
  });
}

function isDefault(f: FilterState): boolean {
  return signature(f) === signature(DEFAULT_FILTER);
}

export default function SavedFiltersMock() {
  const [filter, setFilter] = useState<FilterState>(SEED_SAVED[0].filter);
  const [saved, setSaved] = useState<SavedView[]>(SEED_SAVED);
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);

  const currentSig = signature(filter);

  const activeSmart = SMART_VIEWS.find((v) => signature(v.filter) === currentSig);
  const activeSaved = saved.find((v) => signature(v.filter) === currentSig);
  const matchesAView = Boolean(activeSmart || activeSaved);

  function apply(next: FilterState) {
    setFilter(next);
  }

  function commitSave(name: string) {
    const id = crypto.randomUUID();
    const view: SavedView = { id, name, filter };
    setSaved((prev) => [...prev, view]);
    setSaving(false);
  }

  function rename(id: string, name: string) {
    setSaved((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
  }

  function remove(id: string) {
    setSaved((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          Filters
        </h2>
        {saved.length > 0 && (
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            aria-pressed={managing}
            className={
              "h-8 rounded-full border px-3 text-[13px] font-medium " +
              (managing
                ? "border-primary-border bg-primary-bg text-primary"
                : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
            }
          >
            {managing ? "Done" : "Manage"}
          </button>
        )}
      </header>

      {/* ---- Views: smart + saved chips ---- */}
      <section className="flex flex-col gap-3">
        <ChipGroup label="Smart views">
          {SMART_VIEWS.map((v) => (
            <ViewChip
              key={v.id}
              name={v.name}
              smart
              active={activeSmart?.id === v.id}
              onClick={() => apply(v.filter)}
            />
          ))}
        </ChipGroup>

        <ChipGroup label="Saved views">
          {saved.length === 0 && (
            <span className="text-[13px] text-muted">
              No saved views yet. Shape a filter below, then save it.
            </span>
          )}
          {saved.map((v) => (
            <ViewChip
              key={v.id}
              name={v.name}
              active={activeSaved?.id === v.id}
              onClick={() => apply(v.filter)}
              onDelete={managing ? () => remove(v.id) : undefined}
            />
          ))}
        </ChipGroup>
      </section>

      {/* ---- Manage panel ---- */}
      {managing && saved.length > 0 && (
        <ManagePanel saved={saved} onRename={rename} onDelete={remove} />
      )}

      {/* ---- Unsaved-view banner ---- */}
      {!matchesAView && !isDefault(filter) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-border bg-primary-bg px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-primary">Unsaved view</p>
            <p className="truncate text-[12px] text-muted">
              <FilterSummaryText filter={filter} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="h-9 shrink-0 rounded-lg bg-primary px-4 text-[13px] font-semibold text-on-primary hover:bg-primary-hover active:scale-[0.98]"
          >
            Save view
          </button>
        </div>
      )}

      {/* ---- Working filter editor ---- */}
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-faint">
            Current filter
          </h3>
          {!isDefault(filter) && (
            <button
              type="button"
              onClick={() => apply({ ...DEFAULT_FILTER })}
              className="text-[13px] font-medium text-muted hover:text-fg"
            >
              Reset
            </button>
          )}
        </div>

        <SearchInput
          value={filter.query}
          onChange={(query) => setFilter((f) => ({ ...f, query }))}
        />

        <LabelToggles
          active={filter.labels}
          onToggle={(name) =>
            setFilter((f) => ({
              ...f,
              labels: f.labels.includes(name)
                ? f.labels.filter((l) => l !== name)
                : [...f.labels, name],
            }))
          }
        />

        <StatusToggles
          active={filter.statuses}
          onToggle={(s) =>
            setFilter((f) => ({
              ...f,
              statuses: f.statuses.includes(s)
                ? f.statuses.filter((x) => x !== s)
                : [...f.statuses, s],
            }))
          }
        />

        <SortSelect
          value={filter.sort}
          onChange={(sort) => setFilter((f) => ({ ...f, sort }))}
        />

        <button
          type="button"
          onClick={() => setSaving(true)}
          disabled={isDefault(filter) || matchesAView}
          className="h-11 w-full rounded-xl border border-dashed border-line-strong text-sm font-medium text-fg hover:border-line-emphasis hover:bg-card-hover disabled:opacity-40"
        >
          {matchesAView
            ? "This filter is already a saved view"
            : "Save current filter as a view…"}
        </button>
      </section>

      {saving && (
        <SaveSheet
          filter={filter}
          existingNames={
            new Set(saved.map((v) => v.name.toLowerCase()))
          }
          onCancel={() => setSaving(false)}
          onSave={commitSave}
        />
      )}
    </div>
  );
}

/* ---------- View chips ---------- */

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function ViewChip({
  name,
  active,
  smart,
  onClick,
  onDelete,
}: {
  name: string;
  active: boolean;
  smart?: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border text-[13px] font-medium active:scale-[0.97] " +
        (active
          ? "border-primary-border bg-primary-bg text-primary"
          : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
      }
      style={{
        transition:
          "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), color var(--motion-fast) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth)",
      }}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className="inline-flex items-center gap-1.5 py-1.5 pl-3 pr-3"
      >
        {smart && <SparkleIcon active={active} />}
        <span>{name}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete view ${name}`}
          onClick={onDelete}
          className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-danger"
        >
          <XIcon size={13} />
        </button>
      )}
    </span>
  );
}

/* ---------- Manage panel ---------- */

function ManagePanel({
  saved,
  onRename,
  onDelete,
}: {
  saved: SavedView[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-faint">
        Manage saved views
      </h3>
      {saved.map((v) => (
        <ManageRow
          key={v.id}
          view={v}
          onRename={(name) => onRename(v.id, name)}
          onDelete={() => onDelete(v.id)}
        />
      ))}
    </section>
  );
}

function ManageRow({
  view,
  onRename,
  onDelete,
}: {
  view: SavedView;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(view.name);

  function commit() {
    const next = draft.trim().replace(/\s+/g, " ");
    if (next && next !== view.name) onRename(next);
    else setDraft(view.name);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(view.name);
        }}
        aria-label={`Rename ${view.name}`}
        className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg hover:border-line-emphasis focus:border-line-emphasis focus:outline-none"
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${view.name}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

/* ---------- Working-filter controls ---------- */

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search todos…"
      aria-label="Search query"
      className="h-10 w-full rounded-lg border border-line-strong bg-card px-3 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis focus:outline-none"
    />
  );
}

function LabelToggles({
  active,
  onToggle,
}: {
  active: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LABELS.map((l) => {
        const on = active.includes(l.name);
        return (
          <button
            key={l.name}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(l.name)}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium active:scale-[0.97] " +
              (on
                ? "border-primary-border bg-primary-bg text-primary"
                : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
            }
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.name}
          </button>
        );
      })}
    </div>
  );
}

function StatusToggles({
  active,
  onToggle,
}: {
  active: StatusKey[];
  onToggle: (s: StatusKey) => void;
}) {
  const items: { key: StatusKey; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "done", label: "Done" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => {
        const on = active.includes(it.key);
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(it.key)}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium active:scale-[0.97] " +
              (on
                ? "border-primary-border bg-primary-bg text-primary"
                : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (s: SortKey) => void;
}) {
  return (
    <label className="relative inline-flex h-9 w-max items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card pl-4 pr-3 text-[13px] hover:border-line-strong hover:bg-card-hover">
      <span className="text-muted">Sort:</span>
      <span className="font-medium text-fg">{SORT_LABELS[value]}</span>
      <ChevronDownIcon />
      <select
        aria-label="Sort by"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------- Save sheet ---------- */

function SaveSheet({
  filter,
  existingNames,
  onCancel,
  onSave,
}: {
  filter: FilterState;
  existingNames: Set<string>;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(() => suggestName(filter));
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim().replace(/\s+/g, " ");
  const duplicate = trimmed.length > 0 && existingNames.has(trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !duplicate;

  function submit() {
    if (!canSave) return;
    onSave(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save view"
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-md sm:items-center sm:p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-card p-6 shadow-pop sm:rounded-2xl animate-pop-in"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-fg">
            Save view
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="view-name" className="text-[13px] font-medium text-muted">
            Name
          </label>
          <input
            id="view-name"
            ref={inputRef}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Work this week"
            className="h-11 w-full rounded-lg border-2 border-line-strong bg-card px-3 text-sm text-fg placeholder:text-faint focus:border-primary focus:outline-none"
          />
          {duplicate && (
            <span className="text-[12px] text-danger">
              A view with that name already exists.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            This view stores
          </span>
          <FilterSummary filter={filter} />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-xl border border-line bg-card text-base font-medium text-fg hover:bg-card-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="h-12 flex-1 rounded-xl bg-primary text-base font-medium text-on-primary hover:bg-primary-hover disabled:opacity-40 active:scale-[0.99]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Filter summary ---------- */

function FilterSummary({ filter }: { filter: FilterState }) {
  const parts: React.ReactNode[] = [];

  if (filter.query.trim()) {
    parts.push(
      <SummaryPill key="q" label={`“${filter.query.trim()}”`} />,
    );
  }
  for (const l of filter.labels) {
    parts.push(
      <SummaryPill
        key={`l-${l}`}
        label={l}
        dot={LABEL_COLOR.get(l)}
      />,
    );
  }
  for (const s of filter.statuses) {
    parts.push(
      <SummaryPill key={`s-${s}`} label={s === "open" ? "Open" : "Done"} />,
    );
  }
  parts.push(
    <SummaryPill key="sort" label={`Sort: ${SORT_LABELS[filter.sort]}`} />,
  );

  return <div className="flex flex-wrap items-center gap-1.5">{parts}</div>;
}

function SummaryPill({ label, dot }: { label: string; dot?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[12px] text-fg">
      {dot && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dot }}
        />
      )}
      {label}
    </span>
  );
}

function FilterSummaryText({ filter }: { filter: FilterState }) {
  const bits: string[] = [];
  if (filter.query.trim()) bits.push(`“${filter.query.trim()}”`);
  if (filter.labels.length) bits.push(filter.labels.join(", "));
  bits.push(filter.statuses.map((s) => (s === "open" ? "Open" : "Done")).join(" + ") || "none");
  bits.push(SORT_LABELS[filter.sort]);
  return <>{bits.join(" · ")}</>;
}

function suggestName(filter: FilterState): string {
  if (filter.labels.length === 1) {
    const l = filter.labels[0];
    return l.charAt(0).toUpperCase() + l.slice(1);
  }
  if (filter.query.trim()) return filter.query.trim();
  if (filter.labels.length > 1) return filter.labels.join(" + ");
  return "My view";
}

/* ---------- Icons ---------- */

function SparkleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={active ? "text-primary" : "text-faint"}
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-faint"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
