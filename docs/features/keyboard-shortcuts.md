# Keyboard Shortcuts

Global keyboard shortcuts for fast navigation without a mouse.

## What it does

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Focus the search bar and select all text |
| `/` | Focus the search bar |
| `N` | Open the new-todo modal |
| `?` | Open the shortcuts help overlay |
| `Esc` | Close the shortcuts overlay |

Single-key shortcuts (`/`, `N`, `?`) are suppressed while the user is typing in an `input`, `textarea`, or `contenteditable`. `⌘K` / `Ctrl+K` fires unconditionally since it does not conflict with typing.

## Data model

No stored state. All shortcuts are ephemeral UI interactions.

## How it's wired

- **`src/lib/useShortcuts.ts`** — registers a single `keydown` listener on `globalThis` that dispatches to three callbacks: `onFocusSearch`, `onOpenNew`, `onOpenHelp`.
- **`src/components/TodoApp/index.tsx`** — calls `useShortcuts` with callbacks that focus `searchRef`, call `openNew()`, or set `shortcutsOpen` to `true`. Replaces the previous inline ⌘K `useEffect`.
- **`src/components/ShortcutsHelp/index.tsx`** — mounts only while `shortcutsOpen` is true. Uses `useFocusTrap` + `useEscapeKey` (the same pair as `TodoModal`). Backdrop click also closes the overlay.

## How it's tested

- **Unit** — `src/lib/useShortcuts.test.ts`: each key maps to the right callback; suppression inside text fields; `⌘K` bypasses suppression; cleanup on unmount.
- **Component** — `src/components/ShortcutsHelp/ShortcutsHelp.test.tsx`: renders nothing when closed; Escape calls `onClose`; close button calls `onClose`; backdrop `mousedown` calls `onClose`; focus trap confines Tab; focus restores to trigger on unmount.

## Edge cases

- `N` (uppercase) also triggers new-todo — the handler checks both `e.key === "n"` and `e.key === "N"` since Shift is not always applied consistently across platforms.
- The `ShortcutsHelp` overlay is mounted/unmounted (not hidden) so `useFocusTrap` properly restores focus to the `?` trigger when dismissed.
- `useShortcuts` callbacks are inline arrows in `TodoApp`, so the effect re-subscribes on every render. This is two O(1) DOM operations and is functionally correct; the behavior matches the previous inline ⌘K effect.
