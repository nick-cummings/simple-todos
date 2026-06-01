export function EmptyState({
    hasAny,
    onAdd,
}: {
    hasAny: boolean;
    onAdd: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
            <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-faint"
            >
                <svg
                    fill="none"
                    height="28"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                    viewBox="0 0 24 24"
                    width="28"
                >
                    <rect height="16" rx="2" width="18" x="3" y="4" />
                    <path d="M9 4v2h6V4M8 11h8M8 15h5" />
                </svg>
            </span>
            <div className="flex flex-col gap-1">
                <p className="text-base font-medium text-fg">
                    {hasAny ? "Nothing matches" : "No todos yet"}
                </p>
                <p className="mx-auto max-w-xs text-[13px] text-muted">
                    {hasAny
                        ? "Try clearing filters or your search query."
                        : "Tap the + button to create your first todo."}
                </p>
            </div>
            {!hasAny && (
                <button
                    className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
                    onClick={onAdd}
                    type="button"
                >
                    Add your first todo
                </button>
            )}
        </div>
    );
}

export function SectionHeader({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                {label}
            </span>
            <span aria-hidden className="h-px flex-1 bg-line" />
        </div>
    );
}
