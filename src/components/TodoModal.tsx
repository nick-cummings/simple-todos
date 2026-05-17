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

const EXIT_MS = 220;

export default function TodoModal(props: Props) {
  if (!props.open) return null;
  // Remount when switching todos / create-vs-edit so useState initializers
  // pick up the right defaults — no effect-driven state sync.
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
  const [exitingLabels, setExitingLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [closing, setClosing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => onClose(), EXIT_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // requestClose is stable via ref; intentional empty deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLabel(raw: string) {
    const next = normalizeLabel(raw);
    if (!next) return;
    setLabels((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setLabelDraft("");
  }

  function removeLabel(label: string) {
    // Mark for exit animation, then unmount after the animation finishes.
    setExitingLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
    window.setTimeout(() => {
      setLabels((prev) => prev.filter((l) => l !== label));
      setExitingLabels((prev) => prev.filter((l) => l !== label));
    }, 160);
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
    requestClose();
  }

  function handleDelete() {
    if (!onDelete) return;
    onDelete();
    requestClose();
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
      className={
        "fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 backdrop-blur-md sm:items-center sm:p-4 " +
        (closing ? "animate-fade-out" : "animate-fade-in")
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={
          "w-full max-w-md rounded-t-2xl bg-card p-5 shadow-pop sm:rounded-2xl " +
          (closing ? "animate-pop-out" : "animate-pop-in")
        }
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            {isEdit ? "Edit todo" : "New todo"}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="todo-title">
              Title
            </label>
            <input
              id="todo-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="rounded-lg border border-line-strong bg-card px-3 py-2 text-base placeholder:text-faint"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="todo-description">
              Description <span className="text-faint">(optional)</span>
            </label>
            <textarea
              id="todo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes, links, context…"
              className="resize-y rounded-lg border border-line-strong bg-card px-3 py-2 text-sm placeholder:text-faint"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="todo-due">
              Due date <span className="text-faint">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="text-xs text-muted hover:text-fg hover:underline underline-offset-2"
                >
                  clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted" htmlFor="todo-label">
              Labels <span className="text-faint">(one at a time)</span>
            </label>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const exiting = exitingLabels.includes(l);
                  return (
                    <span
                      key={l}
                      className={
                        "inline-flex items-center gap-1 overflow-hidden rounded-full bg-subtle px-2.5 py-0.5 text-xs text-fg " +
                        (exiting ? "animate-chip-out" : "animate-chip-in")
                      }
                    >
                      #{l}
                      <button
                        type="button"
                        aria-label={`Remove ${l}`}
                        onClick={() => removeLabel(l)}
                        className="rounded-full text-muted hover:text-danger"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
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
                    removeLabel(labels[labels.length - 1]);
                  }
                }}
                placeholder="Add a label (multi-word ok), press Enter"
                className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => addLabel(labelDraft)}
                disabled={!labelDraft.trim()}
                className="rounded-lg border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:bg-subtle disabled:opacity-40"
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
                    className="rounded-full border border-line bg-card px-2 py-0.5 text-xs text-muted hover:border-line-strong hover:text-fg"
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
                onClick={handleDelete}
                className="text-sm text-danger hover:underline underline-offset-2"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestClose}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-soft hover:shadow-card disabled:opacity-40 disabled:hover:shadow-soft active:scale-[0.98]"
                style={{
                  transition:
                    "transform var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth), opacity var(--motion-fast) var(--ease-smooth)",
                }}
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
