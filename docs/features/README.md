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

Backfilled docs for shipped features land in PR 2.
