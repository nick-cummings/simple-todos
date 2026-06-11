"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { groupByDue, isCompletedThisWeek } from "@/lib/dates";
import {
    allLabels,
    filterTodos,
    labelCounts,
    SortKey,
    sortTodos,
    StatusFilter,
    Todo,
    TodoInput,
} from "@/lib/todos";
import { useFilterParams } from "@/lib/useFilterParams";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { useLabels } from "@/lib/useLabels";
import { useReminders } from "@/lib/useReminders";
import { useShortcuts } from "@/lib/useShortcuts";
import { useStorageError } from "@/lib/useStorageError";
import { useTodos } from "@/lib/useTodos";
import { withViewTransition } from "@/lib/viewTransition";

import InstallBanner from "../InstallBanner";
import LabelsManager from "../LabelsManager";
import RemindersGate from "../RemindersGate";
import ShortcutsHelp from "../ShortcutsHelp";
import { SortMenu } from "../SortMenu";
import StorageErrorBanner from "../StorageErrorBanner";
import ThemeToggle from "../ThemeToggle";
import TodoCard from "../TodoCard";
import TodoModal from "../TodoModal";
import UndoToast from "../UndoToast";
import { EmptyState, SectionHeader } from "./EmptyState";
import { FilterChips } from "./FilterChips";
import { SearchInput } from "./SearchInput";
import { StatusChips } from "./StatusChips";

const SORT_LABELS: Record<SortKey, string> = {
    completed: "Open first",
    createdAsc: "Oldest",
    createdDesc: "Newest",
    dueDate: "Due date",
    titleAsc: "Title",
};

