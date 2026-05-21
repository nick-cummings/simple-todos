"use client";

import {
  formatDueDate,
  isOverdue,
  priorityOf,
  relativeTime,
  shortWeekday,
} from "@/lib/dates";
import { tagPillStyle } from "@/lib/tagColors";
import { Todo } from "@/lib/todos";
import { useLabels } from "@/lib/useLabels";

const PRIORITY_BG: Record<string, string> = {
  high: "var(--danger)",
  low: "var(--line-strong)",
  medium: "var(--primary)",
  none: "transparent",
};

export default function TodoCard({
  onOpen,
  onToggle,
  todo,
}: {
  onOpen: () => void;
  onToggle: () => void;
  todo: Todo;
}) {
  const priority = priorityOf(todo);
  const overdue = isOverdue(todo.dueDate, todo.completed);
  const { labels: labelRegistry } = useLabels();

  return (
    <li
      className="todo-vt group relative flex gap-3.5 rounded-xl border border-line bg-card px-[18px] py-4 pl-5 shadow-soft hover:-translate-y-px hover:border-line-strong hover:bg-card-hover hover:shadow-card"
      style={{
        opacity: todo.completed ? 0.6 : 1,
        transition:
          "transform var(--motion-base) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth), opacity var(--motion-base) var(--ease-smooth)",
        viewTransitionName: `todo-${todo.id}`,
      }}
    >
      <span
        aria-hidden
        className="priority-bar"
        style={{ backgroundColor: PRIORITY_BG[priority] }}
      />

      <AnimatedCheckbox
        checked={todo.completed}
        label={todo.completed ? "Mark as open" : "Mark as done"}
        onChange={onToggle}
        priority={priority}
      />

      <button
        className="flex min-w-0 flex-1 flex-col gap-0 text-left"
        onClick={onOpen}
        type="button"
      >
        <span
          className="todo-title text-[15px] font-medium leading-snug tracking-[-0.005em] text-fg"
          data-completed={todo.completed}
        >
          {todo.title}
        </span>

        {todo.labels.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {todo.labels.map((l) => (
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

        <MetaRow overdue={overdue} todo={todo} />
      </button>
    </li>
  );
}

function AlertCircleIcon() {
  return (
    <svg aria-hidden fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function AnimatedCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  priority: string;
}) {
  return (
    <label
      className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 select-none items-center justify-center"
      onClick={(e) => { e.stopPropagation(); }}
    >
      <input
        aria-label={label}
        checked={checked}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={onChange}
        type="checkbox"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border-[1.5px] border-line-emphasis bg-transparent peer-hover:border-primary peer-hover:bg-primary-bg peer-checked:border-primary peer-checked:bg-primary"
        style={{
          transition:
            "background-color var(--motion-base) var(--ease-smooth), border-color var(--motion-base) var(--ease-smooth)",
        }}
      />
      <svg
        aria-hidden
        className="pointer-events-none relative h-3 w-3 scale-50 text-on-primary opacity-0 peer-checked:animate-check peer-checked:scale-100 peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
        viewBox="0 0 24 24"
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
    </label>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg aria-hidden fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function MetaRow({ overdue, todo }: { overdue: boolean; todo: Todo; }) {
  const hasDue = Boolean(todo.dueDate);
  const hasCreated = Boolean(todo.createdAt);
  if (!hasDue && !hasCreated) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium">
      {overdue && todo.dueDate && (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <AlertCircleIcon />
          <span>
            Overdue · {shortWeekday(todo.dueDate)}
          </span>
        </span>
      )}
      {todo.dueDate && !overdue && (
        <span
          className={
            `inline-flex items-center gap-1.5 ${ 
            priorityOf(todo) === "medium" ? "text-primary" : "text-faint"}`
          }
        >
          <CalendarIcon />
          <span>{formatDueDate(todo.dueDate)}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-faint">
        <ClockIcon />
        <span>{relativeTime(todo.createdAt)}</span>
      </span>
    </div>
  );
}
