import { type SyntheticEvent, useState } from "react";

import type { Recurrence } from "@/lib/todos";

import { type Label, type LabelColor, swatchFor } from "@/lib/labels";

import { NewLabelRow } from "../NewLabelRow";
import { getLocationBestEffort } from "./getLocationBestEffort";
import { SparkleIcon, SpinnerIcon } from "./Icons";
import { RepeatPicker } from "./RepeatPicker";

export function FormBody({
  addLabelWithColor,
  description,
  dueDate,
  labelRegistry,
  labels,
  onSubmit,
  recurrence,
  setDescription,
  setDueDate,
  setLabelDraft,
  setRecurrence,
  setTitle,
  title,
  titleRef,
  toggleLabel,
}: {
  addLabelWithColor: (name: string, color: LabelColor) => void;
  description: string;
  dueDate: string;
  labelRegistry: Label[];
  labels: string[];
  onSubmit: (e: SyntheticEvent) => void;
  recurrence: Recurrence | undefined;
  setDescription: (v: string) => void;
  setDueDate: (v: string) => void;
  setLabelDraft: (v: string) => void;
  setRecurrence: (r: Recurrence | undefined) => void;
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
    const out: { color: LabelColor; name: string }[] = [];
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
    <form
      className="flex flex-col gap-4 py-2"
      id="todo-form"
      onSubmit={onSubmit}
    >
      <Field id="todo-title" label="Title">
        <input
          className="h-11 rounded-lg border border-line-strong bg-card px-3 text-base placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
          id="todo-title"
          onChange={(e) => {
            setTitle(e.target.value);
          }}
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
            onClick={() => {
              void handleGenerateDescription();
            }}
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
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          placeholder="Notes, links, context…"
          rows={6}
          value={description}
        />
        {aiError && <p className="text-[11px] text-danger">{aiError}</p>}
      </div>

      <Field id="todo-due" label="Due date" optional>
        <div className="flex items-center gap-2">
          <input
            className="h-11 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm hover:border-line-emphasis focus:border-line-emphasis"
            id="todo-due"
            onChange={(e) => {
              setDueDate(e.target.value);
            }}
            type="date"
            value={dueDate}
          />
          {dueDate && (
            <button
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:text-fg"
              onClick={() => {
                setDueDate("");
              }}
              type="button"
            >
              clear
            </button>
          )}
        </div>
      </Field>

      <RepeatPicker onChange={setRecurrence} value={recurrence} />

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
                  onClick={() => {
                    toggleLabel(name);
                  }}
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