export default function TodoApp() {
    const {
        add,
        clearCompleted,
        hydrated,
        remove,
        restore,
        todos,
        toggle,
        update,
    } = useTodos();
    const { ensureLabelsExist, labels: labelRegistry } = useLabels();
    const {
        enable: enableReminders,
        needsAttention,
        syncTodoReminder,
    } = useReminders({
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    // Filter state lives in the URL — see useFilterParams for the
    // ?q / ?l / ?s / ?sort contract. Reload, deep-link, and
    // back/forward all round-trip the view.
    const {
        activeLabels,
        activeStatuses,
        query,
        setActiveLabels,
        setActiveStatuses,
        setQuery,
        setSort,
        sort,
    } = useFilterParams();
    const { dismiss: dismissStorageError, error: storageError } =
        useStorageError();
    const {
        dismiss: dismissInstallPrompt,
        shouldPrompt: shouldShowInstallBanner,
    } = useInstallPrompt();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Todo | undefined>();
    const [labelsManagerOpen, setLabelsManagerOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    // Single-item undo: most recent deletion. Cleared when the user
    // undoes or when the toast's window expires.
    const [pendingUndo, setPendingUndo] = useState<null | Todo>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // ---- notification deep-link (?todo=ID) ----
    //
    // Two entry points reach this app from a push notification:
    //  - notificationclick → openWindow("/?todo=ID") when no client is open
    //  - notificationclick → focus + postMessage when a client is already open
    // We handle both: on mount we read ?todo from the URL; in parallel
    // we listen for the SW message. Either way we open the todo in view
    // mode and clear the param so a stray refresh doesn't keep re-opening.
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const deepLinkId = searchParams.get("todo");

    function clearTodoParam() {
        const next = new URLSearchParams(searchParams.toString());
        next.delete("todo");
        const q = next.toString();
        router.replace(q ? `${pathname}?${q}` : pathname);
    }

    useEffect(() => {
        if (!hydrated || !deepLinkId) return;
        const target = todos.find((t) => t.id === deepLinkId);
        if (target) {
            // setState-in-effect is the right pattern here: the URL is an
            // external input (a push-notification deep link), so opening
            // the modal in response to its arrival is "syncing with an
            // external system", not derivable state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEditing(target);
            setModalOpen(true);
        }
        // Either way, drop the param so refresh doesn't re-open.
        clearTodoParam();
        // clearTodoParam closes over searchParams/router/pathname; including
        // it in deps would cause an infinite loop because router.replace
        // returns a new searchParams object on every fire.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated, deepLinkId, todos]);

    useEffect(() => {
        // `navigator.serviceWorker` is undefined in non-secure contexts
        // (http://, file://) and in test environments without SW support;
        // guard at runtime even though TS's lib.dom types it as always
        // present.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!navigator.serviceWorker) return;
        // Capture the controller reference at mount time so the cleanup
        // path stays valid even if navigator.serviceWorker is mutated or
        // removed before unmount (e.g. in tests).
        const sw = navigator.serviceWorker;
        function onMessage(event: MessageEvent) {
            const data = event.data as
                | null
                | undefined
                | { type?: unknown; url?: unknown };
            if (data?.type !== "reminder-click") return;
            if (typeof data.url !== "string") return;
            try {
                const url = new URL(data.url, globalThis.location.origin);
                const id = url.searchParams.get("todo");
                if (!id) return;
                const target = todos.find((t) => t.id === id);
                if (target) {
                    setEditing(target);
                    setModalOpen(true);
                }
            } catch {
                // Malformed URL from the SW; nothing to do.
            }
        }
        sw.addEventListener("message", onMessage);
        return () => {
            sw.removeEventListener("message", onMessage);
        };
    }, [todos]);

    // Reconcile reminders with the current todo list. Runs on every
    // change to `todos` and whenever `syncTodoReminder` re-binds (i.e.
    // when reminders flip from inactive → active). syncTodoReminder is
    // idempotent server-side: it POSTs a reminder for due+open todos
    // and DELETEs for everything else, so reposting on every render is
    // safe even if a bit chatty. Volume is tiny (single user, dozens
    // of todos).
    useEffect(() => {
        for (const t of todos) {
            void syncTodoReminder(t);
        }
    }, [todos, syncTodoReminder]);

    useShortcuts({
        onFocusSearch: () => {
            searchRef.current?.focus();
            searchRef.current?.select();
        },
        onOpenHelp: () => {
            setShortcutsOpen(true);
        },
        onOpenNew: openNew,
    });

    const labels = useMemo(() => allLabels(todos), [todos]);
    const counts = useMemo(() => labelCounts(todos), [todos]);
    const visible = useMemo(
        () =>
            sortTodos(
                filterTodos(todos, activeLabels, query, activeStatuses),
                sort,
            ),
        [todos, activeLabels, query, sort, activeStatuses],
    );
    const groups = useMemo(() => groupByDue(visible), [visible]);

    const openCount = todos.filter((t) => !t.completed).length;
    const doneCount = todos.length - openCount;
    const completedThisWeek = todos.filter(
        (t) => t.completed && isCompletedThisWeek(t.updatedAt),
    ).length;

    function openNew() {
        setEditing(undefined);
        setModalOpen(true);
    }
    function openEdit(t: Todo) {
        setEditing(t);
        setModalOpen(true);
    }
    function handleSubmit(input: TodoInput) {
        // Register any new label names in the label registry so they
        // pick up a color (defaults to gray) and show up in the manager.
        if (input.labels && input.labels.length > 0) {
            ensureLabelsExist(input.labels);
        }
        withViewTransition(() => {
            if (editing) update(editing.id, input);
            else add(input);
        });
        // Note: reminders sync via the effect below — no per-mutation
        // dispatch here. Adding via the closure would miss new todos
        // (the captured `todos` is stale) and edits via the closure
        // would race the external-store flush; the effect handles both.
    }
    function handleDelete() {
        if (!editing) return;
        const todo = editing;
        withViewTransition(() => {
            remove(todo.id);
        });
        setPendingUndo(todo);
        // Deleted todos drop out of `todos` so the effect won't see
        // them — fire an explicit unregister now.
        void syncTodoReminder({ ...todo, completed: true });
    }
    function handleUndo() {
        if (!pendingUndo) return;
        const todo = pendingUndo;
        setPendingUndo(null);
        withViewTransition(() => {
            restore(todo);
        });
        // The effect picks up the restore once `todos` re-includes it;
        // no manual sync needed here.
    }
    function handleToggle(id: string) {
        withViewTransition(() => {
            toggle(id);
        });
    }
    function toggleLabelFilter(label: string) {
        const next = activeLabels.includes(label)
            ? activeLabels.filter((l) => l !== label)
            : [...activeLabels, label];
        withViewTransition(() => {
            setActiveLabels(next);
        });
    }
    function clearLabelFilters() {
        withViewTransition(() => {
            setActiveLabels([]);
        });
    }
    function toggleStatusFilter(s: StatusFilter) {
        const next = new Set(activeStatuses);
        if (next.has(s)) next.delete(s);
        else next.add(s);
        withViewTransition(() => {
            setActiveStatuses(next);
        });
    }
    function handleSort(next: SortKey) {
        withViewTransition(() => {
            setSort(next);
        });
    }
    function handleClearCompleted() {
        withViewTransition(() => {
            clearCompleted();
        });
    }

    return (
        <>
            <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-7 px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
                <header className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-5xl font-semibold tracking-[-0.045em] leading-none">
                            todos
                        </h1>
                        {hydrated && (
                            <div className="flex items-center gap-2 text-[13px] text-muted">
                                <span
                                    aria-hidden
                                    className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"
                                    style={{
                                        boxShadow:
                                            "0 0 0 4px var(--primary-bg)",
                                    }}
                                />
                                <span>
                                    <span className="text-fg">{openCount}</span>{" "}
                                    open
                                </span>
                                {completedThisWeek > 0 && (
                                    <>
                                        <span className="text-faint">·</span>
                                        <span>
                                            {completedThisWeek} completed this
                                            week
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            aria-label="Settings"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-card text-muted hover:bg-card-hover hover:text-fg"
                            href="/settings"
                        >
                            <svg
                                aria-hidden
                                fill="none"
                                height="18"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                width="18"
                            >
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </Link>
                        <ThemeToggle />
                    </div>
                </header>

                {storageError && (
                    <StorageErrorBanner
                        error={storageError}
                        onDismiss={dismissStorageError}
                    />
                )}

                {shouldShowInstallBanner && (
                    <InstallBanner onDismiss={dismissInstallPrompt} />
                )}

                {needsAttention && <RemindersGate onEnable={enableReminders} />}

                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <SearchInput
                            onChange={setQuery}
                            ref={searchRef}
                            value={query}
                        />
                        <SortMenu
                            ariaLabel="Sort by"
                            labels={SORT_LABELS}
                            onChange={handleSort}
                            value={sort}
                        />
                    </div>

                    <StatusChips
                        active={activeStatuses}
                        doneCount={doneCount}
                        onToggle={toggleStatusFilter}
                        openCount={openCount}
                    />

                    <hr className="border-t border-line" />

                    <FilterChips
                        activeLabels={activeLabels}
                        allCount={openCount}
                        counts={counts}
                        labelRegistry={labelRegistry}
                        labels={labels}
                        onClear={clearLabelFilters}
                        onManage={() => {
                            setLabelsManagerOpen(true);
                        }}
                        onToggle={toggleLabelFilter}
                    />
                </div>

                <div className="flex flex-col gap-7">
                    {hydrated && visible.length === 0 && (
                        <EmptyState hasAny={todos.length > 0} onAdd={openNew} />
                    )}

                    {groups.map((g) => (
                        <section className="flex flex-col gap-3" key={g.key}>
                            <SectionHeader label={g.label} />
                            <ul className="flex flex-col gap-2.5">
                                {g.items.map((t) => (
                                    <TodoCard
                                        key={t.id}
                                        onOpen={() => {
                                            openEdit(t);
                                        }}
                                        onToggle={() => {
                                            handleToggle(t.id);
                                        }}
                                        todo={t}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>

                {visible.some((t) => t.completed) && (
                    <button
                        className="self-start text-[11px] font-medium uppercase tracking-[0.14em] text-faint hover:text-fg"
                        onClick={handleClearCompleted}
                        type="button"
                    >
                        Clear completed
                    </button>
                )}
            </main>

            <button
                aria-label="Add todo (N)"
                className="fixed bottom-8 right-8 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-on-primary shadow-fab hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95"
                onClick={openNew}
                style={{
                    marginBottom: "env(safe-area-inset-bottom)",
                    transition:
                        "transform var(--motion-fast) var(--ease-spring), background-color var(--motion-fast) var(--ease-smooth), box-shadow var(--motion-fast) var(--ease-smooth)",
                }}
                title="New todo (N)"
                type="button"
            >
                <svg
                    aria-hidden
                    fill="none"
                    height="22"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    width="22"
                >
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </button>

            <TodoModal
                initial={editing}
                onClose={() => {
                    setModalOpen(false);
                }}
                onDelete={editing ? handleDelete : undefined}
                onSubmit={handleSubmit}
                open={modalOpen}
            />

            <LabelsManager
                onClose={() => {
                    setLabelsManagerOpen(false);
                }}
                open={labelsManagerOpen}
            />

            <UndoToast
                message={pendingUndo ? `Deleted “${pendingUndo.title}”` : null}
                onExpire={() => {
                    setPendingUndo(null);
                }}
                onUndo={handleUndo}
            />

            <ShortcutsHelp
                onClose={() => {
                    setShortcutsOpen(false);
                }}
                open={shortcutsOpen}
            />
        </>
    );
}
