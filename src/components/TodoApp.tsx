"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { groupByDue, isCompletedThisWeek } from "@/lib/dates";
import { tagDotStyle } from "@/lib/tagColors";
import {
  allLabels,
  filterTodos,
  labelCounts,
  SortKey,
  sortTodos,
  StatusFilter,
  Todo,
  TodoInput,
} from "@/lib/todos";
import { useLabels } from "@/lib/useLabels";
import { useTodos } from "@/lib/useTodos";
import { withViewTransition } from "@/lib/viewTransition";

import LabelsManager from "./LabelsManager";
import ThemeToggle from "./ThemeToggle";
import TodoCard from "./TodoCard";
import TodoModal from "./TodoModal";

const SORT_LABELS: Record<SortKey, string> = {
  completed: "Open first",
  createdAsc: "Oldest",
  createdDesc: "Newest",
  dueDate: "Due date",
  titleAsc: "Title",
};

export default function TodoApp() {
  const { add, clearCompleted, hydrated, remove, todos, toggle, update } =
    useTodos();
  const { ensureLabelsExist, labels: labelRegistry } = useLabels();

  const [sort, setSort] = useState<SortKey>("createdDesc");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  // Open-only by default: completed todos are noise once they're done,
  // so the user has to opt in to seeing them by toggling the Done chip.
  // The chip's filled state still truthfully reflects what's shown.
  const [activeStatuses, setActiveStatuses] = useState<Set<StatusFilter>>(
    new Set(["open"]),
  );
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | undefined>();
  const [labelsManagerOpen, setLabelsManagerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => { globalThis.removeEventListener("keydown", onKey); };
  }, []);

  const labels = useMemo(() => allLabels(todos), [todos]);
  const counts = useMemo(() => labelCounts(todos), [todos]);
  const visible = useMemo(
    () => sortTodos(filterTodos(todos, activeLabels, query, activeStatuses), sort),
    [todos, activeLabels, query, sort, activeStatuses],
  );
  const groups = useMemo(() => groupByDue(visible), [visible]);

  const openCount = todos.filter((t) => !t.completed).length;
  const doneCount = todos.length - openCount;
  const completedThisWeek = todos.filter(
    (t) => t.completed && isCompletedThisWeek(t.updatedAt),
  ).length;

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }
  function openEdit(t: Todo) {
    setEditing(t);
    setModalOpen(true);
  }
  function handleSubmit(input: TodoInput) {
    // Register any new label names in the label registry so they
    // pick up a color (defaults to gray) and show up in the manager.
    if (input.labels && input.labels.length > 0) {
      ensureLabelsExist(input.labels);
    }
    withViewTransition(() => {
      if (editing) update(editing.id, input);
      else add(input);
    });
  }
  function handleDelete() {
    if (!editing) return;
    const id = editing.id;
    withViewTransition(() => { remove(id); });
  }
  function handleToggle(id: string) {
    withViewTransition(() => { toggle(id); });
  }
  function toggleLabelFilter(label: string) {
    function nextLabels(prev: string[]): string[] {
      return prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label];
    }
    withViewTransition(() => { setActiveLabels(nextLabels); });
  }
  function clearLabelFilters() {
    withViewTransition(() => { setActiveLabels([]); });
  }
  function toggleStatusFilter(s: StatusFilter) {
    withViewTransition(() =>
      { setActiveStatuses((prev) => {
        const next = new Set(prev);
        if (next.has(s)) next.delete(s);
        else next.add(s);
        return next;
      }); },
    );
  }
  function handleSort(next: SortKey) {
    withViewTransition(() => { setSort(next); });
  }
  function handleClearCompleted() {
    withViewTransition(() => { clearCompleted(); });
  }

  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-7 px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-5xl font-semibold tracking-[-0.045em] leading-none">
              todos
            </h1>
            {hydrated && (
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span
                  aria-hidden
                  className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"
                  style={{
                    boxShadow: "0 0 0 4px var(--primary-bg)",
                  }}
                />
                <span>
                  <span className="text-fg">{openCount}</span> open
                </span>
                {completedThisWeek > 0 && (
                  <>
                    <span className="text-faint">·</span>
                    <span>{completedThisWeek} completed this week</span>
                  </>
                )}
              </div>
            )}
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              onChange={setQuery}
              ref={searchRef}
              value={query}
            />
            <SortMenu onChange={handleSort} value={sort} />
          </div>

          <StatusChips
            active={activeStatuses}
            doneCount={doneCount}
            onToggle={toggleStatusFilter}
            openCount={openCount}
          />

          <hr className="border-t border-line" />

          <FilterChips
            activeLabels={activeLabels}
            allCount={openCount}
            counts={counts}
            labelRegistry={labelRegistry}
            labels={labels}
            onClear={clearLabelFilters}
            onManage={() => { setLabelsManagerOpen(true); }}
            onToggle={toggleLabelFilter}
          />
        </div>

        <div className="flex flex-col gap-7">
          {hydrated && visible.length === 0 && (
            <EmptyState hasAny={todos.length > 0} onAdd={openNew} />
          )}

          {groups.map((g) => (
            <section className="flex flex-col gap-3" key={g.key}>
              <SectionHeader label={g.label} />
              <ul className="flex flex-col gap-2.5">
                {g.items.map((t) => (
                  <TodoCard
                    key={t.id}
                    onOpen={() => { openEdit(t); }}
                    onToggle={() => { handleToggle(t.id); }}
                    todo={t}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {visible.some((t) => t.completed) && (
          <button
            className="self-start text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:text-fg"
            onClick={handleClearCompleted}
            type="button"
          >
            Clear completed
          </button>
        )}
      </main>

      <button
        aria-label="Add todo (N)"
        className="fixed bottom-8 right-8 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-on-primary shadow-fab hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95"
        onClick={openNew}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          transition:
            "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth)",
        }}
        title="New todo (N)"
        type="button"
      >
        <svg aria-hidden fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="22">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <TodoModal
        initial={editing}
        onClose={() => { setModalOpen(false); }}
        onDelete={editing ? handleDelete : undefined}
        onSubmit={handleSubmit}
        open={modalOpen}
      />

      <LabelsManager
        onClose={() => { setLabelsManagerOpen(false); }}
        open={labelsManagerOpen}
      />
    </>
  );
}

/* ---------- Subcomponents ---------- */

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="12"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function EmptyState({
  hasAny,
  onAdd,
}: {
  hasAny: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-faint"
      >
        <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="28">
          <rect height="16" rx="2" width="18" x="3" y="4" />
          <path d="M9 4v2h6V4M8 11h8M8 15h5" />
        </svg>
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-fg">
          {hasAny ? "Nothing matches" : "No todos yet"}
        </p>
        <p className="mx-auto max-w-xs text-[13px] text-muted">
          {hasAny
            ? "Try clearing filters or your search query."
            : "Tap the + button to create your first todo."}
        </p>
      </div>
      {!hasAny && (
        <button
          className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          onClick={onAdd}
          type="button"
        >
          Add your first todo
        </button>
      )}
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
  labelRegistry?: import("@/lib/labels").Label[];
  onClick: () => void;
  showPrimaryDot?: boolean;
  tagDotForLabel?: string;
}) {
  let dotStyle: import("react").CSSProperties | undefined;
  if (showPrimaryDot) {
    dotStyle = { backgroundColor: "var(--primary)" };
  } else if (tagDotForLabel && labelRegistry) {
    dotStyle = tagDotStyle(tagDotForLabel, labelRegistry);
  }

  return (
    <button
      aria-pressed={active}
      className={
        `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium active:scale-[0.97] ${ 
        active
          ? "border-primary-border bg-primary-bg text-primary"
          : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg"}`
      }
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
        className={
          `tabular-nums text-[11px] ${ 
          active ? "text-primary opacity-75" : "text-faint"}`
        }
      >
        {count}
      </span>
    </button>
  );
}

function FilterChips({
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
  labelRegistry: import("@/lib/labels").Label[];
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
          onClick={() => { onToggle(l); }}
          tagDotForLabel={l}
        />
      ))}
    </div>
  );
}

