"use client";

import { useEffect, useRef, useState } from "react";
import { Todo, TodoInput, normalizeLabel } from "@/lib/todos";
import { tagPillStyle } from "@/lib/tagColors";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLabel(raw: string) {
    const next = normalizeLabel(raw);
    if (!next) return;
    setLabels((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setLabelDraft("");
  }

  function removeLabel(label: string) {
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
          "w-full max-w-md rounded-t-2xl bg-card p-6 shadow-pop sm:rounded-2xl " +
          (closing ? "animate-pop-out" : "animate-pop-in")
        }
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field id="todo-title" label="Title">
            <input
              id="todo-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="h-11 rounded-lg border border-line-strong bg-card px-3 text-base placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
            />
          </Field>

          <Field id="todo-description" label="Description" optional>
            <textarea
              id="todo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes, links, context…"
              className="resize-y rounded-lg border border-line-strong bg-card px-3 py-2.5 text-[13px] leading-[1.55] placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
            />
          </Field>

          <Field id="todo-due" label="Due date" optional>
            <div className="flex items-center gap-2">
              <input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-11 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm hover:border-line-emphasis focus:border-line-emphasis"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:text-fg"
                >
                  clear
                </button>
              )}
            </div>
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted">
              Labels <span className="text-faint">(one at a time)</span>
            </span>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const exiting = exitingLabels.includes(l);
                  return (
                    <span
                      key={l}
                      className={
                        "tag-pill items-center gap-1 overflow-hidden " +
                        (exiting ? "animate-chip-out" : "animate-chip-in")
                      }
                      style={tagPillStyle(l)}
                    >
                      {l}
                      <button
                        type="button"
                        aria-label={`Remove ${l}`}
                        onClick={() => removeLabel(l)}
                        className="ml-0.5 inline-flex items-center justify-center rounded-full opacity-70 hover:opacity-100"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
                placeholder="Add a label, press Enter"
                className="h-10 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
              />
              <button
                type="button"
                onClick={() => addLabel(labelDraft)}
                disabled={!labelDraft.trim()}
                className="h-10 rounded-lg border border-line-strong bg-card px-3 text-sm font-medium hover:bg-card-hover disabled:opacity-40"
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
                    className="rounded-full border border-line bg-card px-2.5 py-1 text-[11px] text-muted hover:border-line-strong hover:text-fg"
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
                className="rounded-lg px-2.5 py-1.5 text-sm text-danger hover:bg-danger-bg"
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
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-40 active:scale-[0.98]"
                style={{
                  transition:
                    "transform var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth), opacity var(--motion-fast) var(--ease-smooth)",
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

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
        {optional && <span className="text-faint"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}
