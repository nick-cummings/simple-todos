---
status: accepted
date: 2026-05-15
---

# 0004 — Reminders via Web Push (VAPID), not APNs

## Context

The app needs to notify the user when a todo is due. The primary
surface is an installed iOS PWA. The options for delivering a
background-friendly notification:

- **Apple Push Notification service (APNs).** The standard way to push
  to iOS. Requires an Apple Developer account ($99/yr) and a native
  app on the App Store.
- **Web Push with VAPID.** The W3C standard, works in installed iOS
  Safari PWAs as of iOS 16.4. No App Store required.
- **In-app polling.** App opens, checks for due todos, shows a UI
  banner. Useless when the app is closed — defeats the purpose of a
  reminder.
- **Email.** Cheapest, but the author already gets too many emails.

## Decision

Web Push using VAPID keys. The browser subscribes to push, sends the
endpoint + auth keys to our server, and we POST a signed payload to
the endpoint at the right time. The service worker shows the
notification; tapping it deep-links into the app.

## Alternatives considered

See above. APNs was the main contender; rejected for the App Store
gate and the $99/yr cost relative to a one-user app.

## Consequences

- **Works without the App Store.** Install via Safari → Share → Add to
  Home Screen. Reminders work after that.
- **iOS-specific quirk: notifications only work in installed PWAs.**
  Web Push from Safari (the browser tab) does not work on iOS; only
  the installed PWA does. This is an Apple platform decision we just
  live with. The Reminders gate UI explains the install requirement.
- **VAPID key pair is shipped via env vars.** Public half is
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (bundled into the client). Private
  half stays server-side in Vercel env. Both rotate by replacing the
  Terraform vars and `terraform apply`.
- **Subscription endpoints are per-device.** A user with two devices
  has two subscription rows. Today that's "the author has one phone
  and one laptop"; both subscribe independently.
- **Subscriptions can go stale.** When the user clears browser data or
  uninstalls the PWA, the endpoint returns 410 GONE. We currently
  don't garbage-collect; a planned PR will delete on 410.

## References

- Subscribe flow: `src/lib/useReminders.ts`, `src/app/api/push/subscribe/route.ts`
- Send: `src/lib/webPush.ts`, `src/app/api/push/notify-cron/route.ts`
- Service worker push handler: `public/sw.js`
- Reminder records: `src/lib/pushStore.ts`
- Related: [ADR 0003](./0003-vercel-hobby-constraints.md) (cron cadence),
  [features/reminders.md](../features/reminders.md)
