import type { SortKey } from "@/lib/todos";

export const SORT_LABELS: Record<SortKey, string> = {
  completed: "Open first",
  createdAsc: "Oldest",
  createdDesc: "Newest",
  dueDate: "Due date",
  titleAsc: "Title",
};

export function SortMenu({
  onChange,
  value,
}: {
  onChange: (next: SortKey) => void;
  value: SortKey;
}) {
  return (
    <label className="relative inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card pl-4 pr-3 text-sm hover:border-line-emphasis hover:bg-card-hover">
      <span className="text-muted">Sort:</span>
      <span className="font-medium text-fg">{SORT_LABELS[value]}</span>
      <svg
        aria-hidden
        className="text-faint"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="14"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label="Sort by"
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        onChange={(e) => {
          onChange(e.target.value as SortKey);
        }}
        value={value}
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
