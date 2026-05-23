# Labels

Free-form, color-coded tags for todos. Used for filtering and visual
grouping.

## What the user sees

Labels are short strings (`work`, `errands`, `home`) attached to one
or more todos. Each label has a color. Labels are user-defined and
created on the fly.

Two creation paths:

- **Inline in the todo modal.** The `NewLabelRow` UI lets the user
  type a new name and hit Add. The label appears in the todo's label
  list and gets registered globally with a default gray color.
- **From the Labels manager.** The pill icon in the header opens a
  modal listing every label, with rename / recolor / delete affordances.

Labels are filter chips on the home screen. Clicking a chip toggles
inclusion; multiple chips OR together (a todo matching _any_ active
label is shown).

## Data model

Two separate stores:

| Where                 | Key                      | Shape       |
| --------------------- | ------------------------ | ----------- |
| Inline on each todo   | `Todo.labels: string[]`  | Just names. |
| Global label registry | `simple-todos:labels:v1` | `Label[]`   |

```ts
interface Label {
  name: string; // lowercase canonical
  color: ColorKey; // 'gray' | 'red' | 'blue' | …
  createdAt: number;
}
```

The registry is the source of truth for _color_ and _existence_. Todo
records reference labels by _name_ only. This means:

- Renaming a label in the manager updates the registry, and a
  per-todo migration runs to rewrite the name in every todo that
  references it.
- Deleting a label in the manager removes the registry entry and
  strips the label from every todo.
- Recoloring a label only touches the registry.

## How it's wired

```
useTodos          ← owns Todo[]            (simple-todos:v1)
useLabels         ← owns Label[]           (simple-todos:labels:v1)
LabelsManager     ← UI for rename/recolor/delete
TodoModal/        ← inline NewLabelRow for create-during-todo flow
NewLabelRow.tsx
FilterChips       ← reads useLabels for color, useTodos for counts
```

Both hooks use `useSyncExternalStore` so cross-tab updates propagate
without a manual sync.

## Validation rules

- Label names are normalized to lowercase. `"Work"`, `"work"`, and
  `"WORK"` are the same label.
- Empty names are rejected at the input.
- Duplicate names in the registry are deduped on save.

## How it's tested

| Test                                    | Layer       | Coverage                                                 |
| --------------------------------------- | ----------- | -------------------------------------------------------- |
| `src/lib/labels.test.ts`                | Unit        | CRUD, normalization, color defaults, malformed input.    |
| `src/lib/useLabels.test.ts`             | Unit        | Hook subscription, cross-tab sync.                       |
| `src/lib/tagColors.test.ts`             | Unit        | Color palette + accessibility contrast helpers.          |
| `src/components/LabelsManager.test.tsx` | Integration | Rename, delete, recolor flows; peek-delete confirmation. |
| `src/components/NewLabelRow.test.tsx`   | Unit        | Inline create row in the todo modal.                     |
| `tests/e2e/labels.spec.ts`              | E2E         | All real interactions across the manager and inline UI.  |

## Known gaps

- **No bulk label assignment.** Adding a label to many todos at once
  requires editing each one. Not worth fixing for the current
  volume.
- **No label color ordering.** Colors are assigned in registry-order;
  no "pin this label to the front" affordance.

## References

- Lib: `src/lib/labels.ts`, `src/lib/useLabels.ts`,
  `src/lib/tagColors.ts`
- UI: `src/components/LabelsManager/`,
  `src/components/NewLabelRow.tsx`,
  `src/components/TodoApp/FilterChips.tsx`
