const TODO_HASH_PREFIX = 'todo-';

/**
 * Parse a URL hash into a todo id. Recognizes only the `#todo-<id>` shape and
 * returns the id; any other hash (including a bare `#todo-`) yields null.
 */
export function parseTodoHash(hash: string): string | null {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!withoutHash.startsWith(TODO_HASH_PREFIX)) return null;
  const id = withoutHash.slice(TODO_HASH_PREFIX.length);
  return id.length > 0 ? id : null;
}

/** Build the canonical hash fragment (including `#`) for a todo id. */
export function todoHash(id: string): string {
  return `#${TODO_HASH_PREFIX}${id}`;
}
