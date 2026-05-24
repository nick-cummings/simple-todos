"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  backupFilename,
  BackupParseError,
  buildBackup,
  clearAllAppData,
  parseBackup,
  writeBackupToStorage,
} from "@/lib/backup";
import { useLabels } from "@/lib/useLabels";
import { useReminders } from "@/lib/useReminders";
import { useTodos } from "@/lib/useTodos";

import packageJson from "../../../package.json";

const APP_VERSION = packageJson.version;

export default function Settings() {
  const { todos } = useTodos();
  const { labels } = useLabels();
  const {
    active: remindersActive,
    disable: disableReminders,
    permission,
  } = useReminders({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  const [busy, setBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<
    null | { kind: "error"; text: string } | { kind: "success"; text: string }
  >(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState<null | {
    file: File;
    parsedSummary: string;
  }>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const backup = buildBackup(todos, labels);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    document.body.append(a);
    a.click();
    a.remove();
    // Revoke on next tick so Safari has time to start the download.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function handleImportPick() {
    importInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;
    setImportMessage(null);
    try {
      const raw = await file.text();
      const backup = parseBackup(raw);
      setConfirmingImport({
        file,
        parsedSummary: `${backup.todos.length} todos and ${backup.labels.length} labels`,
      });
    } catch (error) {
      const msg =
        error instanceof BackupParseError
          ? error.message
          : "Failed to read the file.";
      setImportMessage({ kind: "error", text: msg });
    }
  }

  async function confirmImport() {
    if (!confirmingImport) return;
    setBusy(true);
    try {
      const raw = await confirmingImport.file.text();
      const backup = parseBackup(raw);
      const written = writeBackupToStorage(backup);
      if (!written) {
        setImportMessage({
          kind: "error",
          text: "Saved partially — your browser's storage filled up before the import finished. The global banner has more detail.",
        });
        setConfirmingImport(null);
        return;
      }
      setImportMessage({
        kind: "success",
        text: `Imported ${backup.todos.length} todos and ${backup.labels.length} labels. Reload to see them.`,
      });
      setConfirmingImport(null);
    } catch (error) {
      const msg =
        error instanceof BackupParseError
          ? error.message
          : "Failed to import the backup.";
      setImportMessage({ kind: "error", text: msg });
      setConfirmingImport(null);
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    clearAllAppData();
    setConfirmingClear(false);
    // Hard reload so every hook re-reads the now-empty storage.
    globalThis.location.assign("/");
  }

  async function handleDisableReminders() {
    setBusy(true);
    try {
      await disableReminders();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-7 px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-5xl font-semibold tracking-[-0.045em] leading-none">
            Settings
          </h1>
          <Link className="text-[13px] text-muted hover:text-fg" href="/">
            ← back to todos
          </Link>
        </div>
      </header>

      <section
        aria-labelledby="reminders-heading"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5"
      >
        <h2 className="text-base font-semibold" id="reminders-heading">
          Reminders
        </h2>
        <p className="text-[13px] text-muted">
          {remindersCopy(remindersActive, permission)}
        </p>
        {remindersActive && (
          <div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-subtle px-3 text-[13px] font-medium hover:bg-subtle-hover disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                void handleDisableReminders();
              }}
              type="button"
            >
              Disable reminders
            </button>
          </div>
        )}
      </section>

      <section
        aria-labelledby="backup-heading"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5"
      >
        <h2 className="text-base font-semibold" id="backup-heading">
          Backup
        </h2>
        <p className="text-[13px] text-muted">
          Your todos live in this browser&rsquo;s local storage. Export a JSON
          file periodically — if you clear browser data or switch devices,
          you&rsquo;ll need it.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary-border bg-primary-bg px-3 text-[13px] font-medium text-primary hover:bg-primary-bg-strong"
            onClick={handleExport}
            type="button"
          >
            Export to JSON
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-subtle px-3 text-[13px] font-medium hover:bg-subtle-hover"
            onClick={handleImportPick}
            type="button"
          >
            Import from JSON…
          </button>
          <input
            accept="application/json,.json"
            aria-label="Backup file"
            className="sr-only"
            onChange={(e) => {
              void handleImportFile(e);
            }}
            ref={importInputRef}
            type="file"
          />
        </div>
        {importMessage && (
          <p
            className={`text-[13px] ${
              importMessage.kind === "error" ? "text-danger" : "text-primary"
            }`}
            role={importMessage.kind === "error" ? "alert" : "status"}
          >
            {importMessage.text}
          </p>
        )}
      </section>

      <section
        aria-labelledby="data-heading"
        className="flex flex-col gap-3 rounded-2xl border border-danger bg-card p-5"
      >
        <h2 className="text-base font-semibold text-danger" id="data-heading">
          Danger zone
        </h2>
        <p className="text-[13px] text-muted">
          Removes every todo, label, and preference stored in this browser.
          Export first if you want to keep them.
        </p>
        <div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-danger bg-danger-bg px-3 text-[13px] font-medium text-danger hover:bg-danger hover:text-white"
            onClick={() => {
              setConfirmingClear(true);
            }}
            type="button"
          >
            Clear all data
          </button>
        </div>
      </section>

      <footer className="text-[12px] text-faint">
        Simple Todos · v{APP_VERSION}
      </footer>

      {confirmingImport && (
        <ConfirmDialog
          confirmLabel={busy ? "Importing…" : "Replace data"}
          danger
          disabled={busy}
          message={`Importing ${confirmingImport.parsedSummary} will replace every todo and label in this browser. This can't be undone — export your current data first if you want to keep it.`}
          onCancel={() => {
            setConfirmingImport(null);
          }}
          onConfirm={() => {
            void confirmImport();
          }}
          title="Replace all data with this backup?"
        />
      )}
      {confirmingClear && (
        <ConfirmDialog
          confirmLabel="Clear everything"
          danger
          message="This removes every todo, label, theme, and reminder setting from this browser. The page will reload."
          onCancel={() => {
            setConfirmingClear(false);
          }}
          onConfirm={handleClear}
          title="Clear all data?"
        />
      )}
    </main>
  );
}

function ConfirmDialog({
  confirmLabel,
  danger,
  disabled,
  message,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div
      aria-label={title}
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      role="dialog"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-[13px] text-muted">{message}</p>
        <div className="mt-1 flex justify-end gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-subtle px-3 text-[13px] font-medium hover:bg-subtle-hover"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className={
              danger
                ? "inline-flex h-10 items-center gap-2 rounded-lg border border-danger bg-danger px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                : "inline-flex h-10 items-center gap-2 rounded-lg border border-primary-border bg-primary px-3 text-[13px] font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
            }
            disabled={disabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function remindersCopy(
  active: boolean,
  permission: "denied" | "granted" | "prompt" | "unsupported",
): string {
  if (active) {
    return "Push reminders are active on this device. Disabling will stop the daily reminder push for due todos.";
  }
  if (permission === "denied") {
    return "Notifications are blocked in your browser. Enable them in your browser settings to receive reminders.";
  }
  return "Reminders are off. Enable them from the prompt on the home screen when you next add a due date.";
}
