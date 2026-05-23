import { type Label, LABELS_STORAGE_KEY } from "./labels";
import { STORAGE_KEY, type Todo } from "./todos";

// Backup file shape. Version-stamped so future migrations can branch
// on it; bump CURRENT_BACKUP_VERSION when adding incompatible fields.
export const CURRENT_BACKUP_VERSION = 1 as const;

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
  if (!Array.isArray(todos) || !todos.every(looksLikeTodo)) {
    throw new BackupParseError("Backup is missing a valid `todos` array.");
  }
  if (!Array.isArray(labels) || !labels.every(looksLikeLabel)) {
    throw new BackupParseError("Backup is missing a valid `labels` array.");
  }
  return {
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
    labels,
    todos,
    version: CURRENT_BACKUP_VERSION,
  };
}

// Side-effect helpers — kept here so the Settings page can stay
// declarative and the logic is unit-testable.
export function writeBackupToStorage(backup: BackupFile): void {
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.todos));
  globalThis.localStorage.setItem(
    LABELS_STORAGE_KEY,
    JSON.stringify(backup.labels),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeLabel(value: unknown): value is Label {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    typeof value.createdAt === "number"
  );
}

function looksLikeTodo(value: unknown): value is Todo {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.completed === "boolean" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    Array.isArray(value.labels)
  );
}
