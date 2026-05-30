import { describe, it, expect } from 'vitest';
import { parseTodoHash, todoHash } from './deepLink';

describe('parseTodoHash', () => {
  it('extracts the id from a #todo-<id> hash', () => {
    expect(parseTodoHash('#todo-abc123')).toBe('abc123');
  });

  it('accepts a hash without the leading #', () => {
    expect(parseTodoHash('todo-abc123')).toBe('abc123');
  });

  it('handles UUID ids that contain hyphens', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(parseTodoHash(todoHash(id))).toBe(id);
  });

  it('returns null for an empty hash', () => {
    expect(parseTodoHash('')).toBeNull();
    expect(parseTodoHash('#')).toBeNull();
  });

  it('returns null for an unrelated hash', () => {
    expect(parseTodoHash('#section-2')).toBeNull();
    expect(parseTodoHash('#settings')).toBeNull();
  });

  it('returns null for a bare #todo- with no id', () => {
    expect(parseTodoHash('#todo-')).toBeNull();
  });
});

describe('todoHash', () => {
  it('builds a #todo-<id> fragment', () => {
    expect(todoHash('abc123')).toBe('#todo-abc123');
  });

  it('round-trips with parseTodoHash', () => {
    expect(parseTodoHash(todoHash('xyz'))).toBe('xyz');
  });
});
