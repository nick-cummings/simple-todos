"use client";

import { type SyntheticEvent, useEffect, useRef, useState } from "react";

import {
  formatDueDate,
  isDueSoon,
  isOverdue,
  relativeTime,
  shortWeekday,
} from "@/lib/dates";
import { type LabelColor, swatchFor } from "@/lib/labels";
import { tagPillStyle } from "@/lib/tagColors";
import { normalizeLabel, Todo, TodoInput } from "@/lib/todos";
import { useLabels } from "@/lib/useLabels";

import { NewLabelRow } from "./NewLabelRow";

type Mode = "form" | "view";

interface Props {
  initial?: Todo;
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: (input: TodoInput) => void;
  open: boolean;
}

// Best-effort browser geolocation; resolves null on unsupported
// platforms, denied permission, or timeout. Module-scoped so it isn't
// re-created on every render. Uses `in` for the geolocation check
// because typings claim navigator.geolocation is always defined, but
// it's actually absent in some sandboxed contexts (iOS Lockdown mode,
// http origins, headless browsers without the API enabled).
async function getLocationBestEffort(): Promise<
  null | { latitude: number; longitude: number }
> {
  if (
    typeof navigator === "undefined" ||
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !navigator.geolocation
  ) {
    return null;
  }
  return new Promise((resolve) => {
    // Only fires after the user explicitly clicks the
    // "Generate description with AI" button — that's the feature intent.
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => { resolve(null); },
      { maximumAge: 600_000, timeout: 6000 },
    );
  });
}

const EXIT_MS = 220;

export default function TodoModal(props: Props) {
  if (!props.open) return null;
  return <TodoModalContent key={props.initial?.id ?? "__new__"} {...props} />;
}

