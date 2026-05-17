export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "simple-todos:theme";

export function isTheme(v: unknown): v is Theme {
  return v === "system" || v === "light" || v === "dark";
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

// Inline bootstrap script injected into <head> so the correct theme class
// is set BEFORE the first paint — prevents flash of wrong theme.
export const THEME_BOOTSTRAP_SCRIPT = `
(function(){try{
  var k=${JSON.stringify(THEME_KEY)};
  var s=localStorage.getItem(k);
  if(s!=="light"&&s!=="dark"&&s!=="system")s="system";
  var d=s==="dark"||(s==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  var r=document.documentElement;
  if(d)r.classList.add("dark");else r.classList.remove("dark");
  r.style.colorScheme=d?"dark":"light";
}catch(e){}})();
`;
