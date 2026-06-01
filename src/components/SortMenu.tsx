type Variant = "compact" | "default";

// Full label class strings per variant so the two call sites keep exact
// visual parity (see the originals' h-11/rounded-lg vs h-9/rounded-full looks).
const VARIANT_LABEL_CLASS: Record<Variant, string> = {
    compact:
        "relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card pl-4 pr-3 text-[13px] hover:border-line-strong hover:bg-card-hover",
    default:
        "relative inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-card pl-4 pr-3 text-sm hover:border-line-emphasis hover:bg-card-hover",
};

export function SortMenu<K extends string>({
    ariaLabel,
    labels,
    onChange,
    value,
    variant = "default",
}: {
    ariaLabel: string;
    labels: Record<K, string>;
    onChange: (next: K) => void;
    value: K;
    variant?: Variant;
}) {
    return (
        <label className={VARIANT_LABEL_CLASS[variant]}>
            <span className="text-muted">Sort:</span>
            <span className="font-medium text-fg">{labels[value]}</span>
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
                aria-label={ariaLabel}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
                onChange={(e) => {
                    onChange(e.target.value as K);
                }}
                value={value}
            >
                {(Object.keys(labels) as K[]).map((k) => (
                    <option key={k} value={k}>
                        {labels[k]}
                    </option>
                ))}
            </select>
        </label>
    );
}
