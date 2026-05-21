"use client";

import { type SyntheticEvent, useEffect, useRef, useState } from "react";

import { normalizeLabel, type Recurrence, Todo, TodoInput } from "@/lib/todos";
import { useLabels } from "@/lib/useLabels";

import { FormBody } from "./FormBody";
import { XIcon } from "./Icons";
import { ViewBody } from "./ViewBody";

type Mode = "form" | "view";

interface Props {
  initial?: Todo;
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: (input: TodoInput) => void;
  open: boolean;
}

const EXIT_MS = 220;

export default function TodoModal(props: Props) {
  if (!props.open) return null;
  return <TodoModalContent key={props.initial?.id ?? "__new__"} {...props} />;
}

function TodoModalContent({ initial, onClose, onDelete, onSubmit }: Props) {
  const { addLabel: addLabelToRegistry, labels: labelRegistry } = useLabels();
  const isExisting = Boolean(initial);
  const [mode, setMode] = useState<Mode>(isExisting ? "view" : "form");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [labels, setLabels] = useState<string[]>(initial?.labels ?? []);
  const [labelDraft, setLabelDraft] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(
    initial?.recurrence,
  );
  const [closing, setClosing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (mode !== "form") return;
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
    };
  }, [mode]);

  // Lock background scroll while the modal is mounted. Using position:fixed
  // (rather than just overflow:hidden) is needed for iOS Safari, which
  // otherwise still lets the page scroll behind the dialog.
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    globalThis.setTimeout(() => {
      onClose();
    }, EXIT_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLabel(raw: string) {
    const next = normalizeLabel(raw);
    if (!next) return;
    const key = next.toLowerCase();
    setLabels((prev) =>
      prev.some((l) => l.toLowerCase() === key) ? prev : [...prev, next],
    );
    setLabelDraft("");
  }

  function toggleLabel(name: string) {
    const key = name.toLowerCase();
    setLabels((prev) =>
      prev.some((l) => l.toLowerCase() === key)
        ? prev.filter((l) => l.toLowerCase() !== key)
        : [...prev, name],
    );
  }

  function commitSave() {
    if (!title.trim()) return;
    const finalLabels = labelDraft.trim()
      ? [...labels, normalizeLabel(labelDraft)].filter(Boolean)
      : labels;
    onSubmit({
      description: description || undefined,
      dueDate: dueDate || undefined,
      labels: finalLabels,
      recurrence,
      title,
    });
    setLabelDraft("");
    if (isExisting) setMode("view");
    else requestClose();
  }

  function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    commitSave();
  }

  function handleDelete() {
    if (!onDelete) return;
    onDelete();
    requestClose();
  }

  let heading: string;
  if (mode === "view") {
    heading = "Todo details";
  } else if (isExisting) {
    heading = "Edit todo";
  } else {
    heading = "New todo";
  }

  return (
    <div
      aria-label={heading}
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-md sm:items-center sm:p-4 ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      role="dialog"
    >
      <div
        className={
          `flex w-full max-w-md flex-col bg-card shadow-pop ` +
          // Mobile: bottom sheet pinned at 88dvh — enough for the
          // taller description textarea without crowding the action row.
          `h-[88dvh] rounded-t-2xl ` +
          // Desktop: auto height, cap at 92vh, fully rounded.
          `sm:h-auto sm:max-h-[92vh] sm:rounded-2xl ${
            closing ? "animate-pop-out" : "animate-pop-in"
          }`
        }
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header (fixed) */}
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            {heading}
          </h2>
          <button
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
            onClick={requestClose}
            type="button"
          >
            <XIcon size={14} stroke={2} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          {mode === "view" && initial ? (
            <ViewBody
              completed={initial.completed}
              createdAt={initial.createdAt}
              description={description}
              dueDate={dueDate}
              labelRegistry={labelRegistry}
              labels={labels}
              title={title}
            />
          ) : (
            <FormBody
              addLabelWithColor={(name, color) => {
                addLabel(name);
                addLabelToRegistry(name, color);
              }}
              description={description}
              dueDate={dueDate}
              labelRegistry={labelRegistry}
              labels={labels}
              onSubmit={handleSubmit}
              recurrence={recurrence}
              setDescription={setDescription}
              setDueDate={setDueDate}
              setLabelDraft={setLabelDraft}
              setRecurrence={setRecurrence}
              setTitle={setTitle}
              title={title}
              titleRef={titleRef}
              toggleLabel={toggleLabel}
            />
          )}
        </div>

        {/* Action row (fixed) */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-6 py-4">
          {isExisting && onDelete ? (
            <button
              className="rounded-lg px-2.5 py-1.5 text-sm text-danger hover:bg-danger-bg"
              onClick={handleDelete}
              type="button"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle hover:text-fg"
              onClick={requestClose}
              type="button"
            >
              Cancel
            </button>
            {mode === "view" ? (
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover active:scale-[0.98]"
                key="edit-btn"
                onClick={() => {
                  setMode("form");
                }}
                style={{
                  transition:
                    "transform var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth)",
                }}
                type="button"
              >
                Edit
              </button>
            ) : (
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-40 active:scale-[0.98]"
                disabled={!title.trim()}
                form="todo-form"
                key="save-btn"
                style={{
                  transition:
                    "transform var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth), opacity var(--motion-fast) var(--ease-smooth)",
                }}
                type="submit"
              >
                {isExisting ? "Save" : "Add"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
