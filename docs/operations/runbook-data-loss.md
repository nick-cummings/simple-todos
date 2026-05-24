# Runbook: data loss / storage failure

This runbook covers the symptoms you'd actually see when something
goes sideways with the client-side data layer, and the recovery
paths for each.

## Symptom: "Storage is full" banner is showing

**What it means.** A write to `localStorage` failed with
`QuotaExceededError`. The most recent change is in memory only and
will be lost on reload.

**What to do.**

1. Open Settings → Backup → **Export to JSON**. This downloads a
   complete snapshot of todos + labels, regardless of the quota
   state.
2. Verify the downloaded file opens and looks sane.
3. Open Settings → Danger zone → **Clear all data**.
4. Import the backup back via Settings → Backup → **Import from JSON**.

This round-trip works because the export reads from in-memory state
(no write needed), and the clear + import frees and refills storage
in one motion. After the import the app should be usable again.

**Why not just delete completed todos?** Deleting individual todos
also writes to localStorage. If the quota is genuinely exceeded,
those writes will fail too — putting you in a stuck state. The
export-clear-import cycle is the only path that guarantees forward
progress.

## Symptom: "Storage isn't available" banner

Less common. Usually means the browser is in private/incognito mode
where localStorage is either disabled or has a tiny quota. The user
can still use the app for a session but nothing will persist.

**What to do.** Suggest the user switch to a normal browser window.
There's no recovery within the private window — explicitly nothing
the app can do.

## Symptom: app is empty after a reload, but you had data before

A few possibilities, in order of likelihood:

1. **The user cleared site data.** Open `Settings → Clear all data`
   counts here, and so does the browser's own "Clear browsing data"
   for this origin.
2. **A localStorage schema migration ran.** The storage keys are
   versioned (`simple-todos:v1`, `simple-todos:labels:v1`). If a
   future version introduces `:v2` keys and a faulty migration
   doesn't carry the data over, this is the failure mode.
3. **A write actually never persisted, silently, in the past** —
   pre-PR-5 (this runbook). If recovering from before this PR
   landed, the data is genuinely gone.

**What to do.** If the user has a backup JSON file, import it via
Settings. If not, check Sentry for `area: storage` events in the
relevant time window — those will pinpoint the failure.

## Symptom: import says "saved partially"

The import succeeded for the first key but failed quota on the
second. Half the data is in, half isn't. The global storage banner
will also be visible.

**What to do.** Follow the "Storage is full" recovery (export, clear,
import). The partial state is unstable; don't keep editing in it.

## Where to look in Sentry

Filter by `area: storage` to find all quota / write-failure events.
Each event carries:

- `code` — `quota_exceeded` | `unavailable` | `unknown`
- `key` — which storage key the write was targeting

If you see a sustained pattern of `quota_exceeded` events, the user
has genuinely outgrown localStorage and a follow-up that adds
auto-archive (or moves to IndexedDB) becomes worth doing. See
[ADR 0012](../decisions/0012-localstorage-quota-handling.md) for the
discussion of why we didn't do this upfront.
