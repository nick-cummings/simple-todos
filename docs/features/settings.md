# Settings

The `/settings` route. Houses everything that isn't part of the
todo-list main view.

## Sections

### Reminders

Status of the Web Push subscription on this device. Three states:

- **Active.** Subscription exists and notifications are granted. Shows
  a "Disable reminders" button which unsubscribes and DELETEs the
  subscription row.
- **Off.** No subscription. Copy directs the user to the gate on the
  home screen (which appears when they next add a due date).
- **Blocked.** Notification permission denied at the OS level. Copy
  directs the user to their browser settings.

### Backup

Export and import the user's data. See
[backup-and-restore.md](./backup-and-restore.md) for the full feature.

### Danger zone

**Clear all data.** Removes every `simple-todos:*` key from
localStorage and reloads the page. Behind a confirmation dialog.

### Footer

App version (from `package.json`) rendered as small text. Useful when
debugging which deployment a screenshot came from.

## Navigation

A gear icon in the header of `TodoApp` links to `/settings`. The
Settings page has a "← back to todos" link to `/`.

## Wire diagram

```
src/app/settings/page.tsx           ← server component, just renders
                                      <Settings/>
src/components/Settings/Settings.tsx ← client component, owns all UI
                                      and the import/export wiring
src/lib/backup.ts                    ← pure backup helpers
```

`Settings.tsx` consumes the same hooks as `TodoApp`:
`useTodos`, `useLabels`, `useReminders`. The export path reads
current state and serializes it; the clear path calls
`clearAllAppData()` from `backup.ts`.

## How it's tested

| Test                                        | Layer       | What it covers                                                               |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `src/components/Settings/Settings.test.tsx` | Integration | Each section's branches; export blob shape; import flow; clear confirmation. |
| `tests/e2e/settings.spec.ts`                | E2E         | Navigation, real download event, real import via filechooser.                |

Reminders is mocked at the hook level (`vi.mock("@/lib/useReminders")`)
so we can drive each state without touching real Notification APIs.

## References

- Route: `src/app/settings/page.tsx`
- Component: `src/components/Settings/Settings.tsx`
- Tests: `src/components/Settings/Settings.test.tsx`,
  `tests/e2e/settings.spec.ts`
- Related: [features/backup-and-restore.md](./backup-and-restore.md),
  [features/reminders.md](./reminders.md)
