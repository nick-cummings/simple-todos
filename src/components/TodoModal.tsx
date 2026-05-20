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
import { type LabelColor, swatchFor } from "@/lib/labels";
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
          // Mobile: bottom sheet pinned at 88dvh — enough for the
          // taller description textarea without crowding the action row.
          "h-[88dvh] rounded-t-2xl " +
          // Desktop: auto height, cap at 92vh, fully rounded.
          "sm:h-auto sm:max-h-[92vh] sm:rounded-2xl " +
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
              labelDraft={labelDraft}
              setLabelDraft={setLabelDraft}
              addLabelWithColor={(name, color) => {
                addLabel(name);
                addLabelToRegistry(name, color);
              }}
              toggleLabel={toggleLabel}
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
  labelDraft,
  setLabelDraft,
  addLabelWithColor,
  toggleLabel,
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
  labelDraft: string;
  setLabelDraft: (v: string) => void;
  addLabelWithColor: (name: string, color: LabelColor) => void;
  toggleLabel: (name: string) => void;
  labelRegistry: import("@/lib/labels").Label[];
  onSubmit: (e: React.FormEvent) => void;
}) {
  // Source of truth for the picker is the label registry (all labels
  // the user has created, including ones not yet on any todo). Add any
  // labels currently on this todo that aren't in the registry so they
  // still appear in the picker — defensive against orphans.
  const pickerLabels = (() => {
    const out: { name: string; color: import("@/lib/labels").LabelColor }[] = [];
    const seen = new Set<string>();
    for (const l of labelRegistry) {
      const key = l.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: l.name, color: l.color });
    }
    for (const name of labels) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, color: "gray" });
    }
    return out;
  })();
  const selectedKeys = new Set(labels.map((l) => l.toLowerCase()));

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function getLocationBestEffort(): Promise<
    { latitude: number; longitude: number } | null
  > {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { timeout: 6000, maximumAge: 600_000 },
      );
    });
  }

  async function handleGenerateDescription() {
    if (!title.trim() || aiLoading) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const location = await getLocationBestEffort();
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), location }),
      });
      const data = (await res.json()) as
        | { description: string }
        | { error: string };
      if (!res.ok || !("description" in data)) {
        setAiError(
          "error" in data ? data.error : "Could not generate description.",
        );
        return;
      }
      setDescription(data.description);
    } catch {
      setAiError("Network error — try again.");
    } finally {
      setAiLoading(false);
    }
  }

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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="todo-description" className="text-xs text-muted">
            Description<span className="text-faint"> (optional)</span>
          </label>
          <button
            type="button"
            onClick={handleGenerateDescription}
            disabled={!title.trim() || aiLoading}
            aria-label="Generate description with AI"
            title={
              !title.trim()
                ? "Enter a title first"
                : "Generate description with AI"
            }
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong bg-card px-2 text-[11px] font-medium text-muted hover:border-line-emphasis hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {aiLoading ? <SpinnerIcon /> : <SparkleIcon />}
            <span>{aiLoading ? "Generating…" : "AI"}</span>
          </button>
        </div>
        <textarea
          id="todo-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Notes, links, context…"
          className="resize-y rounded-lg border border-line-strong bg-card px-3 py-2.5 text-[13px] leading-[1.55] placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
        />
        {aiError && (
          <p className="text-[11px] text-danger">{aiError}</p>
        )}
      </div>

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

      <div className="flex flex-col gap-3">
        <span className="text-xs text-muted">
          Labels <span className="text-faint">(tap to toggle)</span>
        </span>
        {pickerLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pickerLabels.map(({ name, color }) => {
              const swatch = swatchFor(color);
              const isSelected = selectedKeys.has(name.toLowerCase());
              return (
                <button
                  key={name.toLowerCase()}
                  type="button"
                  onClick={() => toggleLabel(name)}
                  aria-pressed={isSelected}
                  className="tag-pill items-center transition-all active:scale-[0.96]"
                  style={
                    isSelected
                      ? {
                          color: swatch.fg,
                          backgroundColor: swatch.bg,
                          border: `1px solid ${swatch.fg}33`,
                          textTransform: "none",
                        }
                      : {
                          color: swatch.fg,
                          backgroundColor: "transparent",
                          border: `1px dashed ${swatch.fg}66`,
                          opacity: 0.75,
                          textTransform: "none",
                        }
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-faint">
            No labels yet. Create one below.
          </p>
        )}
        <div className="border-t border-line pt-3">
          <span className="mb-2 block text-xs text-muted">
            Or create a new label
          </span>
          <NewLabelRow
            existingNames={
              new Set(pickerLabels.map((l) => l.name.toLowerCase()))
            }
            onAdd={addLabelWithColor}
            onNameChange={setLabelDraft}
            placeholder="New label name…"
          />
        </div>
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
function SparkleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.39 6.36L20.5 10.5l-6.11 2.14L12 19l-2.39-6.36L3.5 10.5l6.11-2.14L12 2z" />
      <path d="M18.5 15l.92 2.43L21.5 18l-2.08.57L18.5 21l-.92-2.43L15.5 18l2.08-.57L18.5 15z" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="40 60" opacity={0.9} />
    </svg>
  );
}
