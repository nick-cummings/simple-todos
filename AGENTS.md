<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Documentation is part of every change

Anything beyond a minor bug fix lands with a docs update in the same commit/PR. One of:

- A new ADR in `docs/decisions/` when the change involves a material engineering judgement (architecture, dependency, format, security posture, performance budget). Use `docs/decisions/TEMPLATE.md`.
- A new or updated feature doc in `docs/features/` when the change introduces or alters user-facing behavior.
- A new or updated runbook in `docs/operations/` when the change adds production failure modes someone will need to recover from.

"Minor bug fix" = typo, CSS tweak, regex tightening. Anything that touches behavior, data shape, infrastructure, dependencies, or test strategy is _not_ a minor bug fix.

Read `docs/README.md` to orient before making changes. The rationale for this convention is in `docs/decisions/0001-everything-substantial-gets-a-doc.md`.
