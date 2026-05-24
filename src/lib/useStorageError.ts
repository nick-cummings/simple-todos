"use client";

import { useEffect, useState } from "react";

import { type StorageError, subscribeToStorageErrors } from "./storage";

interface StorageErrorState {
  /** Clear the currently-displayed error. */
  dismiss: () => void;
  /** Most recent storage failure, or `null` if none. */
  error: null | StorageError;
}

/**
 * Subscribes to the global storage-error pub/sub from `./storage`
 * and exposes the latest failure as React state.
 *
 * Multiple writes during a single quota-full window will fire the
 * underlying listener repeatedly; this hook collapses them — the
 * banner shows the most recent error and the user dismisses it
 * once.
 */
export function useStorageError(): StorageErrorState {
  const [error, setError] = useState<null | StorageError>(null);
  useEffect(() => {
    return subscribeToStorageErrors((next) => {
      setError(next);
    });
  }, []);
  return {
    dismiss: () => {
      setError(null);
    },
    error,
  };
}
