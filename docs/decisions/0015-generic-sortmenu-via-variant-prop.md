---
status: accepted
date: 2026-05-29
supersedes:
superseded-by:
---

# 0015 — One generic SortMenu, styled by a `variant` prop

## Context

`TodoApp` and `LabelsManager` each shipped their own `SortMenu` component.
The two were near-identical: the same invisible-`<select>`-over-a-styled-
`<label>` pattern and the same chevron SVG, differing only in their key
union, their label map, the `aria-label`, and a handful of style tokens
(`h-11 rounded-lg` vs `h-9 rounded-full text-[13px]`). Issue #30 called
this out as tech-debt: any change to the shared pattern had to be made
twice and could drift.

## Decision

Extract a single generic `SortMenu<K extends string>` at
`src/components/SortMenu.tsx`. It takes `value`, `onChange`, `labels:
Record<K, string>`, `ariaLabel`, and an optional `variant` (`"default"`
| `"compact"`, default `"default"`). Each call site keeps its own key
union and label map locally and passes them in; the two old per-feature
files are deleted.

## Alternatives considered

- **A free-form `className` prop instead of a `variant` enum.** More
  flexible, but it pushes the exact Tailwind class strings back out to
  every caller — exactly the duplication we are removing — and makes it
  easy for the two looks to silently diverge again. A closed `variant`
  set keeps the two sanctioned looks owned by the component.
- **Composing a shared base class with per-variant additions.** Tidier on
  paper, but the two originals don't share a clean base (border colour,
  hover colour, height, gap, radius, and font size all differ), so the
  composition would be mostly overrides. Storing the full class string per
  variant is more obviously correct and guarantees visual parity.
- **Leave the duplication.** It's only two files, but the pattern is
  exactly the kind that rots when one side gets a fix the other misses.

## Consequences

- One place to evolve the sort-menu pattern; both menus stay in sync.
- Adding a third look means adding a `variant` entry, not a `className`
  free-for-all — a deliberate, reviewable change.
- The key union and label map now live next to each consumer's state
  rather than in the menu file, which keeps the generic component free of
  feature-specific vocabulary.
- Visual parity is asserted by tests (the `variant` classes), so a future
  refactor that breaks one look fails loudly.

## References

- Code: `src/components/SortMenu.tsx`,
  `src/components/SortMenu.test.tsx`,
  `src/components/TodoApp/index.tsx`,
  `src/components/LabelsManager/index.tsx`
- Related ADRs: [0001](./0001-everything-substantial-gets-a-doc.md)
- Issue: #30
