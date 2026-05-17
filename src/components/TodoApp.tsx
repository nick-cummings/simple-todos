"use client";

import { useMemo, useState } from "react";
import { useTodos } from "@/lib/useTodos";
import {
  Todo,
  SortKey,
  allLabels,
  filterTodos,
  parseLabelsInput,
  sortTodos,
} from "@/lib/todos";

export default function TodoApp() {
  const { todos, hydrated, add, update, toggle, remove, clearCompleted } =
    useTodos();

  const [title, setTitle] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [sort, setSort] = useState<SortKey>("createdDesc");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const labels = useMemo(() => allLabels(todos), [todos]);
  const visible = useMemo(
    () => sortTodos(filterTodos(todos, activeLabels, query), sort),
    [todos, activeLabels, query, sort],
  );

  const remaining = todos.filter((t) => !t.completed).length;

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add(title, parseLabelsInput(labelsInput));
    setTitle("");
    setLabelsInput("");
  }

  function toggleLabelFilter(label: string) {
    setActiveLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">todos</h1>
        <span className="text-sm text-zinc-500">
          {hydrated ? `${remaining} open` : " "}
        </span>
      </header>

      <form onSubmit={onAdd} className="flex flex-col gap-2">
        <input
          aria-label="New todo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
        <div className="flex gap-2">
          <input
            aria-label="Labels"
            value={labelsInput}
            onChange={(e) => setLabelsInput(e.target.value)}
            placeholder="labels (comma or space separated)"
            list="known-labels"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
          <datalist id="known-labels">
            {labels.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </div>
      </form>

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
            {todos.length === 0 ? "No todos yet." : "Nothing matches."}
          </li>
        )}
        {visible.map((t) => (
          <TodoItem
            key={t.id}
            todo={t}
            onToggle={() => toggle(t.id)}
            onRemove={() => remove(t.id)}
            onUpdate={(patch) => update(t.id, patch)}
            knownLabels={labels}
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
  );
}

function TodoItem({
  todo,
  onToggle,
  onRemove,
  onUpdate,
  knownLabels,
}: {
  todo: Todo;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Pick<Todo, "title" | "labels">>) => void;
  knownLabels: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const [draftLabels, setDraftLabels] = useState(todo.labels.join(", "));

  function save() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) return;
    onUpdate({
      title: nextTitle,
      labels: parseLabelsInput(draftLabels),
    });
    setEditing(false);
  }

  function cancel() {
    setDraftTitle(todo.title);
    setDraftLabels(todo.labels.join(", "));
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          autoFocus
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        <input
          value={draftLabels}
          onChange={(e) => setDraftLabels(e.target.value)}
          placeholder="labels"
          list="known-labels-edit"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        <datalist id="known-labels-edit">
          {knownLabels.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <div className="flex justify-end gap-2 text-xs">
          <button onClick={cancel} className="text-zinc-500 hover:underline">
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded bg-zinc-900 px-2 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={onToggle}
        aria-label={todo.completed ? "Mark as open" : "Mark as done"}
        className="mt-1 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={
            "text-left text-sm leading-snug " +
            (todo.completed
              ? "text-zinc-400 line-through"
              : "text-zinc-900 dark:text-zinc-100")
          }
        >
          {todo.title}
        </button>
        {todo.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {todo.labels.map((l) => (
              <span
                key={l}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                #{l}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Delete"
        className="text-xs text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
      >
        ✕
      </button>
    </li>
  );
}
