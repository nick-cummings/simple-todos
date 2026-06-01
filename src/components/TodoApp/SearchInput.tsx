export function SearchInput({
    onChange,
    ref,
    value,
}: {
    onChange: (v: string) => void;
    ref?: React.Ref<HTMLInputElement>;
    value: string;
}) {
    return (
        <div className="relative flex min-w-0 flex-1 items-center">
            <span aria-hidden className="absolute left-3.5 text-faint">
                <svg
                    fill="none"
                    height="14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="14"
                >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                </svg>
            </span>
            <input
                aria-label="Search todos"
                className="h-11 w-full rounded-lg border border-line-strong bg-card pl-10 pr-14 text-sm placeholder:text-faint hover:border-line-emphasis focus:border-line-emphasis"
                onChange={(e) => {
                    onChange(e.target.value);
                }}
                placeholder="Search todos…"
                ref={ref}
                value={value}
            />
            <kbd className="absolute right-3 select-none">⌘K</kbd>
        </div>
    );
}
