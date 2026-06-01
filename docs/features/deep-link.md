# Notification deep-link

Tapping a reminder notification opens the matching todo in the app.

## Why this exists

Without a deep-link, tapping a reminder would just focus the app —
the user would then have to find the todo manually. Useless if they
have dozens of todos. The notification needs to take them straight
to the right place.

## How it works

Two paths, both ending in the same view-mode modal:

### Path 1: app is not open

1. User taps the notification on the lock screen / notification
   shade.
2. iOS launches the installed PWA (Safari is the host).
3. The SW's `notificationclick` handler runs:
   `globalThis.clients.openWindow("/?todo=ID")`.
4. The app boots, `TodoApp` reads `?todo=ID` from `useSearchParams`,
   finds the matching todo, opens the modal in view mode, and
   `router.replace`s the URL to drop the param so a refresh doesn't
   re-open it.

### Path 2: app is already open

1. User taps the notification while the PWA is foregrounded (or in a
   background tab on desktop).
2. The SW's `notificationclick` handler iterates `clients.matchAll`
   and, for any client on our origin, does:
    - `client.postMessage({ type: "reminder-click", url: "/?todo=ID" })`
    - `client.focus()`
3. `TodoApp` has a `serviceWorker.addEventListener("message", …)`
   listener that opens the modal from the URL in the message.

Both paths converge on `setEditing(target) + setModalOpen(true)` and
then a URL cleanup.

## URL cleanup is important

The deep-link param is consumed on first read and removed via
`router.replace`. Without that, hitting refresh on the page (or
back-forward navigation) would re-open the modal, which is confusing.
The cleanup preserves any other query params (filter state, etc.).

## Wire diagram

```
push payload  ──▶  SW push handler  ──▶  notification shown
                                          │
                                          ▼ (user taps)
                                  notificationclick handler
                                          │
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                    openWindow(/?todo=ID)       focus + postMessage
                            │                           │
                            ▼                           ▼
                    TodoApp reads URL          TodoApp message listener
                            │                           │
                            └──────────┬────────────────┘
                                       ▼
                            setEditing + setModalOpen
                                       │
                                       ▼
                              clearTodoParam()
```

## How it's tested

| Test                                                   | Layer       | What it covers                                                                                       |
| ------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------- |
| `src/components/TodoApp.test.tsx` (deep-link describe) | Integration | URL deep-link opens, missing IDs are ignored, URL gets cleared.                                      |
| Same file, SW postMessage tests                        | Integration | Message listener opens, malformed payload doesn't crash.                                             |
| `public/sw.js` review                                  | Manual      | SW behavior on iOS device (not E2E — see [ADR 0010](../decisions/0010-disable-sw-in-playwright.md)). |

The `?todo=missing-id` case is tested explicitly: param gets cleared
even when no matching todo exists. The empty `?todo=` case is also
handled (ignored).

## Edge cases worth knowing about

- **`navigator.serviceWorker` reference is captured at effect mount.**
  The cleanup function uses the captured `sw` reference, not
  `navigator.serviceWorker`, because tests can replace
  `navigator.serviceWorker` between mount and unmount. See the related
  lesson:

    > Calling host methods (document.startViewTransition, etc.) via a
    > local binding throws "Illegal invocation". Capturing the
    > _receiver object_ (not its method) is safe and is the right
    > pattern when you need a stable reference across the lifetime of
    > an effect.

    We capture `const sw = navigator.serviceWorker` once and call
    `sw.addEventListener` / `sw.removeEventListener` through it.

- **Hydration timing.** The deep-link effect waits on `hydrated`
  before opening anything. Otherwise it would open before
  `useTodos`'s `useSyncExternalStore` has populated, and `todos.find(
…)` would return undefined on the very first render.

## References

- Service worker: `public/sw.js`
- App side: `src/components/TodoApp/index.tsx` (deep-link useEffects)
- Tests: `src/components/TodoApp.test.tsx`
- Suspense requirement: [ADR 0006](../decisions/0006-suspense-for-search-params.md)
- Related: [features/reminders.md](./reminders.md) (push payload origin)
