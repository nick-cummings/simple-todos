import type { Label } from "@/lib/labels";

import {
  formatDueDate,
  isDueSoon,
  isOverdue,
  relativeTime,
  shortWeekday,
} from "@/lib/dates";
import { tagPillStyle } from "@/lib/tagColors";

import { AlertCircleIcon, CalendarIcon, ClockIcon } from "./Icons";

export function ViewBody({
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
  labelRegistry: Label[];
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
                  className={`inline-flex items-center gap-1.5 ${
                    dueSoon ? "text-primary" : "text-muted"
                  }`}
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
