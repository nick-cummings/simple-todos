"use client";

import { useEffect, useRef, useState } from "react";
import { Todo, TodoInput, normalizeLabel } from "@/lib/todos";

type Props = {
  open: boolean;
  initial?: Todo;
  knownLabels: string[];
  onSubmit: (input: TodoInput) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export default function TodoModal(props: Props) {
  if (!props.open) return null;
  // Remount the form when switching between todos / create-vs-edit so
  // useState initializers pick up the right defaults — no effect-driven
  // state sync needed.
  return <TodoModalContent key={props.initial?.id ?? "__new__"} {...props} />;
}

function TodoModalContent({
  initial,
  knownLabels,
  onSubmit,
  onDelete,
  onClose,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [labels, setLabels] = useState<string[]>(initial?.labels ?? []);
  const [labelDraft, setLabelDraft] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addLabel(raw: string) {
    const next = normalizeLabel(raw);
    if (!next) return;
    setLabels((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setLabelDraft("");
  }

  function removeLabel(label: string) {
    setLabels((prev) => prev.filter((l) => l !== label));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const finalLabels = labelDraft.trim()
      ? [...labels, normalizeLabel(labelDraft)].filter(Boolean)
      : labels;
    onSubmit({
      title,
      description: description || undefined,
      dueDate: dueDate || undefined,
      labels: finalLabels,
    });
    onClose();
  }

  const isEdit = !!initial;
  const suggestions = labelDraft
    ? knownLabels
        .filter(
          (l) =>
            l.includes(normalizeLabel(labelDraft)) && !labels.includes(l),
        )
        .slice(0, 5)
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit todo" : "Add todo"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl dark:bg-zinc-900 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit todo" : "New todo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="todo-title">
              Title
            </label>
            <input
              id="todo-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="todo-description">
              Description <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="todo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes, links, context…"
              className="resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500" htmlFor="todo-due">
              Due date <span className="text-zinc-400">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-500" htmlFor="todo-label">
              Labels <span className="text-zinc-400">(one at a time)</span>
            </label>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    #{l}
                    <button
                      type="button"
                      aria-label={`Remove ${l}`}
                      onClick={() => removeLabel(l)}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                id="todo-label"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLabel(labelDraft);
                  } else if (
                    e.key === "Backspace" &&
                    labelDraft === "" &&
                    labels.length > 0
                  ) {
                    setLabels((prev) => prev.slice(0, -1));
                  }
                }}
                placeholder="Add a label (multi-word ok), press Enter"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
              />
              <button
                type="button"
                onClick={() => addLabel(labelDraft)}
                disabled={!labelDraft.trim()}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
              >
                Add
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addLabel(s)}
                    className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    #{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {isEdit && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="text-sm text-red-500 hover:underline"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {isEdit ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
