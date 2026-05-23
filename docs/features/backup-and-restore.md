# Backup & restore

Manual JSON export/import of the user's todos and labels.

## Why this exists

User data lives in localStorage (see
[ADR 0002](../decisions/0002-localstorage-as-source-of-truth.md)). That
makes the device the only copy. Clearing browser data, uninstalling
the PWA, or switching devices loses everything.

Backup is the manual sync path: export from device A, import into
device B. It's also the disaster-recovery path for "I accidentally
cleared site data."

## What the user sees

In Settings → Backup:

- **Export to JSON** — downloads `simple-todos-backup-YYYY-MM-DD.json`
  with the current todos and labels.
- **Import from JSON…** — file picker. After picking a valid file,
  shows a confirmation dialog with the count summary ("Importing 12
  todos and 3 labels will replace every todo and label in this
  browser"). On confirm, replaces in-storage data.

The replace-vs-merge choice is intentional: a merge UI is much more
complex, and the dominant use case (restore from backup, or device
swap) wants a clean replace.

## File format

```json
{
  "version": 1,
  "exportedAt": "2026-05-23T15:00:00.000Z",
  "todos": [
    {
      "id": "abc123",
      "title": "Buy coffee",
      "completed": false,
      "labels": ["errands"],
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ],
  "labels": [{ "name": "errands", "color": "blue", "createdAt": 1700000000000 }]
}
```

`version` is currently `1`. Future incompatible format changes bump
the version and the parser refuses the wrong number with an explicit
error message.

## Validation

`parseBackup()` enforces shape:

- Top level is an object (not array or primitive).
- `version` matches `CURRENT_BACKUP_VERSION`.
- `todos` is an array of todo-shaped objects (id, title, completed,
  createdAt, updatedAt, labels[]).
- `labels` is an array of label-shaped objects (name, color, createdAt).
- `exportedAt` may be missing; defaults to empty string.

Any failure throws `BackupParseError` with a user-facing message. The
Settings UI surfaces the message in a `role="alert"` paragraph.

## How it's wired

```
src/lib/backup.ts          ← pure functions: buildBackup, parseBackup,
                             writeBackupToStorage, clearAllAppData
src/components/Settings/   ← UI: file picker, confirmation dialog,
                             status/error messages
```

Side-effects (file download, localStorage write, page reload after
"clear all data") are kept in the component layer; `backup.ts` is
testable in isolation.

## How it's tested

| Test                                        | Layer       | What it covers                                            |
| ------------------------------------------- | ----------- | --------------------------------------------------------- |
| `src/lib/backup.test.ts` (13 tests)         | Unit        | round-trip, every parser rejection path, quota write.     |
| `src/components/Settings/Settings.test.tsx` | Integration | Export blob shape, import error UI, replace-confirm flow. |
| `tests/e2e/settings.spec.ts`                | E2E         | Download fires, import preview/cancel preserves storage.  |

The parser rejection paths are tested individually: not-JSON,
non-object top level, wrong version, missing `todos`, malformed
`todos[]`, missing `labels`, malformed `labels[]`. Each path has its
own user-facing error message.

## Known gaps

- **No backup encryption.** Files are plaintext JSON. The user is
  responsible for storing them safely.
- **No automatic backup.** Manual export only. A "remind me to back
  up every N days" prompt would be a future enhancement.
- **No partial restore.** All-or-nothing replace. Merge with conflict
  resolution would be a significant feature; we'll add it if multi-
  device becomes a real concern.

## References

- Lib: `src/lib/backup.ts`
- UI: `src/components/Settings/Settings.tsx`
- Tests: `src/lib/backup.test.ts`,
  `src/components/Settings/Settings.test.tsx`,
  `tests/e2e/settings.spec.ts`
- Related: [ADR 0002](../decisions/0002-localstorage-as-source-of-truth.md)
