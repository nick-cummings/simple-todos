# Install banner

A one-time "Add to Home Screen" nudge for iOS Safari users who
haven't installed the PWA yet.

## Why this exists

iOS doesn't fire `beforeinstallprompt` and Safari shows no built-in
install affordance. Worse: **Web Push and reminders only work in the
installed PWA on iOS**, so a user who never installs has access to a
visibly worse version of the app — they can never enable
notifications.

Without a nudge, the install gesture (Share → Add to Home Screen) is
invisible to anyone who hasn't been told about it.

## What the user sees

On the first visit from a non-installed iOS browser:

> 📲 **Install Simple Todos**
> Tap ⬆ Share, then **Add to Home Screen**. Reminders and push
> notifications only work in the installed app on iOS.
> [Dismiss]

Renders below the storage-error banner, above the reminders gate.
Dismissal persists across reloads via
`localStorage["simple-todos:install-prompted"] = "1"`.

## When it shows

The banner shows only when **all three** of these are true:

1. `isIOS()` — UA matches iPhone/iPad/iPod, or iPadOS desktop-mode
   (Macintosh UA + `maxTouchPoints > 1`).
2. `!isStandalonePWA()` — neither `navigator.standalone` nor the
   `display-mode: standalone` media query is true.
3. The dismissal key isn't set in localStorage.

On Android Chrome (the other primary mobile target), the browser
already shows its own install affordance via `beforeinstallprompt`.
We don't duplicate it.

## How it's wired

```
src/lib/pwa.ts                  ← isIOS() + isStandalonePWA()
src/lib/useInstallPrompt.ts     ← hook returning { shouldPrompt, dismiss }
src/components/InstallBanner.tsx ← UI
src/components/TodoApp/index.tsx ← conditional render
```

`useInstallPrompt` initializes `false` synchronously so SSR + first
client paint agree, then upgrades to `true` from a post-mount
effect once we can read the navigator state. The
`react-hooks/set-state-in-effect` lint is disabled at that exact
line — the inputs are external systems, not derivable React state,
which is one of the two cases the rule explicitly allows.

Dismissal writes through `safeWrite` (see
[ADR 0012](../decisions/0012-localstorage-quota-handling.md)) so a
quota-full state doesn't crash the dismiss button.

## How it's tested

| Test                                    | Layer | What it covers                                                       |
| --------------------------------------- | ----- | -------------------------------------------------------------------- |
| `src/lib/pwa.test.ts`                   | Unit  | UA detection (iPhone/iPad/iPadOS-as-Mac/Mac/Chrome), `display-mode`. |
| `src/lib/useInstallPrompt.test.ts`      | Unit  | All three gate conditions, dismiss persistence, hydration-safe init. |
| `src/components/InstallBanner.test.tsx` | Unit  | Copy includes Share + Add to Home Screen, dismiss handler, a11y.     |

E2E coverage is intentionally skipped: the banner only fires for
iOS WebKit + not-standalone, and standalone-mode toggling isn't
ergonomic to drive from Playwright. Manual smoke test path: open
the deployed URL in real iOS Safari, verify banner; install; reload;
verify no banner.

## Known gaps

- **No re-prompt mechanism.** If the user dismisses then later
  decides they want notifications, the banner stays hidden. They can
  still install manually but there's no in-app reminder. Could add a
  link in Settings ("Show install instructions again") if needed.
- **No Android `beforeinstallprompt` integration.** Chrome shows
  its own native install UI; we don't override it. If we later want
  consistent UX across platforms, that's a follow-up.

## References

- Detection: `src/lib/pwa.ts`
- Hook: `src/lib/useInstallPrompt.ts`
- UI: `src/components/InstallBanner.tsx`
- Render site: `src/components/TodoApp/index.tsx`
- Related: [features/reminders.md](./reminders.md) (the "why this
  matters" — reminders need install)
