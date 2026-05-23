# AI description generation

A button in the todo modal that generates a description from the
title using Claude.

## What the user sees

When creating or editing a todo, the description field has an "AI"
button next to its label. The button is disabled until the title has
content. Clicking it:

1. Captures the user's geolocation (best-effort; resolves null
   silently if denied).
2. POSTs `{ title, location }` to `/api/generate-description`.
3. On success, fills the description field with the generated text.
4. On rate-limit (429), shows the rate-limit message inline.
5. On any other failure, shows "Network error — try again."

The description is suggestion-grade — it's a one-paragraph elaboration
of what the todo might involve. Geolocation lets it add contextual
flavor ("good weather today for a run", etc.).

## Why geolocation

Without location, the AI gets the title and nothing else. With it, it
can riff on weather, time of day, and rough region. The user
explicitly opted in to the feature by clicking the AI button, so
the geolocation prompt is at a sensible time (not on page load).

`getLocationBestEffort()` swallows denial and timeout and resolves
null. The route handler accepts a null location.

## How it's wired

```
TodoModal/FormBody.tsx
   │
   ├─ getLocationBestEffort() ──▶ navigator.geolocation
   │
   └─ fetch POST /api/generate-description
                   │
                   ▼
       src/app/api/generate-description/route.ts
                   │
                   ├─ @upstash/ratelimit (per IP, sliding window)
                   ├─ build prompt from src/lib/ai/prompts/
                   └─ @anthropic-ai/sdk → Anthropic Messages API
```

## Rate limiting

`@upstash/ratelimit` with a sliding window. Limits are conservative —
this is a single-user app, but the endpoint is internet-reachable and
the Anthropic API key shouldn't get used by a stranger if the URL
leaks. Limit is per IP, not per browserId; the browserId is
client-only and the endpoint can't authenticate it without auth.

The 429 response carries `{ error: "Rate limit reached. Try again in
~N min." }` for the UI to display.

## Secrets

`ANTHROPIC_API_KEY` is server-only (never `NEXT_PUBLIC_`). It lives
in Vercel env via Terraform.

## How it's tested

| Test                                             | Layer       | Coverage                                              |
| ------------------------------------------------ | ----------- | ----------------------------------------------------- |
| `src/app/api/generate-description/route.test.ts` | Unit        | Route handler: input validation, rate limit, success. |
| `src/components/TodoModal.test.tsx` (AI block)   | Integration | AI button state, fetch response handling.             |
| `tests/e2e/ai-description.spec.ts`               | E2E         | Mocked API success / 429 / disabled-when-empty paths. |

E2E uses `page.route()` to mock the API response so tests don't hit
Anthropic. Playwright config grants geolocation up-front so
`getCurrentPosition()` resolves instantly across browsers — see
[ADR 0009](../decisions/0009-playwright-container-and-workers.md).

## Known gaps

- **No "regenerate" button.** Once a description is filled, replacing
  it requires clearing the field first.
- **No streaming.** The route handler waits for the full Anthropic
  response before returning. Acceptable for short descriptions but
  could feel slow on long generations.

## References

- UI: `src/components/TodoModal/FormBody.tsx`,
  `src/components/TodoModal/getLocationBestEffort.ts`
- Route: `src/app/api/generate-description/route.ts`
  (handles prompt assembly and `@upstash/ratelimit` inline)
- Prompt builder: `src/lib/prompts/generateDescription.ts`
- Related: [security.md](../security.md) (rate limit posture)
