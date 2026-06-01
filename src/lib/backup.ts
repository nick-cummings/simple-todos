import { isLabel, type Label, LABELS_STORAGE_KEY } from "./labels";
import { safeWrite } from "./storage";
import { isTodo, STORAGE_KEY, type Todo } from "./todos";

// Backup file shape. Version-stamped so future migrations can branch
// on it; bump CURRENT_BACKUP_VERSION when adding incompatible fields.
export const CURRENT_BACKUP_VERSION = 1 as const;

// Upper bound on each array to reject pathological / malicious input
// before we try to validate and persist it. Far above any realistic
// hand-curated todo list; a backup over this is corrupt or hostile.
export const MAX_BACKUP_ITEMS = 100_000;

export interface BackupFile {
    exportedAt: string;
    labels: Label[];
    todos: Todo[];
    version: typeof CURRENT_BACKUP_VERSION;
}

export class BackupParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BackupParseError";
    }
}

export function backupFilename(now: Date = new Date()): string {
    // YYYY-MM-DD — local time, so the filename matches the user's day.
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, "0");
    const d = `${now.getDate()}`.padStart(2, "0");
    return `simple-todos-backup-${y}-${m}-${d}.json`;
}

export function buildBackup(todos: Todo[], labels: Label[]): BackupFile {
    return {
        exportedAt: new Date().toISOString(),
        labels,
        todos,
        version: CURRENT_BACKUP_VERSION,
    };
}

// "Simple-todos" namespace; sweep removes every namespaced key plus
// the few unprefixed keys the app owns. Returns the list of removed
// keys for tests / confirmation copy.
export function clearAllAppData(): string[] {
    const removed: string[] = [];
    const ls = globalThis.localStorage;
    for (let i = ls.length - 1; i >= 0; i -= 1) {
        const key = ls.key(i);
        if (key?.startsWith("simple-todos:")) {
            removed.push(key);
            ls.removeItem(key);
        }
    }
    return removed;
}

// Throws BackupParseError with a user-friendly message on any
// malformed input. Callers should catch and surface the message.
export function parseBackup(raw: string): BackupFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new BackupParseError("Not valid JSON.");
    }
    if (!isPlainObject(parsed)) {
        throw new BackupParseError("Expected an object at the top level.");
    }
    const { labels, todos, version } = parsed;
    if (version !== CURRENT_BACKUP_VERSION) {
        throw new BackupParseError(
            `Unsupported backup version: ${typeof version === "number" ? version : "missing"}. This app reads version ${CURRENT_BACKUP_VERSION}.`,
        );
    }
    if (!Array.isArray(todos)) {
        throw new BackupParseError("Backup is missing a valid `todos` array.");
    }
    if (todos.length > MAX_BACKUP_ITEMS) {
        throw new BackupParseError(
            `Backup has too many todos (max ${MAX_BACKUP_ITEMS}).`,
        );
    }
    if (!todos.every(isTodo)) {
        throw new BackupParseError("Backup is missing a valid `todos` array.");
    }
    if (!Array.isArray(labels)) {
        throw new BackupParseError("Backup is missing a valid `labels` array.");
    }
    if (labels.length > MAX_BACKUP_ITEMS) {
        throw new BackupParseError(
            `Backup has too many labels (max ${MAX_BACKUP_ITEMS}).`,
        );
    }
    if (!labels.every(isLabel)) {
        throw new BackupParseError("Backup is missing a valid `labels` array.");
    }
    return {
        exportedAt:
            typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
        labels,
        todos,
        version: CURRENT_BACKUP_VERSION,
    };
}

// Side-effect helpers — kept here so the Settings page can stay
// declarative and the logic is unit-testable.
//
// Returns `true` only if both writes succeed. On a quota failure the
// first write may succeed and the second fail; the caller surfaces
// the partial-import state via the storage-error banner and should
// guide the user to free space + retry.
export function writeBackupToStorage(backup: BackupFile): boolean {
    const todosOk = safeWrite(STORAGE_KEY, JSON.stringify(backup.todos));
    const labelsOk = safeWrite(
        LABELS_STORAGE_KEY,
        JSON.stringify(backup.labels),
    );
    return todosOk && labelsOk;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
