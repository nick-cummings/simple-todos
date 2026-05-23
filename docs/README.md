# Simple Todos — Engineering Docs

This directory is the engineering record for the project: how it's built, why
the major decisions were made, and how to operate it in production.

The root [`README.md`](../README.md) tells you what the app is and how to run
it locally. These docs go deeper.

## Reading order for someone new

1. **[architecture.md](./architecture.md)** — system topology, data flow,
   storage model. Start here.
2. **[testing.md](./testing.md)** — what we test at each layer and why.
3. **[security.md](./security.md)** — threat model, headers, secrets.
4. **[performance.md](./performance.md)** — what we optimize for, current
   measurements, budget choices.
5. **[observability.md](./observability.md)** — what's instrumented, where to
   look when something breaks in production.
6. **[operations/deploy.md](./operations/deploy.md)** — how code reaches
   production; rollback procedure.

## Layout

```
docs/
├── README.md              ← you are here
├── architecture.md        ← system overview
├── testing.md             ← testing philosophy + layers
├── security.md            ← threat model, mitigations
├── performance.md         ← budgets, measurements, tradeoffs
├── observability.md       ← what's wired, where to look
├── decisions/             ← Architecture Decision Records (ADRs)
│   ├── TEMPLATE.md
│   └── NNNN-<slug>.md
├── features/              ← one doc per shipped feature
│   └── <feature>.md
└── operations/            ← runbooks
    ├── deploy.md
    └── runbook-*.md
```

### Decisions (ADRs)

Every material engineering decision lands as a Markdown file in
[`decisions/`](./decisions/) using the [MADR-lite template](./decisions/TEMPLATE.md).
An ADR captures the _context_ that forced the call, the _decision_ made, and
the _consequences_ we accept by making it. ADRs are append-only; if a decision
is later reversed, the new ADR supersedes the old one and links to it.

### Features

Each shipped feature has a single doc in [`features/`](./features/) describing
_what it does_, _the data model_, and _how it's tested_. Feature docs are
living — they get updated when the feature changes.

### Operations

Runbooks for things that can go wrong in production live in
[`operations/`](./operations/). Each one assumes the reader has no context
beyond "the alert just fired."

## Authoring convention

> Anything beyond a minor bug fix lands with a docs update — a new feature
> doc, an updated feature doc, a runbook, or an ADR. PR descriptions reference
> the doc that ships with the change.

The rationale lives in [decisions/0001-everything-substantial-gets-a-doc.md](./decisions/0001-everything-substantial-gets-a-doc.md).
