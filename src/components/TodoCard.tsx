"use client";

import { Todo } from "@/lib/todos";
import {
  formatDueDate,
  isOverdue,
  priorityOf,
  relativeTime,
  shortWeekday,
} from "@/lib/dates";
import { tagPillStyle } from "@/lib/tagColors";

const PRIORITY_BG: Record<string, string> = {
  high: "var(--danger)",
  medium: "var(--primary)",
  low: "var(--line-strong)",
  none: "transparent",
};

export default function TodoCard({
  todo,
  onToggle,
  onOpen,
}: {
  todo: Todo;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const priority = priorityOf(todo);
  const overdue = isOverdue(todo.dueDate, todo.completed);

  return (
    <li
      className="todo-vt group relative flex gap-3.5 rounded-xl border border-line bg-card px-[18px] py-4 pl-5 shadow-soft hover:-translate-y-px hover:border-line-strong hover:bg-card-hover hover:shadow-card"
      style={{
        viewTransitionName: `todo-${todo.id}`,
        opacity: todo.completed ? 0.6 : 1,
        transition:
          "transform var(--motion-base) var(--ease-smooth), border-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth), background-color var(--motion-fast) var(--ease-smooth), opacity var(--motion-base) var(--ease-smooth)",
      }}
    >
      <span
        aria-hidden
        className="priority-bar"
        style={{ backgroundColor: PRIORITY_BG[priority] }}
      />

      <AnimatedCheckbox
        checked={todo.completed}
        onChange={onToggle}
        label={todo.completed ? "Mark as open" : "Mark as done"}
        priority={priority}
      />

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-0 text-left"
      >
        <span
          className="todo-title text-[15px] font-medium leading-snug tracking-[-0.005em] text-fg"
          data-completed={todo.completed}
        >
          {todo.title}
        </span>

        {todo.description && (
          <span
            className={
              "mt-1 line-clamp-3 text-[13px] leading-[1.55] " +
              (todo.completed ? "text-faint" : "text-muted")
            }
          >
            {todo.description}
          </span>
        )}

        {todo.labels.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {todo.labels.map((l) => (
              <span key={l} className="tag-pill" style={tagPillStyle(l)}>
                {l}
              </span>
            ))}
          </div>
        )}

        <MetaRow todo={todo} overdue={overdue} />
      </button>
    </li>
  );
}

function MetaRow({ todo, overdue }: { todo: Todo; overdue: boolean }) {
  const hasDue = !!todo.dueDate;
  const hasCreated = !!todo.createdAt;
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
            "inline-flex items-center gap-1.5 " +
            (priorityOf(todo) === "medium" ? "text-primary" : "text-faint")
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

function AnimatedCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  priority: string;
}) {
  return (
    <label
      className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 select-none items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none relative h-3 w-3 scale-50 text-on-primary opacity-0 peer-checked:animate-check peer-checked:scale-100 peer-checked:opacity-100"
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
    </label>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
