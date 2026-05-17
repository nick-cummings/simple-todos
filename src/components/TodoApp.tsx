"use client";

import { useMemo, useState } from "react";
import { useTodos } from "@/lib/useTodos";
import {
  Todo,
  SortKey,
  allLabels,
  filterTodos,
  formatDueDate,
  isOverdue,
  sortTodos,
} from "@/lib/todos";
import TodoModal from "./TodoModal";

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

  function toggleLabelFilter(label: string) {
    setActiveLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }

  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-8 pb-28 sm:py-12">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">todos</h1>
          <span className="text-sm text-zinc-500">
            {hydrated ? `${remaining} open` : " "}
          </span>
        </header>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
            />
            <label className="text-xs text-zinc-500" htmlFor="sort">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                    className={
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors " +
                      (active
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300")
                    }
                  >
                    #{l}
                  </button>
                );
              })}
              {activeLabels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveLabels([])}
                  className="rounded-full px-2.5 py-0.5 text-xs text-zinc-500 underline-offset-2 hover:underline"
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>

        <ul className="flex flex-col gap-2">
          {hydrated && visible.length === 0 && (
            <li className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              {todos.length === 0 ? "No todos yet. Tap + to add one." : "Nothing matches."}
            </li>
          )}
          {visible.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={() => toggle(t.id)}
              onOpen={() => openEdit(t)}
            />
          ))}
        </ul>

        {todos.some((t) => t.completed) && (
          <button
            type="button"
            onClick={clearCompleted}
            className="self-start text-xs text-zinc-500 underline-offset-2 hover:underline"
          >
            Clear completed
          </button>
        )}
      </main>

      <button
        type="button"
        onClick={openNew}
        aria-label="Add todo"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-2xl text-white shadow-lg transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span aria-hidden>+</span>
      </button>

      <TodoModal
        open={modalOpen}
        initial={editing}
        knownLabels={labels}
        onSubmit={(input) => {
          if (editing) update(editing.id, input);
          else add(input);
        }}
        onDelete={editing ? () => remove(editing.id) : undefined}
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
    <li className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={todo.completed ? "Mark as open" : "Mark as done"}
        className="mt-1 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span
          className={
            "text-sm leading-snug " +
            (todo.completed
              ? "text-zinc-400 line-through"
              : "text-zinc-900 dark:text-zinc-100")
          }
        >
          {todo.title}
        </span>
        {todo.description && (
          <span
            className={
              "line-clamp-2 text-xs " +
              (todo.completed
                ? "text-zinc-400"
                : "text-zinc-500 dark:text-zinc-400")
            }
          >
            {todo.description}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {todo.dueDate && (
            <span
              className={
                "text-[10px] uppercase tracking-wide " +
                (overdue
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-500 dark:text-zinc-400")
              }
            >
              {overdue ? "overdue · " : "due · "}
              {formatDueDate(todo.dueDate)}
            </span>
          )}
          {todo.labels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              #{l}
            </span>
          ))}
        </div>
      </button>
    </li>
  );
}
