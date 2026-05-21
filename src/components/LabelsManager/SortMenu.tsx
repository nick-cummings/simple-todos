export type SortKey = "count" | "name" | "recent";

export const SORT_LABELS: Record<SortKey, string> = {
  count: "Count",
  name: "Name",
  recent: "Recent",
};

export function SortMenu({
  onChange,
  value,
}: {
  onChange: (next: SortKey) => void;
  value: SortKey;
}) {
  return (
    <label className="relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card pl-4 pr-3 text-[13px] hover:border-line-strong hover:bg-card-hover">
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
        aria-label="Sort labels by"
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
