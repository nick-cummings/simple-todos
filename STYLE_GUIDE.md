# Simple Todos — Style Guide

The look is **modern, sleek, minimalist**: lots of negative space, low-contrast borders, soft elevation, and motion that feels considered rather than decorative. Tokens are defined in `src/app/globals.css` and surfaced as Tailwind utilities via `@theme inline`.

> **Rule of thumb:** never write a raw hex/zinc/slate color in JSX. Use a semantic token utility (`bg-card`, `text-muted`, `border-line`). If a color isn't covered, add the token here first.

## Tokens

### Colors

All live as CSS variables on `:root` (light) and `.dark`. Switch is class-based on `<html>`.

| Variable          | Tailwind utility                 | Use                                              |
| ----------------- | -------------------------------- | ------------------------------------------------ |
| `--bg`            | `bg-bg`                          | App background                                   |
| `--card`          | `bg-card`                        | Cards, modal body, FAB-less surfaces             |
| `--subtle`        | `bg-subtle`                      | Inputs, chips, hover fills                       |
| `--overlay`       | `bg-overlay`                     | Modal backdrop                                   |
| `--fg`            | `text-fg`                        | Body text                                        |
| `--muted`         | `text-muted`                     | Secondary text, field labels                     |
| `--faint`         | `text-faint`                     | Placeholders, very low emphasis                  |
| `--primary`       | `bg-primary` / `text-primary`    | Primary CTA, FAB, active chip                    |
| `--on-primary`    | `text-on-primary`                | Foreground on `--primary`                        |
| `--danger`        | `text-danger` / `bg-danger`      | Destructive actions, overdue                     |
| `--line`          | `border-line`                    | Default borders                                  |
| `--line-strong`   | `border-line-strong`             | Inputs, emphasized borders                       |
| `--ring`          | `ring-ring`, focus-visible       | Focus ring (handled globally)                    |

### Radius

`rounded-md` (10px), `rounded-lg` (14px), `rounded-xl` (20px), `rounded-2xl` (24px), `rounded-full`. Default: inputs `lg`, cards `xl`, modals `2xl`, chips `full`.

### Shadow

| Utility        | Use                              |
| -------------- | -------------------------------- |
| `shadow-soft`  | Resting cards (very subtle)      |
| `shadow-card`  | Hovered / elevated cards         |
| `shadow-pop`   | Modal dialog, FAB                |

### Typography

- `font-sans` → Geist for everything.
- Sizes: `text-2xl` page title · `text-base` inputs · `text-sm` body · `text-xs` labels · `text-[10px] uppercase tracking-wide` for micro-meta (chips, due date).
- Tight tracking on headings: `tracking-tight`.

## Motion

Motion exists to **explain change**. Short durations, easing that lands gently.

### Tokens

| Var              | Value                                  | Use                                |
| ---------------- | -------------------------------------- | ---------------------------------- |
| `--motion-fast`  | 120ms                                  | Hover / state colour shifts        |
| `--motion-base`  | 200ms                                  | Enters, transforms                 |
| `--motion-slow`  | 320ms                                  | Larger surface transitions         |
| `--ease-smooth`  | `cubic-bezier(0.22, 1, 0.36, 1)`       | Default                            |
| `--ease-spring`  | `cubic-bezier(0.34, 1.56, 0.64, 1)`    | FAB, "pop-in" affordances          |

### Animations

| Utility              | Effect                              | Where                |
| -------------------- | ----------------------------------- | -------------------- |
| `animate-fade-in`    | opacity 0→1                         | Modal backdrop       |
| `animate-pop-in`     | scale + slide with spring easing    | Dialog, FAB          |
| `animate-slide-up`   | translateY(8px) → 0, fade-in        | New items, sections  |
| `animate-chip-in`    | scale(0.85) + fade                  | Label chips on add   |

### Hover / press

- Buttons, chips, list items get `transition-colors` (defined globally on every `<button>`/`<input>`/etc.).
- Press feedback: `active:scale-95` on FAB, `active:scale-[0.98]` on dialog buttons. Use sparingly.

## Components

### Buttons

- **Primary**: `bg-primary text-on-primary` · soft press scale.
- **Ghost**: no background; hover → `bg-subtle`.
- **Danger** (destructive text): `text-danger` only, hover underline.
- All `<button>`s receive `cursor: pointer` via base layer; disabled get `cursor: not-allowed` + `opacity-40`.

### Inputs

- `bg-card`, `border border-line-strong`, `rounded-lg`. Placeholders `text-faint`.
- Focus relies on the global focus-visible ring.

### Chips

- `rounded-full bg-subtle text-muted text-xs`.
- Active state: `bg-primary text-on-primary`.

### Cards (todo items)

- `bg-card border border-line rounded-xl shadow-soft`.
- Hover: `border-line-strong shadow-card -translate-y-px`.
- Overdue badge: `text-danger`.

### Modal

- Backdrop: `bg-overlay backdrop-blur-md animate-fade-in`.
- Dialog: `bg-card rounded-2xl shadow-pop animate-pop-in`. Bottom-sheet on mobile (`items-end`), centered card on `sm+`.
- Closes on Esc, backdrop click, ✕.

## Dark mode

- Three-state: **system** / **light** / **dark** via `<ThemeToggle />` in the header.
- Persisted under `simple-todos:theme`.
- An inline bootstrap script in `<head>` sets the class before paint (no flash).
- "System" listens to `prefers-color-scheme` changes live.
- `color-scheme` on `<html>` keeps native form controls and scrollbars matching.

## Accessibility

- Interactive elements are real `<button>`s with discernable labels (text or `aria-label`).
- Focus-visible rings on every focusable element. Never remove the outline without replacing it.
- Token contrast tuned for WCAG AA against the paired surface.
- Reduced motion: animations / transitions collapse to ~1ms under `@media (prefers-reduced-motion: reduce)`.

## Adding a new component

1. Reach for existing tokens. If a token is missing, add it to `globals.css` and to the table above.
2. Default to the global hover/colour transition — don't fight it with `transition-none`.
3. Make sure interactive elements have `cursor: pointer` (base layer covers `<button>` already; explicit `cursor-pointer` only on `<div>`/`<span>` shims).
4. Run `npm run lint && npm run build` before committing.
