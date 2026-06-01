export function AlertCircleIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
        </svg>
    );
}

export function CalendarIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
        >
            <rect height="18" rx="2" width="18" x="3" y="4" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    );
}

export function ClockIcon() {
    return (
        <svg
            aria-hidden
            fill="none"
            height="12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="12"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </svg>
    );
}

export function SparkleIcon() {
    return (
        <svg
            aria-hidden
            fill="currentColor"
            height="12"
            viewBox="0 0 24 24"
            width="12"
        >
            <path d="M12 2l2.39 6.36L20.5 10.5l-6.11 2.14L12 19l-2.39-6.36L3.5 10.5l6.11-2.14L12 2z" />
            <path d="M18.5 15l.92 2.43L21.5 18l-2.08.57L18.5 21l-.92-2.43L15.5 18l2.08-.57L18.5 15z" />
        </svg>
    );
}

export function SpinnerIcon() {
    return (
        <svg
            aria-hidden
            className="animate-spin"
            fill="none"
            height="12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            width="12"
        >
            <circle
                cx="12"
                cy="12"
                opacity={0.9}
                r="9"
                strokeDasharray="40 60"
            />
        </svg>
    );
}

export function XIcon({
    size = 14,
    stroke = 2,
}: {
    size?: number;
    stroke?: number;
}) {
    return (
        <svg
            aria-hidden
            fill="none"
            height={size}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={stroke}
            viewBox="0 0 24 24"
            width={size}
        >
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}
