import type { Todo } from "@/lib/todos";
import type { Label, LabelColor } from "@/lib/labels";

/**
 * Test data factories. Each call returns a fresh object with sensible
 * defaults; pass partial overrides to customize. Counters in scope so
 * IDs/names are unique within a test run.
 */

let todoSeq = 0;
let labelSeq = 0;

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  todoSeq += 1;
  const now = Date.now();
  return {
    id: `todo-${todoSeq}`,
    title: `Todo ${todoSeq}`,
    completed: false,
    labels: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
  labelSeq += 1;
  return {
    name: `label-${labelSeq}`,
    color: "gray" as LabelColor,
    createdAt: Date.now(),
    ...overrides,
  };
}

/** Reset factory counters — call in tests that assert exact IDs/names. */
export function resetFactoryCounters() {
  todoSeq = 0;
  labelSeq = 0;
}
