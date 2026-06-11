# Features

One Markdown file per user-facing feature. Each doc covers:

- **What it does** — described from the user's point of view.
- **Data model** — what storage it uses (localStorage keys, Upstash keys,
  URL params, etc.).
- **How it's wired** — the component / hook / route boundaries.
- **How it's tested** — which test files cover it, at which layer.
- **Edge cases worth knowing about** — anything non-obvious to a future
  reader.

Feature docs are living. When the feature changes, the doc changes in
the same PR. See [`../decisions/0001-everything-substantial-gets-a-doc.md`](../decisions/0001-everything-substantial-gets-a-doc.md).

## Index

- [a11y.md](./a11y.md) — keyboard a11y: focus-trap + escape-key hooks, wired into `TodoModal`.
- [ai-description.md](./ai-description.md) — AI-generated todo descriptions via Claude.
- [backup-and-restore.md](./backup-and-restore.md) — JSON export/import.
- [deep-link.md](./deep-link.md) — `?todo=ID` from a notification opens the matching todo.
- [error-boundaries.md](./error-boundaries.md) — page-level + root-layout React Error Boundaries.
- [install-banner.md](./install-banner.md) — one-time "Add to Home Screen" nudge for iOS Safari.
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — global keyboard shortcuts (⌘K, /, N, ?).
- [labels.md](./labels.md) — free-form color-coded tags for todos.
- [reminders.md](./reminders.md) — daily Web Push notifications for due todos.
- [settings.md](./settings.md) — the `/settings` route.