function AlertCircleIcon() {
  return (
    <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

/* ---------- View body ---------- */

function CalendarIcon() {
  return (
    <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/* ---------- Form body (edit + create) ---------- */

function ClockIcon() {
  return (
    <svg aria-hidden fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/* ---------- Helpers ---------- */

function Field({
  children,
  id,
  label,
  optional,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted" htmlFor={id}>
        {label}
        {optional && <span className="text-faint"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}

function FormBody({
  addLabelWithColor,
  description,
  dueDate,
  labelRegistry,
  labels,
  onSubmit,
  setDescription,
  setDueDate,
  setLabelDraft,
  setTitle,
  title,
  titleRef,
  toggleLabel,
}: {
  addLabelWithColor: (name: string, color: LabelColor) => void;
  description: string;
  dueDate: string;
  labelRegistry: import("@/lib/labels").Label[];
  labels: string[];
  onSubmit: (e: SyntheticEvent) => void;
  setDescription: (v: string) => void;
  setDueDate: (v: string) => void;
  setLabelDraft: (v: string) => void;
  setTitle: (v: string) => void;
  title: string;
  titleRef: React.RefObject<HTMLInputElement | null>;
  toggleLabel: (name: string) => void;
}) {
  // Source of truth for the picker is the label registry (all labels
  // the user has created, including ones not yet on any todo). Add any
  // labels currently on this todo that aren't in the registry so they
  // still appear in the picker — defensive against orphans.
  const pickerLabels = (() => {
    const out: { color: import("@/lib/labels").LabelColor; name: string; }[] = [];
    const seen = new Set<string>();
    for (const l of labelRegistry) {
      const key = l.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ color: l.color, name: l.name });
    }
    for (const name of labels) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ color: "gray", name });
    }
    return out;
  })();
  const selectedKeys = new Set(labels.map((l) => l.toLowerCase()));

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<null | string>(null);

  async function handleGenerateDescription() {
    if (!title.trim() || aiLoading) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const location = await getLocationBestEffort();
      const res = await fetch("/api/generate-description", {
        body: JSON.stringify({ location, title: title.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
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
    <form className="flex flex-col gap-4 py-2" id="todo-form" onSubmit={onSubmit}>
      <Field id="todo-title" label="Title">
        <input
          className="h-11 rounded-lg border border-line-strong bg-card px-3 text-base placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
          id="todo-title"
          onChange={(e) => { setTitle(e.target.value); }}
          placeholder="What needs doing?"
          ref={titleRef}
          value={title}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-muted" htmlFor="todo-description">
            Description<span className="text-faint"> (optional)</span>
          </label>
          <button
            aria-label="Generate description with AI"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong bg-card px-2 text-[11px] font-medium text-muted hover:border-line-emphasis hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!title.trim() || aiLoading}
            onClick={() => { void handleGenerateDescription(); }}
            title={
              title.trim()
                ? "Generate description with AI"
                : "Enter a title first"
            }
            type="button"
          >
            {aiLoading ? <SpinnerIcon /> : <SparkleIcon />}
            <span>{aiLoading ? "Generating…" : "AI"}</span>
          </button>
        </div>
        <textarea
          className="resize-y rounded-lg border border-line-strong bg-card px-3 py-2.5 text-[13px] leading-[1.55] placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
          id="todo-description"
          onChange={(e) => { setDescription(e.target.value); }}
          placeholder="Notes, links, context…"
          rows={6}
          value={description}
        />
        {aiError && (
          <p className="text-[11px] text-danger">{aiError}</p>
        )}
      </div>

      <Field id="todo-due" label="Due date" optional>
        <div className="flex items-center gap-2">
          <input
            className="h-11 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm hover:border-line-emphasis focus:border-line-emphasis"
            id="todo-due"
            onChange={(e) => { setDueDate(e.target.value); }}
            type="date"
            value={dueDate}
          />
          {dueDate && (
            <button
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:text-fg"
              onClick={() => { setDueDate(""); }}
              type="button"
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
            {pickerLabels.map(({ color, name }) => {
              const swatch = swatchFor(color);
              const isSelected = selectedKeys.has(name.toLowerCase());
              return (
                <button
                  aria-pressed={isSelected}
                  className="tag-pill items-center transition-all active:scale-[0.96]"
                  key={name.toLowerCase()}
                  onClick={() => { toggleLabel(name); }}
                  style={
                    isSelected
                      ? {
                          backgroundColor: swatch.bg,
                          border: `1px solid ${swatch.fg}33`,
                          color: swatch.fg,
                          textTransform: "none",
                        }
                      : {
                          backgroundColor: "transparent",
                          border: `1px dashed ${swatch.fg}66`,
                          color: swatch.fg,
                          opacity: 0.75,
                          textTransform: "none",
                        }
                  }
                  type="button"
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
function SparkleIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="12"
      viewBox="0 0 24 24"
      width="12"
    >
      <path d="M12 2l2.39 6.36L20.5 10.5l-6.11 2.14L12 19l-2.39-6.36L3.5 10.5l6.11-2.14L12 2z" />
      <path d="M18.5 15l.92 2.43L21.5 18l-2.08.57L18.5 21l-.92-2.43L15.5 18l2.08-.57L18.5 15z" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg
      aria-hidden
      className="animate-spin"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      width="12"
    >
      <circle cx="12" cy="12" opacity={0.9} r="9" strokeDasharray="40 60" />
    </svg>
  );
}
function TodoModalContent({
  initial,
  onClose,
  onDelete,
  onSubmit,
}: Props) {
  const { addLabel: addLabelToRegistry, labels: labelRegistry } = useLabels();
  const isExisting = Boolean(initial);
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
    return () => { clearTimeout(t); };
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
    globalThis.setTimeout(() => { onClose(); }, EXIT_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => { globalThis.removeEventListener("keydown", onKey); };
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
      className={
        `fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-md sm:items-center sm:p-4 ${ 
        closing ? "animate-fade-out" : "animate-fade-in"}`
      }
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
          closing ? "animate-pop-out" : "animate-pop-in"}`
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
              setDescription={setDescription}
              setDueDate={setDueDate}
              setLabelDraft={setLabelDraft}
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
                onClick={() => { setMode("form"); }}
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
function ViewBody({
  completed,
  createdAt,
  description,
  dueDate,
  labelRegistry,
  labels,
  title,
}: {
  completed: boolean;
  createdAt: number;
  description: string;
  dueDate: string;
  labelRegistry: import("@/lib/labels").Label[];
  labels: string[];
  title: string;
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
                    `inline-flex items-center gap-1.5 ${ 
                    dueSoon ? "text-primary" : "text-muted"}`
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
                  className="tag-pill"
                  key={l}
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
function XIcon({ size = 14, stroke = 2 }: { size?: number; stroke?: number }) {
  return (
    <svg aria-hidden fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stroke} viewBox="0 0 24 24" width={size}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