function SearchInput({
  onChange,
  ref,
  value,
}: {
  onChange: (v: string) => void;
  ref?: React.Ref<HTMLInputElement>;
  value: string;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <span aria-hidden className="absolute left-3.5 text-faint">
        <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <input
        aria-label="Search todos"
        className="h-11 w-full rounded-lg border border-line-strong bg-card pl-10 pr-14 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
        onChange={(e) => { onChange(e.target.value); }}
        placeholder="Search todos…"
        ref={ref}
        value={value}
      />
      <kbd className="absolute right-3 select-none">⌘K</kbd>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

function SortMenu({
  onChange,
  value,
}: {
  onChange: (next: SortKey) => void;
  value: SortKey;
}) {
  return (
    <label className="relative inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card pl-4 pr-3 text-sm hover:border-line-emphasis hover:bg-card-hover">
      <span className="text-muted">Sort:</span>
      <span className="font-medium text-fg">{SORT_LABELS[value]}</span>
      <svg
        aria-hidden
        className="text-faint"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="14"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label="Sort by"
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        onChange={(e) => { onChange(e.target.value as SortKey); }}
        value={value}
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
      className={
        `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium active:scale-[0.97] ${ 
        active
          ? "border-primary-border bg-primary-bg text-primary"
          : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg"}`
      }
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
        className={
          `tabular-nums text-[11px] ${ 
          active ? "text-primary opacity-75" : "text-faint"}`
        }
      >
        {count}
      </span>
    </button>
  );
}

function StatusChips({
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
        onClick={() => { onToggle("open"); }}
        type="open"
      />
      <StatusChip
        active={active.has("done")}
        count={doneCount}
        label="Done"
        onClick={() => { onToggle("done"); }}
        type="done"
      />
    </div>
  );
}
