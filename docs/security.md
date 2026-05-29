# Security

## Threat model

Single-user app, hosted on Vercel, no authentication. The trust model
follows from that:

- **The author trusts their own device.** Todos and labels are stored
  in `localStorage` and never sent to the server. There's nothing
  sensitive in them by policy, but they also can't leak to anyone but
  the author.
- **The server is treated as semi-trusted.** It holds Web Push
  subscription endpoints and reminder records, but no todo content.
- **Anyone on the internet can reach the public routes.** API endpoints
  must defend themselves with rate limiting and bearer auth (cron) and
  must not assume a legitimate user is calling.

What we are _not_ defending against: a state-level adversary, a
compromised Vercel runtime, or a compromised author device. Out of
scope for a single-user todo app.

## Mitigations in place

### Security headers

Applied to every response via `next.config.ts → headers()`:

| Header                   | Value                                                       | Why                                 |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------- |
| `X-Frame-Options`        | `DENY`                                                      | Clickjacking defense.               |
| `X-Content-Type-Options` | `nosniff`                                                   | Block MIME sniffing.                |
| `Referrer-Policy`        | `strict-origin-when-cross-origin`                           | Don't leak full URLs cross-origin.  |
| `Permissions-Policy`     | `geolocation=(self), camera=(), microphone=(), payment=()…` | Disable powerful APIs we don't use. |

HSTS comes from Vercel for HTTPS responses.

A full Content-Security-Policy isn't in place yet. Tailwind injects inline
styles, Next inlines some scripts during hydration, and PostHog (incoming)
will need its own connect/script-src entries. We'll add CSP when those
moving parts settle.

### Secrets

Three categories:

| Secret                         | Where it lives                                              |
| ------------------------------ | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY`            | `infra/terraform.tfvars` (gitignored) → Vercel project env  |
| `UPSTASH_REDIS_REST_URL/TOKEN` | same                                                        |
| `VAPID_PRIVATE_KEY`            | same                                                        |
| `CRON_SECRET`                  | same; auto-attached by Vercel Cron as a bearer token        |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel env at build time; ends up in client bundle (public) |

`.env*` and `infra/*.tfvars` are gitignored. The only key shipped to the
browser is the VAPID _public_ key, which is its intended use.

### API routes

All routes under `/api/` follow the same posture:

- **`POST /api/generate-description`** — rate-limited per IP via
  `@upstash/ratelimit` (sliding window). Input is validated; non-trivial
  prompts are rejected. Anthropic API key is server-only. When Upstash
  isn't configured (local dev, or before Redis is provisioned) it falls
  back to a per-lambda in-memory limiter. That map is bounded: expired
  entries are pruned on every call, and a hard `MAX_BUCKETS` cap evicts
  the oldest entries if a flood of distinct IPs within a single window
  would otherwise overflow it — so a hostile spray of unique source IPs
  can't grow it without limit across the lambda's lifetime. The tradeoff:
  once that cap is hit (>`MAX_BUCKETS` live IPs in one window), evicting
  the oldest _live_ bucket resets that IP's counter early, so a determined
  flood could let an evicted IP regain its quota — an accepted, bounded
  relaxation that only applies to the in-memory fallback, never the
  shared Upstash limiter.
- **`POST /api/push/subscribe`** — accepts only known browserId-bound
  subscriptions. Idempotent.
- **`DELETE /api/push/subscribe`** — removes a subscription by browserId.
- **`POST /api/push/reminders` / `DELETE /api/push/reminders/[id]`** —
  CRUD on reminder records. Bound to a known browserId.
- **`POST /api/push/notify-cron`** — bearer-authenticated against
  `CRON_SECRET`. Vercel Cron is the only legitimate caller.

The cron handler refuses requests that don't carry the bearer.

### CSRF / origin pinning

The browser-side flows are same-origin only and don't use cookies for
authn (there's no authn). CSRF is therefore not exploitable in any
meaningful way against the user's data — the worst an attacker can do is
provoke a reminder to fire, and they'd need the `CRON_SECRET` to do it.

### Service Worker

The SW only handles `GET` requests; `POST`/`DELETE`/`PUT` pass straight
to the network. Notification permission and Web Push subscriptions are
per-browser opt-ins. The user can revoke at any time via OS-level
settings or the in-app Settings page.

## Dependency hygiene

- `npm audit` runs in pre-push verify via `npm ci` — Husky pre-push hook
  doesn't currently fail on audit, but `npm ci` will warn on critical
  vulnerabilities.
- Dependencies are minimal; the prod bundle includes Next, React,
  Anthropic SDK, Upstash, and `web-push`. No transitive bloat from
  client-side UI libs (everything custom).

## Known gaps (tracked)

- **No CSP.** See above.
- **`infra/terraform.tfstate` is checked in.** This is fine because the
  state file holds resource IDs, not secrets; secrets come from
  `terraform.tfvars` which is gitignored. But it's worth being explicit.
