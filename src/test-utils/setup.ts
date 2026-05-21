import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

beforeEach(() => {
  // Each test gets a clean slate. Hooks read from localStorage on
  // first call; we also reset module caches in hook-specific tests.
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  // Unmount any components rendered via RTL.
  cleanup();
});
