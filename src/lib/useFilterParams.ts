"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { SortKey, StatusFilter } from "./todos";

// Single source of truth for the filter URL contract. The four
// filter dimensions live in the URL so that a reload, a deep-link,
// or a back/forward gesture all round-trip the user's view.
//
// URL contract:
//   ?q=<text>            search query (omitted when empty)
//   ?l=<a>,<b>,<c>       active label filter (omitted when empty)
//   ?s=open,done|open|done|""   status filter; omitted means "open only"
//                              (the app default); empty string means
//                              "explicitly nothing".
//   ?sort=<SortKey>      omitted means createdDesc (the app default)
//
// `?todo=<id>` is owned by the deep-link logic in TodoApp and is
// preserved by every setter here.

const SORT_KEYS = new Set<SortKey>([
    "completed",
    "createdAsc",
    "createdDesc",
    "dueDate",
    "titleAsc",
]);

const STATUS_KEYS = new Set<StatusFilter>(["done", "open"]);

export const DEFAULT_SORT: SortKey = "createdDesc";
export const DEFAULT_STATUSES: ReadonlySet<StatusFilter> = new Set(["open"]);

export interface FilterParams {
    activeLabels: string[];
    activeStatuses: Set<StatusFilter>;
    query: string;
    setActiveLabels: (labels: string[]) => void;
    setActiveStatuses: (statuses: Set<StatusFilter>) => void;
    setQuery: (q: string) => void;
    setSort: (sort: SortKey) => void;
    sort: SortKey;
}

export function useFilterParams(): FilterParams {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const query = searchParams.get("q") ?? "";
    const sort = parseSort(searchParams.get("sort"));
    const activeLabels = useMemo(
        () => parseLabels(searchParams.get("l")),
        [searchParams],
    );
    const activeStatuses = useMemo(
        () => parseStatuses(searchParams.get("s")),
        [searchParams],
    );

    const update = useCallback(
        (key: string, value: null | string) => {
            const next = new URLSearchParams(searchParams.toString());
            if (value === null) next.delete(key);
            else next.set(key, value);
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
    );

    const setQuery = useCallback(
        (q: string) => {
            update("q", q.length > 0 ? q : null);
        },
        [update],
    );

    const setActiveLabels = useCallback(
        (labels: string[]) => {
            update("l", labels.length > 0 ? labels.join(",") : null);
        },
        [update],
    );

    const setActiveStatuses = useCallback(
        (statuses: Set<StatusFilter>) => {
            if (statusesAreDefault(statuses)) {
                update("s", null);
                return;
            }
            // Empty set is meaningful ("show nothing"); store as "" so we
            // can distinguish it from the absent → default case.
            update("s", [...statuses].join(","));
        },
        [update],
    );

    const setSort = useCallback(
        (newSort: SortKey) => {
            update("sort", newSort === DEFAULT_SORT ? null : newSort);
        },
        [update],
    );

    return {
        activeLabels,
        activeStatuses,
        query,
        setActiveLabels,
        setActiveStatuses,
        setQuery,
        setSort,
        sort,
    };
}

function parseLabels(value: null | string): string[] {
    if (!value) return [];
    return value.split(",").filter(Boolean);
}

function parseSort(value: null | string): SortKey {
    return value && SORT_KEYS.has(value as SortKey)
        ? (value as SortKey)
        : DEFAULT_SORT;
}

function parseStatuses(value: null | string): Set<StatusFilter> {
    // Param absent → default (open only). Param present (even "") →
    // user-supplied selection; honor it literally.
    if (value === null) return new Set(DEFAULT_STATUSES);
    const result = new Set<StatusFilter>();
    for (const part of value.split(",")) {
        if (STATUS_KEYS.has(part as StatusFilter)) {
            result.add(part as StatusFilter);
        }
    }
    return result;
}

function statusesAreDefault(s: Set<StatusFilter>): boolean {
    return s.size === 1 && s.has("open");
}
