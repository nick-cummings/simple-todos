"use client";

/**
 * MOCKUP — not wired into the app.
 *
 * Demonstrates the "Voice brain-dump" flow: the user dictates (or
 * pastes) a stream-of-consciousness note into a big textarea, hits
 * "Extract tasks", and gets back an editable list of detected todos
 * they can tweak before saving.
 *
 *   dump ──▶ extract ──▶ edit
 *
 * Real implementation notes:
 *  - Dictation: the Web Speech API (`SpeechRecognition`) streams
 *    interim transcripts into the textarea on supported browsers;
 *    Safari/iOS support is partial, so a plain textarea is the
 *    always-available fallback. The mic button here just simulates
 *    capture by appending a sample utterance.
 *  - Extraction: in production this is a Claude call (tier-2-ai) that
 *    turns prose into discrete, deduped task titles — see
 *    docs/features/ai-description.md for the existing Claude wiring.
 *    The `extractTasks` heuristic below is a stand-in so the mockup
 *    runs with zero network: it splits on lines / sentence breaks,
 *    strips bullet and filler prefixes, and de-dupes.
 *  - Edit: each detected task is an inline-editable row with a remove
 *    control; "Add task" appends a blank row. On save the real flow
 *    would create one todo per row.
 */

import { useMemo, useRef, useState } from "react";

type TaskDraft = { id: string; title: string };

const SAMPLE_DUMP = `ok so for this weekend — need to call the dentist about rescheduling, and book flights for the offsite before prices jump. don't forget to buy a birthday gift for mom. also water the plants!! pick up the dry cleaning. I should really reply to Sarah's email about the budget. oh and renew the car registration before it expires.`;

const DICTATION_CHUNKS = [
  "remember to send the invoice to the client",
  "schedule a follow-up with the design team next week",
  "back up the laptop before the OS update",
];

// Words/phrases that commonly open a spoken fragment but aren't part
// of the task itself. Stripped from the front of each candidate.
const FILLER_PREFIXES = [
  "ok so",
  "also",
  "and",
  "oh and",
  "don't forget to",
  "dont forget to",
  "i should really",
  "i should",
  "i need to",
  "need to",
  "remember to",
  "make sure to",
  "gotta",
];

/**
 * Heuristic prose → task-title splitter. Stands in for a Claude call
 * in the mockup. Not exhaustive — just enough to make the demo feel
 * real: split on newlines + sentence punctuation, drop filler
 * prefixes and bullet markers, title-case the first letter, de-dupe.
 */
export function extractTasks(raw: string): string[] {
  const fragments = raw
    .split(/[\n.!?;]+|(?:,?\s+(?:and|also)\s+)/i)
    .map((f) => f.trim());

  const seen = new Set<string>();
  const tasks: string[] = [];

  for (const fragment of fragments) {
    let cleaned = fragment.replace(/^[-*•\d.)\s]+/, "").trim();
    if (!cleaned) continue;

    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of FILLER_PREFIXES) {
        const re = new RegExp(`^${prefix}\\b[\\s,:-]*`, "i");
        if (re.test(cleaned)) {
          cleaned = cleaned.replace(re, "").trim();
          changed = true;
        }
      }
    }

    // Too short to be a meaningful task after cleaning.
    if (cleaned.split(/\s+/).length < 2) continue;

    const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push(title);
  }

  return tasks;
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `task-${idSeq}`;
}

export default function VoiceCaptureMock() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[] | null>(null);
  const [listening, setListening] = useState(false);
  const chunkIndex = useRef(0);

  const detectedCount = tasks?.length ?? 0;

  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [text]);

  function handleExtract() {
    const titles = extractTasks(text);
    setTasks(titles.map((title) => ({ id: nextId(), title })));
  }

  function handleSimulateDictation() {
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    const chunk = DICTATION_CHUNKS[chunkIndex.current % DICTATION_CHUNKS.length];
    chunkIndex.current += 1;
    setText((prev) => (prev ? `${prev.trimEnd()}. ${chunk}` : chunk));
  }

  function updateTask(id: string, title: string) {
    setTasks((prev) =>
      prev ? prev.map((t) => (t.id === id ? { ...t, title } : t)) : prev,
    );
  }

  function removeTask(id: string) {
    setTasks((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
  }

  function addTask() {
    setTasks((prev) => [...(prev ?? []), { id: nextId(), title: "" }]);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-5 pt-10 pb-32 sm:px-8 sm:pt-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-5xl font-semibold leading-none tracking-[-0.045em]">
          todos
        </h1>
        <p className="text-[13px] text-muted">
          Mockup — voice brain-dump. Dictate or type a messy note, extract the
          tasks, then edit the list before saving.
        </p>
      </header>

      {/* (1) Dump — the dictation textarea */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            Brain dump
          </span>
          <button
            type="button"
            onClick={() => {
              setText(SAMPLE_DUMP);
              setTasks(null);
            }}
            className="text-[12px] font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Load example
          </button>
        </div>

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Tap the mic and start talking, or just type everything on your mind…"
            className="w-full resize-y rounded-2xl border border-line-strong bg-card px-4 py-3.5 text-base leading-relaxed text-fg shadow-pop outline-none placeholder:text-faint focus:border-line-emphasis focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSimulateDictation}
            aria-pressed={listening}
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            className={
              `absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border transition ` +
              (listening
                ? "animate-pulse border-danger bg-danger-bg text-danger"
                : "border-primary-border bg-primary text-on-primary hover:bg-primary-hover")
            }
          >
            <MicIcon />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-faint">
            {listening
              ? "Listening… (simulated)"
              : `${wordCount} ${wordCount === 1 ? "word" : "words"}`}
          </span>
          <button
            type="button"
            onClick={handleExtract}
            disabled={!text.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Extract tasks
          </button>
        </div>
      </section>

      {/* (2 + 3) Extract → Edit — the detected task list */}
      {tasks !== null && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              Detected tasks
            </span>
            <span className="text-[11px] text-faint">
              {detectedCount} {detectedCount === 1 ? "task" : "tasks"}
            </span>
          </div>

          {detectedCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong bg-subtle px-4 py-6 text-center text-[13px] text-muted">
              Nothing detected. Add more detail to the note, or add a task
              manually below.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 shadow-pop"
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-md border-2 border-line-strong"
                  />
                  <input
                    value={task.title}
                    onChange={(e) => updateTask(task.id, e.target.value)}
                    aria-label="Task title"
                    placeholder="Untitled task"
                    className="flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint"
                  />
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    aria-label="Remove task"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={addTask}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted hover:bg-subtle hover:text-fg"
            >
              <PlusIcon />
              Add task
            </button>
            <button
              type="button"
              disabled={detectedCount === 0}
              className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save {detectedCount > 0 ? `${detectedCount} ` : ""}
              {detectedCount === 1 ? "todo" : "todos"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
