"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTodos } from "@/lib/useTodos";
import {
  Todo,
  SortKey,
  TodoInput,
  allLabels,
  filterTodos,
  labelCounts,
  sortTodos,
} from "@/lib/todos";
import { groupByDue, isCompletedThisWeek } from "@/lib/dates";
import { tagDotStyle } from "@/lib/tagColors";
import { useLabels } from "@/lib/useLabels";
import { withViewTransition } from "@/lib/viewTransition";
import TodoCard from "./TodoCard";
import TodoModal from "./TodoModal";
import ThemeToggle from "./ThemeToggle";
import LabelsManager from "./LabelsManager";

const SORT_LABELS: Record<SortKey, string> = {
  createdDesc: "Newest",
  createdAsc: "Oldest",
  titleAsc: "Title",
  dueDate: "Due date",
  completed: "Open first",
};

export default function TodoApp() {
  const { todos, hydrated, add, update, toggle, remove, clearCompleted } =
    useTodos();
  const { labels: labelRegistry, ensureLabelsExist } = useLabels();

  const [sort, setSort] = useState<SortKey>("createdDesc");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | undefined>(undefined);
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const labels = useMemo(() => allLabels(todos), [todos]);
  const counts = useMemo(() => labelCounts(todos), [todos]);
  const visible = useMemo(
    () => sortTodos(filterTodos(todos, activeLabels, query), sort),
    [todos, activeLabels, query, sort],
  );
  const groups = useMemo(() => groupByDue(visible), [visible]);

  const openCount = todos.filter((t) => !t.completed).length;
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
    withViewTransition(() => remove(id));
  }
  function handleToggle(id: string) {
    withViewTransition(() => toggle(id));
  }
  function toggleLabelFilter(label: string) {
    withViewTransition(() =>
      setActiveLabels((prev) =>
        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
      ),
    );
  }
  function clearLabelFilters() {
    withViewTransition(() => setActiveLabels([]));
  }
  function handleSort(next: SortKey) {
    withViewTransition(() => setSort(next));
  }
  function handleClearCompleted() {
    withViewTransition(() => clearCompleted());
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
                  <span className="text-fg">{openCount}</span>{" "}
                  {openCount === 1 ? "open" : "open"}
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
              ref={searchRef}
              value={query}
              onChange={setQuery}
            />
            <SortMenu value={sort} onChange={handleSort} />
          </div>

          <FilterChips
            labels={labels}
            counts={counts}
            allCount={openCount}
            activeLabels={activeLabels}
            labelRegistry={labelRegistry}
            onToggle={toggleLabelFilter}
            onClear={clearLabelFilters}
            onManage={() => setLabelsManagerOpen(true)}
          />
        </div>

        <div className="flex flex-col gap-7">
          {hydrated && visible.length === 0 && (
            <EmptyState hasAny={todos.length > 0} onAdd={openNew} />
          )}

          {groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-3">
              <SectionHeader label={g.label} />
              <ul className="flex flex-col gap-2.5">
                {g.items.map((t) => (
                  <TodoCard
                    key={t.id}
                    todo={t}
                    onToggle={() => handleToggle(t.id)}
                    onOpen={() => openEdit(t)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {todos.some((t) => t.completed) && (
          <button
            type="button"
            onClick={handleClearCompleted}
            className="self-start text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:text-fg"
          >
            Clear completed
          </button>
        )}
      </main>

      <button
        type="button"
        onClick={openNew}
        aria-label="Add todo (N)"
        title="New todo (N)"
        className="fixed bottom-8 right-8 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-on-primary shadow-fab hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95"
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          transition:
            "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <TodoModal
        open={modalOpen}
        initial={editing}
        knownLabels={labels}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        onClose={() => setModalOpen(false)}
      />

      <LabelsManager
        open={labelsManagerOpen}
        onClose={() => setLabelsManagerOpen(false)}
      />
    </>
  );
}

/* ---------- Subcomponents ---------- */

function SearchInput({
  ref,
  value,
  onChange,
}: {
  ref?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <span aria-hidden className="absolute left-3.5 text-faint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <input
        ref={ref}
        aria-label="Search todos"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search todos…"
        className="h-11 w-full rounded-lg border border-line-strong bg-card pl-10 pr-14 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
      />
      <kbd className="absolute right-3 select-none">⌘K</kbd>
    </div>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (next: SortKey) => void;
}) {
  return (
    <label className="relative inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card pl-4 pr-3 text-sm hover:border-line-emphasis hover:bg-card-hover">
      <span className="text-muted">Sort:</span>
      <span className="font-medium text-fg">{SORT_LABELS[value]}</span>
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

function FilterChips({
  labels,
  counts,
  allCount,
  activeLabels,
  labelRegistry,
  onToggle,
  onClear,
  onManage,
}: {
  labels: string[];
  counts: Map<string, number>;
  allCount: number;
  activeLabels: string[];
  labelRegistry: import("@/lib/labels").Label[];
  onToggle: (label: string) => void;
  onClear: () => void;
  onManage: () => void;
}) {
  const allActive = activeLabels.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChip
        active={allActive}
        onClick={onClear}
        label="All"
        count={allCount}
        showPrimaryDot
      />
      {labels.map((l) => (
        <FilterChip
          key={l}
          active={activeLabels.includes(l)}
          onClick={() => onToggle(l)}
          label={l}
          count={counts.get(l) ?? 0}
          tagDotForLabel={l}
          labelRegistry={labelRegistry}
        />
      ))}
      <button
        type="button"
        onClick={onManage}
        aria-label="Manage labels"
        title="Manage labels"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg"
      >
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
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tagDotForLabel,
  showPrimaryDot,
  labelRegistry,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tagDotForLabel?: string;
  showPrimaryDot?: boolean;
  labelRegistry?: import("@/lib/labels").Label[];
}) {
  const dotStyle = showPrimaryDot
    ? { backgroundColor: "var(--primary)" }
    : tagDotForLabel && labelRegistry
      ? tagDotStyle(tagDotForLabel, labelRegistry)
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium active:scale-[0.97] " +
        (active
          ? "border-primary-border bg-primary-bg text-primary"
          : "border-line bg-subtle text-muted hover:bg-subtle-hover hover:text-fg")
      }
      style={{
        transition:
          "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), color var(--motion-fast) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth)",
      }}
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
          "tabular-nums text-[11px] " +
          (active ? "text-primary opacity-75" : "text-faint")
        }
      >
        {count}
      </span>
    </button>
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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-faint"
        aria-hidden
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
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
          type="button"
          onClick={onAdd}
          className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          Add your first todo
        </button>
      )}
    </div>
  );
}
