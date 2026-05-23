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
| `reminder:<reminderId>`    | `{ reminderId, browserId, todoId, title, fireAt, sentAt? }`    |

`sentAt` is set by the cron after a successful Web Push — see
"Idempotency" below.

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
   - **Dedupe check.** If the reminder has a `sentAt` within the
     last 6 hours, treat it as already delivered: delete and move on
     without sending. See "Idempotency" below.
   - Looks up the matching `subscription:<browserId>`.
   - Sends a Web Push with payload `{ title, body, todoId, url }`.
   - On success: writes `sentAt`, then deletes the reminder.
   - On 410 GONE: deletes both reminder and subscription.

If the subscription is missing (browser cleared data or uninstalled
PWA), the reminder is silently dropped.

## Idempotency

The cron's failure mode of concern: it sends a push successfully but
crashes before the subsequent delete completes. Without dedupe, the
next run would send the same notification again — at best annoying,
at worst (for multi-device users in the future) a real volume issue.

The fix has three parts:

1. **`sentAt` on `ReminderRecord`** — set the moment a Web Push
   succeeds, before the delete fires.
2. **Two-step "sent" path** — `markReminderSent(id, now)` then
   `deleteReminder(id)`. The first is a Redis write that updates the
   record in place; the second removes it. A crash between them
   leaves a "sent, not deleted" marker.
3. **Dedupe gate at the top of each loop iteration** — if `sentAt`
   is set and within `DEDUPE_WINDOW_MS` (6 hours), the cron skips the
   send and just deletes the stale marker. After 6 hours the window
   reopens (any reminder that old has had a full daily cron cycle
   pass) and the normal send path runs again.

The summary JSON the cron returns includes a `deduped` counter so
this path is observable in the response and (eventually, when wired)
in metrics.

What this does _not_ protect against: a crash between the successful
push and the `markReminderSent` write — the next run will resend.
That's the unavoidable two-phase commit problem; the only way to
fully close it would be a transactional "send + record" against a
system that supports both, which Web Push doesn't. Acceptable trade
since the failure case requires Redis to fail mid-cron, which is
rare.

## How it's tested

| Test                                         | Layer       | What it covers                                          |
| -------------------------------------------- | ----------- | ------------------------------------------------------- |
| `src/lib/useReminders.test.ts`               | Unit        | Subscription flow, fireAt computation, sync POSTs.      |
| `src/lib/pushStore.test.ts`                  | Unit        | Redis CRUD shapes; `markReminderSent` behavior.         |
| `src/lib/webPush.test.ts`                    | Unit        | VAPID-signed send.                                      |
| `src/components/TodoApp.test.tsx` (seam)     | Integration | `TodoApp` calls `syncTodoReminder` correctly.           |
| `src/app/api/push/notify-cron/route.test.ts` | Integration | Cron dispatch, ordering, dedupe-window, expired/failed. |
| `tests/e2e/reminders.spec.ts`                | E2E         | The gate UI; subscribe POST fires; busy state.          |

E2E doesn't trigger real notifications — Web Push requires APNs/FCM
plumbing the test environment doesn't have. The notification surface
is verified manually on the actual device.

## Known gaps

- **410 GONE handling is partial.** The cron deletes the subscription
  on a 410 from the push service (good), but doesn't have a separate
  GC for subscriptions that haven't received any reminder recently
  (so a device that's dead in another way can accumulate).
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
