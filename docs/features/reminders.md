# Reminders

Daily push notifications for todos with a due date.

## What it does

When the user creates a todo with a `dueDate`, the app schedules a Web
Push notification to fire at the start of the due day. The
notification body is the todo title; tapping it deep-links into the
app and opens the todo in view mode (see
[deep-link.md](./deep-link.md)).

Reminders are opt-in. The first time a user creates a todo with a due
date, a Reminders gate appears prompting them to enable notifications.
After enabling, the gate stays dismissed. The user can disable
reminders from [Settings](./settings.md).

## How it's wired

```
┌──────────────────────┐   ┌─────────────────────────┐
│ Client (useReminders)│──▶│ /api/push/subscribe     │  ←─ enable flow
│                      │   └─────────────────────────┘
│                      │
│                      │   ┌─────────────────────────┐
│                      │──▶│ /api/push/reminders     │  ←─ per-todo schedule
└──────────────────────┘   └─────────────────────────┘

       ┌──────────────────────────────────┐
       │ Vercel Cron (daily, 15:00 UTC)   │
       │                                  │
       │      ↓                           │
       │  /api/push/notify-cron           │  ←─ scans reminder:* keys,
       │      ↓                           │     sends due ones, deletes.
       │  web-push → endpoint             │
       └──────────────────────────────────┘

       ┌──────────────────────────────────┐
       │ Service Worker (push handler)    │
       │      ↓                           │
       │ showNotification(...)            │
       │ click → focus + postMessage      │
       │       → openWindow(/?todo=ID)    │
       └──────────────────────────────────┘
```

## Data model

### Client (localStorage)

| Key                               | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `simple-todos:browserId`          | Stable per-browser ID for matching subscriptions.    |
| `simple-todos:reminders:prompted` | "1" once we've shown the gate; suppresses re-prompt. |

### Server (Upstash Redis)

| Key                        | Shape                                                          |
| -------------------------- | -------------------------------------------------------------- |
| `subscription:<browserId>` | `{ browserId, createdAt, subscription: PushSubscriptionJSON }` |
| `reminder:<reminderId>`    | `{ reminderId, browserId, todoId, title, fireAt }`             |

`reminderId` is `r-<todoId>`. One reminder per todo at a time;
updating a todo's due date overwrites the reminder.

## Reconciliation

`TodoApp` runs an idempotent reconciliation effect whenever the todo
list changes:

```tsx
useEffect(() => {
  for (const t of todos) {
    void syncTodoReminder(t);
  }
}, [todos, syncTodoReminder]);
```

`syncTodoReminder` POSTs a reminder for due+open todos and DELETEs
for everything else. It's safe to call on every render because the
server endpoint is idempotent.

This pattern replaced an earlier per-mutation `queueMicrotask` that
captured a stale `todos` closure and missed newly-created todos
entirely — see [ADR 0008](../decisions/0008-integration-tests-on-the-wiring-seam.md).

## Cron behavior

`/api/push/notify-cron`:

1. Authenticates against `CRON_SECRET` (Vercel Cron auto-attaches as
   bearer).
2. Scans every `reminder:*` key.
3. For each with `fireAt <= now`:
   - Looks up the matching `subscription:<browserId>`.
   - Sends a Web Push with payload `{ title, body, todoId, url }`.
   - Deletes the reminder key.

If the subscription is missing (browser cleared data or uninstalled
PWA), the reminder is silently dropped. Web Push 410 GONE responses
are not yet special-cased — see "Known gaps" below.

## How it's tested

| Test                                     | Layer       | What it covers                                     |
| ---------------------------------------- | ----------- | -------------------------------------------------- |
| `src/lib/useReminders.test.ts`           | Unit        | Subscription flow, fireAt computation, sync POSTs. |
| `src/lib/pushStore.test.ts`              | Unit        | Redis CRUD shapes.                                 |
| `src/lib/webPush.test.ts`                | Unit        | VAPID-signed send.                                 |
| `src/components/TodoApp.test.tsx` (seam) | Integration | `TodoApp` calls `syncTodoReminder` correctly.      |
| `tests/e2e/reminders.spec.ts`            | E2E         | The gate UI; subscribe POST fires; busy state.     |

E2E doesn't trigger real notifications — Web Push requires APNs/FCM
plumbing the test environment doesn't have. The notification surface
is verified manually on the actual device.

## Known gaps

- **No 410 GONE handling.** When a subscription endpoint dies, the
  cron logs the failure but doesn't delete the dead subscription.
  Builds up over time on multi-device use.
- **No idempotency in the cron itself.** If `notify-cron` crashes
  between "send" and "delete", the reminder fires again on the next
  run. Tracked as PR 4.
- **No timezone awareness.** Reminders fire at 15:00 UTC for everyone.
  Single-user app, so the author just picked a time they're awake.

## References

- Client: `src/lib/useReminders.ts`
- Server: `src/lib/pushStore.ts`, `src/lib/webPush.ts`
- Routes: `src/app/api/push/`
- Cron config: `vercel.json`
- Service worker: `public/sw.js`
- Related: [ADR 0004](../decisions/0004-web-push-via-vapid.md),
  [features/deep-link.md](./deep-link.md)
