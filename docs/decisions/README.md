# Architecture Decision Records

Point-in-time records of material engineering judgements. Each ADR captures
the **context** that forced the decision, the **decision** itself, the
**alternatives considered**, and the **consequences** we accept.

ADRs are append-only. If a decision is reversed, write a new ADR that
explains why and link forward from the old one via `superseded-by` /
`supersedes` in the frontmatter.

Template: [TEMPLATE.md](./TEMPLATE.md)

## Index

| #    | Title                                                                                                       | Status   |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------- |
| 0001 | [Everything substantial gets a doc](./0001-everything-substantial-gets-a-doc.md)                            | accepted |
| 0002 | [localStorage is the source of truth for user data](./0002-localstorage-as-source-of-truth.md)              | accepted |
| 0003 | [Stay on the Vercel Hobby tier](./0003-vercel-hobby-constraints.md)                                         | accepted |
| 0004 | [Reminders via Web Push (VAPID), not APNs](./0004-web-push-via-vapid.md)                                    | accepted |
| 0005 | [Filter state lives in the URL](./0005-url-state-for-filters.md)                                            | accepted |
| 0006 | [Wrap `useSearchParams` consumers in `<Suspense>`](./0006-suspense-for-search-params.md)                    | accepted |
| 0007 | [Strict ESLint (tier 3) over a permissive setup](./0007-strict-eslint-tier-3.md)                            | accepted |
| 0008 | [When a feature splits into "hook + caller", test the seam](./0008-integration-tests-on-the-wiring-seam.md) | accepted |
| 0009 | [Playwright in CI: 4 workers + official container](./0009-playwright-container-and-workers.md)              | accepted |
| 0010 | [Disable the service worker in the Playwright test build](./0010-disable-sw-in-playwright.md)               | accepted |
| 0011 | [Sentry for error reporting](./0011-sentry-for-error-reporting.md)                                          | accepted |
| 0012 | [localStorage quota: catch + surface, don't pre-empt](./0012-localstorage-quota-handling.md)                | accepted |
| 0015 | [Gate the verify workflow on Lighthouse budgets](./0015-lighthouse-ci.md)                                   | accepted |

## Numbering

ADRs are numbered sequentially starting at 0001. Numbers are never reused;
a superseded ADR keeps its number and links forward.

Reserve a number by claiming it in your branch before writing the file.
Conflicts on `main` resolve in the order they merge.
