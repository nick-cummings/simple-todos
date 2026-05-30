/**
 * Whether the design-mockup routes under `/mockups/*` should render.
 *
 * Mockups are unfinished UI and dead weight in the prod surface, so they
 * 404 in production. They stay reachable everywhere else (local dev and
 * Vercel preview deploys) so the author can still review them.
 *
 * Prefer Vercel's `VERCEL_ENV` ("production" | "preview" | "development")
 * when present so preview deploys keep the mockups; fall back to
 * `NODE_ENV` for local and other non-Vercel builds.
 */
export function mockupsEnabled(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv !== "production";
  return process.env.NODE_ENV !== "production";
}
