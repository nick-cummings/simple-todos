# Simple Todos

A minimalist todo PWA. Next.js + TypeScript + Tailwind, localStorage persistence, free-form labels, sorting and filtering. Deployed to Vercel via Terraform.

All configuration lives in this repo: `next.config.ts`, `vercel.json`, `public/manifest.webmanifest`, `public/sw.js`, and `infra/*.tf`.

## Features

- Create, edit, complete, delete todos (click a title to edit inline).
- Free-form labels per todo, comma/space separated. Autocompletes from previously used labels.
- Filter by clicking label chips. Multi-select acts as AND.
- Sort: newest, oldest, title, open-first.
- Free-text search on titles.
- Installable PWA — works offline, app-shell cached via service worker.

## Local development

```sh
npm install
npm run dev
```

Open http://localhost:3000.

The service worker only registers in production builds. To test PWA install + offline behavior locally:

```sh
npm run build
npm run start
```

## Deploy via Terraform

1. Create a Vercel API token: https://vercel.com/account/tokens
2. Optionally create a GitHub repo and push this project to it.
3. Configure Terraform inputs (either env vars or `infra/terraform.tfvars`):

   ```sh
   cd infra
   cp terraform.tfvars.example terraform.tfvars
   # edit terraform.tfvars
   ```

   Or use env vars:

   ```sh
   export TF_VAR_vercel_api_token="vrcl_..."
   export TF_VAR_github_repo="your-user/simple-todos"
   ```

4. Apply:

   ```sh
   terraform init
   terraform apply
   ```

Terraform creates the Vercel project and (if `github_repo` is set) wires it to the GitHub repo so pushes to `main` trigger production deploys. Optionally attaches a custom domain via `custom_domain`.

State is local by default (`infra/terraform.tfstate`, gitignored). Swap the backend block in `infra/versions.tf` for a remote backend if needed.

## Install on iPhone (the actual PoC)

1. Deploy and open the production URL in **Safari** (Chrome on iOS doesn't trigger Add-to-Home-Screen the same way).
2. Tap the Share icon → **Add to Home Screen** → Add.
3. The app launches standalone (no Safari chrome). Try airplane mode — it should still open and CRUD operations still work because state is in localStorage and the shell is cached.

## Project structure

```
src/
  app/
    layout.tsx        # PWA metadata, theme color, viewport, SW register
    page.tsx          # mounts TodoApp
  components/
    TodoApp.tsx       # CRUD UI, sort, filter, labels
    ServiceWorkerRegister.tsx
  lib/
    todos.ts          # types, pure helpers (sort, filter, dedupe)
    useTodos.ts       # localStorage-backed React hook
public/
  manifest.webmanifest
  sw.js               # offline-first service worker
  icons/*.png         # generated; regenerate via scripts/generate-icons.mjs
scripts/
  generate-icons.mjs  # zero-dep PNG icon generator
infra/
  *.tf                # Vercel project + optional GitHub wiring
vercel.json           # SW + manifest headers, framework preset
```

## Regenerating icons

```sh
node scripts/generate-icons.mjs
```

Tweak colors / shape in `scripts/generate-icons.mjs` and re-run.

## Roadmap

- Phase 2: cross-device sync (Vercel Postgres + auth).
- Background sync of pending mutations once a backend exists.
- Per-label colors and drag-to-reorder.
