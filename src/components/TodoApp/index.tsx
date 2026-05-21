"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { groupByDue, isCompletedThisWeek } from "@/lib/dates";
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
import { useReminders } from "@/lib/useReminders";
import { useTodos } from "@/lib/useTodos";
import { withViewTransition } from "@/lib/viewTransition";

import LabelsManager from "../LabelsManager";
import RemindersGate from "../RemindersGate";
import ThemeToggle from "../ThemeToggle";
import TodoCard from "../TodoCard";
import TodoModal from "../TodoModal";
import UndoToast from "../UndoToast";
import { EmptyState, SectionHeader } from "./EmptyState";
import { FilterChips } from "./FilterChips";
import { SearchInput } from "./SearchInput";
import { SortMenu } from "./SortMenu";
import { StatusChips } from "./StatusChips";

export default function TodoApp() {
  const {
    add,
    clearCompleted,
    hydrated,
    remove,
    restore,
    todos,
    toggle,
    update,
  } = useTodos();
  const { ensureLabelsExist, labels: labelRegistry } = useLabels();
  const {
    enable: enableReminders,
    needsAttention,
    syncTodoReminder,
  } = useReminders({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

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
  // Single-item undo: most recent deletion. Cleared when the user
  // undoes or when the toast's window expires.
  const [pendingUndo, setPendingUndo] = useState<null | Todo>(null);
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
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
  }, []);

  const labels = useMemo(() => allLabels(todos), [todos]);
  const counts = useMemo(() => labelCounts(todos), [todos]);
  const visible = useMemo(
    () =>
      sortTodos(filterTodos(todos, activeLabels, query, activeStatuses), sort),
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
    // Re-sync the reminder for this todo whenever it's saved. We
    // re-read from `todos` after the mutation has flushed by reading
    // post-state in a microtask; if we're editing, we have the id, if
    // we're adding, we need to scan for the new todo by title.
    queueMicrotask(() => {
      const target = editing
        ? (todos.find((t) => t.id === editing.id) ?? null)
        : (todos.find((t) => t.title === input.title.trim()) ?? null);
      if (target) void syncTodoReminder({ ...target, ...input });
    });
  }
  function handleDelete() {
    if (!editing) return;
    const todo = editing;
    withViewTransition(() => {
      remove(todo.id);
    });
    setPendingUndo(todo);
    // Drop any pending reminder for the deleted todo.
    void syncTodoReminder({ ...todo, completed: true });
  }
  function handleUndo() {
    if (!pendingUndo) return;
    const todo = pendingUndo;
    setPendingUndo(null);
    withViewTransition(() => {
      restore(todo);
    });
    void syncTodoReminder(todo);
  }
  function handleToggle(id: string) {
    withViewTransition(() => {
      toggle(id);
    });
    queueMicrotask(() => {
      const t = todos.find((todo) => todo.id === id);
      if (t) void syncTodoReminder({ ...t, completed: !t.completed });
    });
  }
  function toggleLabelFilter(label: string) {
    function nextLabels(prev: string[]): string[] {
      return prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label];
    }
    withViewTransition(() => {
      setActiveLabels(nextLabels);
    });
  }
  function clearLabelFilters() {
    withViewTransition(() => {
      setActiveLabels([]);
    });
  }
  function toggleStatusFilter(s: StatusFilter) {
    withViewTransition(() => {
      setActiveStatuses((prev) => {
        const next = new Set(prev);
        if (next.has(s)) next.delete(s);
        else next.add(s);
        return next;
      });
    });
  }
  function handleSort(next: SortKey) {
    withViewTransition(() => {
      setSort(next);
    });
  }
  function handleClearCompleted() {
    withViewTransition(() => {
      clearCompleted();
    });
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

        {needsAttention && <RemindersGate onEnable={enableReminders} />}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput onChange={setQuery} ref={searchRef} value={query} />
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
            onManage={() => {
              setLabelsManagerOpen(true);
            }}
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
                    onOpen={() => {
                      openEdit(t);
                    }}
                    onToggle={() => {
                      handleToggle(t.id);
                    }}
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
        <svg
          aria-hidden
          fill="none"
          height="22"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width="22"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <TodoModal
        initial={editing}
        onClose={() => {
          setModalOpen(false);
        }}
        onDelete={editing ? handleDelete : undefined}
        onSubmit={handleSubmit}
        open={modalOpen}
      />

      <LabelsManager
        onClose={() => {
          setLabelsManagerOpen(false);
        }}
        open={labelsManagerOpen}
      />

      <UndoToast
        message={pendingUndo ? `Deleted “${pendingUndo.title}”` : null}
        onExpire={() => {
          setPendingUndo(null);
        }}
        onUndo={handleUndo}
      />
    </>
  );
}
