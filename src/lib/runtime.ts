/**
 * `typeof window === "undefined"` is the universal SSR guard. Wrap it
 * once so the rest of the codebase doesn't need to disable
 * `@typescript-eslint/no-unnecessary-condition` (TS types `window` as
 * always defined) and `unicorn/no-typeof-undefined` at every call site.
 */
export function isBrowser(): boolean {
    return typeof globalThis.window !== "undefined";
}
