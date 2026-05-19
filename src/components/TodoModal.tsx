"use client";

import { useEffect, useRef, useState } from "react";
import { Todo, TodoInput, normalizeLabel } from "@/lib/todos";
import {
  formatDueDate,
  isDueSoon,
  isOverdue,
  relativeTime,
  shortWeekday,
} from "@/lib/dates";
import { tagPillStyle } from "@/lib/tagColors";
import { type LabelColor } from "@/lib/labels";
import { useLabels } from "@/lib/useLabels";
import { NewLabelRow } from "./NewLabelRow";

type Props = {
  open: boolean;
  initial?: Todo;
  knownLabels: string[];
  onSubmit: (input: TodoInput) => void;
  onDelete?: () => void;
  onClose: () => void;
};

type Mode = "view" | "form";

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
  const { labels: labelRegistry, addLabel: addLabelToRegistry } = useLabels();
  const isExisting = !!initial;
  const [mode, setMode] = useState<Mode>(isExisting ? "view" : "form");

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
    if (mode !== "form") return;
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [mode]);

  // Lock background scroll while the modal is mounted. Using position:fixed
  // (rather than just overflow:hidden) is needed for iOS Safari, which
  // otherwise still lets the page scroll behind the dialog.
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
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
    const key = next.toLowerCase();
    setLabels((prev) =>
      prev.some((l) => l.toLowerCase() === key) ? prev : [...prev, next],
    );
    setLabelDraft("");
  }

  function removeLabel(label: string) {
    setExitingLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
    window.setTimeout(() => {
      setLabels((prev) => prev.filter((l) => l !== label));
      setExitingLabels((prev) => prev.filter((l) => l !== label));
    }, 160);
  }

  function commitSave() {
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
    setLabelDraft("");
    if (isExisting) setMode("view");
    else requestClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    commitSave();
  }

  function handleDelete() {
    if (!onDelete) return;
    onDelete();
    requestClose();
  }

  const heading =
    mode === "view"
      ? "Todo details"
      : isExisting
        ? "Edit todo"
        : "New todo";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className={
        "fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-md sm:items-center sm:p-4 " +
        (closing ? "animate-fade-out" : "animate-fade-in")
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={
          "flex w-full max-w-md flex-col bg-card shadow-pop " +
          // Mobile: bottom sheet pinned at 75dvh.
          "h-[75dvh] rounded-t-2xl " +
          // Desktop: auto height, cap at 85vh, fully rounded.
          "sm:h-auto sm:max-h-[85vh] sm:rounded-2xl " +
          (closing ? "animate-pop-out" : "animate-pop-in")
        }
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header (fixed) */}
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            {heading}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-fg"
          >
            <XIcon size={14} stroke={2} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          {mode === "view" && initial ? (
            <ViewBody
              title={title}
              description={description}
              dueDate={dueDate}
              labels={labels}
              labelRegistry={labelRegistry}
              completed={initial.completed}
              createdAt={initial.createdAt}
            />
          ) : (
            <FormBody
              titleRef={titleRef}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              dueDate={dueDate}
              setDueDate={setDueDate}
              labels={labels}
              exitingLabels={exitingLabels}
              labelDraft={labelDraft}
              setLabelDraft={setLabelDraft}
              addLabel={addLabel}
              addLabelWithColor={(name, color) => {
                addLabel(name);
                addLabelToRegistry(name, color);
              }}
              removeLabel={removeLabel}
              knownLabels={knownLabels}
              labelRegistry={labelRegistry}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* Action row (fixed) */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-6 py-4">
          {isExisting && onDelete ? (
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
            {mode === "view" ? (
              <button
                key="edit-btn"
                type="button"
                onClick={() => setMode("form")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover active:scale-[0.98]"
                style={{
                  transition:
                    "transform var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth)",
                }}
              >
                Edit
              </button>
            ) : (
              <button
                key="save-btn"
                type="submit"
                form="todo-form"
                disabled={!title.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-40 active:scale-[0.98]"
                style={{
                  transition:
                    "transform var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth), opacity var(--motion-fast) var(--ease-smooth)",
                }}
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

/* ---------- View body ---------- */

function ViewBody({
  title,
  description,
  dueDate,
  labels,
  labelRegistry,
  completed,
  createdAt,
}: {
  title: string;
  description: string;
  dueDate: string;
  labels: string[];
  labelRegistry: import("@/lib/labels").Label[];
  completed: boolean;
  createdAt: number;
}) {
  const overdue = isOverdue(dueDate || undefined, completed);
  const dueSoon = !overdue && isDueSoon(dueDate || undefined);
  return (
    <div className="flex flex-col gap-4 py-2 animate-fade-in">
      <h3 className="text-xl font-semibold leading-snug tracking-[-0.01em] text-fg">
        {title}
      </h3>

      {description && (
        <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-muted">
          {description}
        </p>
      )}

      {(dueDate || labels.length > 0) && (
        <div className="flex flex-col gap-2.5">
          {dueDate && (
            <div className="text-[13px]">
              {overdue ? (
                <span className="inline-flex items-center gap-1.5 text-danger">
                  <AlertCircleIcon />
                  Overdue · {shortWeekday(dueDate)}
                </span>
              ) : (
                <span
                  className={
                    "inline-flex items-center gap-1.5 " +
                    (dueSoon ? "text-primary" : "text-muted")
                  }
                >
                  <CalendarIcon />
                  {formatDueDate(dueDate)}
                </span>
              )}
            </div>
          )}

          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <span
                  key={l}
                  className="tag-pill"
                  style={tagPillStyle(l, labelRegistry)}
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center gap-3 border-t border-line pt-3 text-[11px] font-medium text-faint">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon />
          Created {relativeTime(createdAt)}
        </span>
      </div>
    </div>
  );
}

/* ---------- Form body (edit + create) ---------- */

function FormBody({
  titleRef,
  title,
  setTitle,
  description,
  setDescription,
  dueDate,
  setDueDate,
  labels,
  exitingLabels,
  labelDraft,
  setLabelDraft,
  addLabel,
  addLabelWithColor,
  removeLabel,
  knownLabels,
  labelRegistry,
  onSubmit,
}: {
  titleRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  labels: string[];
  exitingLabels: string[];
  labelDraft: string;
  setLabelDraft: (v: string) => void;
  addLabel: (raw: string) => void;
  addLabelWithColor: (name: string, color: LabelColor) => void;
  removeLabel: (label: string) => void;
  knownLabels: string[];
  labelRegistry: import("@/lib/labels").Label[];
  onSubmit: (e: React.FormEvent) => void;
}) {
  const suggestions = labelDraft
    ? (() => {
        const draftKey = normalizeLabel(labelDraft).toLowerCase();
        const usedKeys = new Set(labels.map((l) => l.toLowerCase()));
        return knownLabels
          .filter(
            (l) =>
              l.toLowerCase().includes(draftKey) &&
              !usedKeys.has(l.toLowerCase()),
          )
          .slice(0, 5);
      })()
    : [];

  return (
    <form id="todo-form" onSubmit={onSubmit} className="flex flex-col gap-4 py-2">
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
                  style={tagPillStyle(l, labelRegistry)}
                >
                  {l}
                  <button
                    type="button"
                    aria-label={`Remove ${l}`}
                    onClick={() => removeLabel(l)}
                    className="ml-0.5 inline-flex items-center justify-center rounded-full opacity-70 hover:opacity-100"
                  >
                    <XIcon size={9} stroke={3.5} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <NewLabelRow
          existingNames={
            new Set(labels.map((l) => l.toLowerCase()))
          }
          onAdd={addLabelWithColor}
          onNameChange={setLabelDraft}
          placeholder="Add a label, press Enter"
        />
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
    </form>
  );
}

/* ---------- Helpers ---------- */

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

function XIcon({ size = 14, stroke = 2 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function AlertCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
