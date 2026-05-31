// Force every /mockups/* route to render at REQUEST time instead of being
// statically prerendered at build. `next build` always runs with
// NODE_ENV=production and without VERCEL_ENV, so a prerendered mockup page
// evaluates `mockupsEnabled()` at build → false → bakes a 404 into the page on
// EVERY deploy (preview included). `force-dynamic` cascades to the whole route
// segment (Next route-segment config: a force-* option makes the route fully
// dynamic), so the gate runs per request and reads the runtime VERCEL_ENV —
// "preview" renders the mockup, "production" 404s it. See ADR 0016.
export const dynamic = "force-dynamic";

export default function MockupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
