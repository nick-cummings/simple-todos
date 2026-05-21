import type { Label } from "@/lib/labels";
import type { Todo } from "@/lib/todos";

/**
 * Test data factories. Each call returns a fresh object with sensible
 * defaults; pass partial overrides to customize. Counters in scope so
 * IDs/names are unique within a test run.
 */

let todoSeq = 0;
let labelSeq = 0;

export function makeLabel(overrides: Partial<Label> = {}): Label {
  labelSeq += 1;
  return {
    color: "gray",
    createdAt: Date.now(),
    name: `label-${labelSeq}`,
    ...overrides,
  };
}

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  todoSeq += 1;
  const now = Date.now();
  return {
    completed: false,
    createdAt: now,
    id: `todo-${todoSeq}`,
    labels: [],
    title: `Todo ${todoSeq}`,
    updatedAt: now,
    ...overrides,
  };
}

/** Reset factory counters — call in tests that assert exact IDs/names. */
export function resetFactoryCounters() {
  todoSeq = 0;
  labelSeq = 0;
}
