"use client";

import { useMemo, useState } from "react";
import { useTodos } from "@/lib/useTodos";
import {
  Todo,
  SortKey,
  TodoInput,
  allLabels,
  filterTodos,
  formatDueDate,
  isOverdue,
  sortTodos,
} from "@/lib/todos";
import { withViewTransition } from "@/lib/viewTransition";
import TodoModal from "./TodoModal";
import ThemeToggle from "./ThemeToggle";

export default function TodoApp() {
  const { todos, hydrated, add, update, toggle, remove, clearCompleted } =
    useTodos();

  const [sort, setSort] = useState<SortKey>("createdDesc");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | undefined>(undefined);

  const labels = useMemo(() => allLabels(todos), [todos]);
  const visible = useMemo(
    () => sortTodos(filterTodos(todos, activeLabels, query), sort),
    [todos, activeLabels, query, sort],
  );

  const remaining = todos.filter((t) => !t.completed).length;

  function openNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(todo: Todo) {
    setEditing(todo);
    setModalOpen(true);
  }

  function handleSubmit(input: TodoInput) {
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
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pb-32 pt-8 sm:px-6 sm:pt-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">todos</h1>
            <span className="text-sm text-muted">
              {hydrated ? `${remaining} open` : " "}
            </span>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm placeholder:text-faint"
            />
            <label className="text-xs text-muted" htmlFor="sort">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => handleSort(e.target.value as SortKey)}
              className="rounded-lg border border-line-strong bg-card px-2 py-1.5 text-sm"
            >
              <option value="createdDesc">Newest</option>
              <option value="createdAsc">Oldest</option>
              <option value="titleAsc">Title (A→Z)</option>
              <option value="dueDate">Due date</option>
              <option value="completed">Open first</option>
            </select>
          </div>

          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const active = activeLabels.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLabelFilter(l)}
                    aria-pressed={active}
                    className={
                      "rounded-full border px-2.5 py-0.5 text-xs active:scale-95 " +
                      (active
                        ? "border-transparent bg-primary text-on-primary shadow-soft"
                        : "border-line bg-card text-muted hover:border-line-strong hover:text-fg")
                    }
                    style={{
                      transition:
                        "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), color var(--motion-fast) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth)",
                    }}
                  >
                    #{l}
                  </button>
                );
              })}
              {activeLabels.length > 0 && (
                <button
                  type="button"
                  onClick={clearLabelFilters}
                  className="rounded-full px-2.5 py-0.5 text-xs text-muted hover:text-fg hover:underline underline-offset-2"
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>

        <ul className="flex flex-col gap-2">
          {hydrated && visible.length === 0 && (
            <li className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted animate-fade-in">
              {todos.length === 0
                ? "No todos yet. Tap + to add one."
                : "Nothing matches."}
            </li>
          )}
          {visible.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={() => handleToggle(t.id)}
              onOpen={() => openEdit(t)}
            />
          ))}
        </ul>

        {todos.some((t) => t.completed) && (
          <button
            type="button"
            onClick={handleClearCompleted}
            className="self-start text-xs text-muted hover:text-fg hover:underline underline-offset-2"
          >
            Clear completed
          </button>
        )}
      </main>

      <button
        type="button"
        onClick={openNew}
        aria-label="Add todo"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-on-primary shadow-pop animate-pop-in hover:scale-105 active:scale-95"
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          transition:
            "transform var(--motion-fast) var(--ease-spring), box-shadow var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth)",
        }}
      >
        <span aria-hidden className="-mt-0.5 leading-none">+</span>
      </button>

      <TodoModal
        open={modalOpen}
        initial={editing}
        knownLabels={labels}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function TodoItem({
  todo,
  onToggle,
  onOpen,
}: {
  todo: Todo;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const overdue = isOverdue(todo.dueDate, todo.completed);
  return (
    <li
      className="todo-vt group flex items-start gap-3 rounded-xl border border-line bg-card p-3 shadow-soft hover:border-line-strong hover:shadow-card hover:-translate-y-px"
      style={{
        viewTransitionName: `todo-${todo.id}`,
        transition:
          "transform var(--motion-fast) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth)",
      }}
    >
      <AnimatedCheckbox
        checked={todo.completed}
        onChange={onToggle}
        label={todo.completed ? "Mark as open" : "Mark as done"}
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span
          className="todo-title text-sm leading-snug text-fg"
          data-completed={todo.completed}
        >
          {todo.title}
        </span>
        {todo.description && (
          <span
            className={
              "line-clamp-2 text-xs " +
              (todo.completed ? "text-faint" : "text-muted")
            }
            style={{
              transition: "color var(--motion-base) var(--ease-smooth)",
            }}
          >
            {todo.description}
          </span>
        )}
        {(todo.dueDate || todo.labels.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {todo.dueDate && (
              <span
                className={
                  "text-[10px] uppercase tracking-wide " +
                  (overdue ? "text-danger" : "text-muted")
                }
                style={{
                  transition: "color var(--motion-base) var(--ease-smooth)",
                }}
              >
                {overdue ? "overdue · " : "due · "}
                {formatDueDate(todo.dueDate)}
              </span>
            )}
            {todo.labels.map((l) => (
              <span
                key={l}
                className="rounded-full bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted"
              >
                #{l}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}

function AnimatedCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 select-none items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md border border-line-strong bg-card peer-checked:border-transparent peer-checked:bg-primary peer-hover:border-fg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
        style={{
          transition:
            "background-color var(--motion-base) var(--ease-smooth), border-color var(--motion-base) var(--ease-smooth), transform var(--motion-fast) var(--ease-spring)",
        }}
      />
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none relative h-3 w-3 scale-50 text-on-primary opacity-0 peer-checked:scale-100 peer-checked:opacity-100"
        style={{
          transition:
            "opacity var(--motion-base) var(--ease-smooth), transform var(--motion-base) var(--ease-spring)",
        }}
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
    </label>
  );
}
