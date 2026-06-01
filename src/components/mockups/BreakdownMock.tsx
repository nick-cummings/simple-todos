"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Design exploration for the "AI task breakdown" feature. A todo grows
 * a "Break this down" action; tapping it asks an AI to suggest a handful
 * of subtasks, which land in an editable review list. Each suggestion
 * can be:
 *   - accepted (the checkbox — accepted rows are what gets added),
 *   - edited  (the text is an inline input you can retype),
 *   - discarded (the × — moves it to a collapsed "Discarded" tray with
 *     a Restore affordance, so a mis-tap is recoverable).
 * "Add N subtasks" commits the accepted set and shows the resulting
 * child rows under the parent.
 *
 * The "AI" here is canned: a fixed suggestion set keyed off the parent
 * title, returned after a short fake delay so the loading state is
 * visible. No network, no Anthropic call.
 *
 * Open design questions for the real implementation:
 *  - Where does "Break this down" live? (TodoModal action row, card
 *    overflow menu, or both?)
 *  - Data model: do subtasks become first-class todos with a parentId,
 *    or a lightweight `subtasks: string[]` on the parent? The former
 *    enables independent due dates / completion; the latter is cheaper.
 *  - Should the request send existing context (labels, due date) so the
 *    suggestions are scoped, like ai-description sends geolocation?
 *  - Rate limiting + secrets posture mirrors ai-description.md.
 */

import { useId, useMemo, useState } from "react";

type Phase = "added" | "generating" | "idle" | "review";
type Status = "accepted" | "discarded" | "pending";

type Suggestion = {
  id: string;
  text: string;
  status: Status;
};

const PARENT_TITLE = "Plan Maya's birthday party";

// What the canned "AI" returns for the parent above.
const SUGGESTED: string[] = [
  "Pick a date and send invitations",
  "Book the venue or set up the backyard",
  "Order the cake (chocolate, no nuts)",
  "Plan games and activities for the kids",
  "Buy decorations, plates, and party favors",
  "Arrange a photographer or set up a photo corner",
];

let counter = 0;
function freshId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export default function BreakdownMock() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDiscarded, setShowDiscarded] = useState(false);

  const active = useMemo(
    () => suggestions.filter((s) => s.status !== "discarded"),
    [suggestions],
  );
  const discarded = useMemo(
    () => suggestions.filter((s) => s.status === "discarded"),
    [suggestions],
  );
  const accepted = useMemo(
    () => suggestions.filter((s) => s.status === "accepted"),
    [suggestions],
  );

  function generate() {
    setPhase("generating");
    setShowDiscarded(false);
    // Simulated AI latency so the loading state is visible.
    window.setTimeout(() => {
      setSuggestions(
        SUGGESTED.map((text) => ({
          id: freshId("sg"),
          text,
          status: "accepted",
        })),
      );
      setPhase("review");
    }, 900);
  }

  function setStatus(id: string, status: Status) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
  }

  function toggleAccept(id: string) {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "accepted" ? "pending" : "accepted" }
          : s,
      ),
    );
  }

  function editText(id: string, text: string) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text } : s)),
    );
  }

  function reset() {
    setSuggestions([]);
    setShowDiscarded(false);
    setPhase("idle");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-7 px-5 pt-10 pb-28 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Mockup
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          Break this down
        </h1>
        <p className="text-[13px] text-muted">
          Turn a big todo into a set of suggested subtasks. Review, edit,
          and discard before adding the ones you want.
        </p>
      </header>

      {/* Parent todo card */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-emphasis" />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-medium text-fg">
              {PARENT_TITLE}
            </span>
            <span className="text-[12px] text-faint">Due Sat · no labels</span>
          </div>
        </div>

        {phase === "added" && accepted.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-line pt-3">
            {accepted.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-2.5 pl-1 text-[13px] text-muted"
              >
                <span
                  aria-hidden
                  className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-line-emphasis"
                />
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        )}

        {phase !== "review" && (
          <button
            type="button"
            onClick={generate}
            disabled={phase === "generating"}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-line-strong bg-subtle px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-card disabled:opacity-60"
          >
            <SparkleIcon />
            {phase === "generating"
              ? "Thinking…"
              : phase === "added"
                ? "Break it down again"
                : "Break this down"}
          </button>
        )}
      </div>

      {phase === "generating" && <SkeletonList />}

      {phase === "review" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold text-fg">
              Suggested subtasks
            </h2>
            <button
              type="button"
              onClick={generate}
              className="text-[12px] font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Regenerate
            </button>
          </div>

          {active.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-subtle px-4 py-6 text-center text-[13px] text-faint">
              No suggestions left. Regenerate or restore a discarded one.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((s) => (
                <SuggestionRow
                  key={s.id}
                  suggestion={s}
                  onToggleAccept={() => toggleAccept(s.id)}
                  onEdit={(text) => editText(s.id, text)}
                  onDiscard={() => setStatus(s.id, "discarded")}
                />
              ))}
            </ul>
          )}

          {discarded.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowDiscarded((v) => !v)}
                aria-expanded={showDiscarded}
                className="self-start text-[12px] text-faint underline-offset-2 hover:text-muted hover:underline"
              >
                {showDiscarded ? "Hide" : "Show"} discarded ({discarded.length})
              </button>
              {showDiscarded && (
                <ul className="flex flex-col gap-1.5">
                  {discarded.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-[13px] text-faint"
                    >
                      <span className="flex-1 truncate line-through">
                        {s.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStatus(s.id, "accepted")}
                        className="shrink-0 font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase("added")}
              disabled={accepted.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-fg px-4 py-2.5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {accepted.length === 0
                ? "Select subtasks to add"
                : `Add ${accepted.length} subtask${accepted.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-[13px] font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {phase === "added" && (
        <p
          role="status"
          className="rounded-xl border border-line bg-subtle px-4 py-3 text-[13px] text-muted"
        >
          Added {accepted.length} subtask{accepted.length === 1 ? "" : "s"} to
          “{PARENT_TITLE}”.
        </p>
      )}
    </main>
  );
}

function SuggestionRow({
  suggestion,
  onToggleAccept,
  onEdit,
  onDiscard,
}: {
  suggestion: Suggestion;
  onToggleAccept: () => void;
  onEdit: (text: string) => void;
  onDiscard: () => void;
}) {
  const checkboxId = useId();
  const accepted = suggestion.status === "accepted";
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2 shadow-soft">
      <input
        id={checkboxId}
        type="checkbox"
        checked={accepted}
        onChange={onToggleAccept}
        aria-label={`Accept "${suggestion.text}"`}
        className="h-4 w-4 shrink-0 accent-fg"
      />
      <input
        type="text"
        value={suggestion.text}
        onChange={(e) => onEdit(e.target.value)}
        aria-label="Edit subtask"
        className={`h-9 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[13px] text-fg hover:border-line focus:border-line-strong focus:outline-none ${
          accepted ? "" : "text-muted"
        }`}
      />
      <button
        type="button"
        onClick={onDiscard}
        aria-label={`Discard "${suggestion.text}"`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-subtle hover:text-fg"
      >
        <CrossIcon />
      </button>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-3 shadow-soft"
        >
          <span className="h-4 w-4 shrink-0 rounded-sm bg-subtle" />
          <span
            className="h-3 animate-pulse rounded bg-subtle"
            style={{ width: `${70 - i * 8}%` }}
          />
        </li>
      ))}
    </ul>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16l-1.9-5.1L4.5 9l5.6-1.4L12 2zM19 14l.9 2.6L22.5 18l-2.6.9L19 21l-.9-2.1L15.5 18l2.6-.4L19 14z" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
