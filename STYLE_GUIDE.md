# Simple Todos — Style Guide

The look is **considered minimalism**: lots of negative space, semantic color used sparingly but with intent, real typographic hierarchy, and motion that explains change rather than decorating it. The palette is built around a cool deep-slate base and a single warm amber accent — every other "color" in the UI is a low-opacity semantic tint (priority, tag category, status), never a decorative choice.

Tokens are defined in `src/app/globals.css` and surfaced as Tailwind utilities via `@theme inline`.

> **Rule of thumb:** never write a raw hex/zinc/slate color in JSX. Use a semantic token utility (`bg-card`, `text-muted`, `border-line`, `text-primary`). If a color isn't covered, add the token here first.

> **Second rule of thumb:** color encodes meaning. Don't reach for the amber accent to make something "pop" — reach for it because the element is the primary CTA, the active state, or the system's focal point. If everything's accented, nothing is.

## Tokens

### Colors

All live as CSS variables on `:root` (light) and `.dark`. Switch is class-based on `<html>`. Values below are the dark-mode reference; light-mode counterparts mirror them with appropriate contrast inversions.

#### Surfaces

| Variable         | Tailwind utility  | Dark value               | Use                                          |
| ---------------- | ----------------- | ------------------------ | -------------------------------------------- |
| `--bg`           | `bg-bg`           | `#0B0C10`                | App background                               |
| `--card`         | `bg-card`         | `#14161C`                | Resting cards, inputs, modal body            |
| `--card-hover`   | `bg-card-hover`   | `#1A1D26`                | Hovered cards, focused inputs                |
| `--subtle`       | `bg-subtle`       | `rgba(255,255,255,0.04)` | Chips, ghost-button hover, theme-toggle pill |
| `--subtle-hover` | `bg-subtle-hover` | `rgba(255,255,255,0.07)` | Chip hover                                   |
| `--overlay`      | `bg-overlay`      | `rgba(0,0,0,0.65)`       | Modal backdrop                               |

The body also carries a single very-faint radial gradient from the top using `--primary-glow` — see Accent, below. This is the only gradient in the system.

#### Text

| Variable  | Tailwind utility | Dark value | Use                                        |
| --------- | ---------------- | ---------- | ------------------------------------------ |
| `--fg`    | `text-fg`        | `#ECEDEE`  | Body text, card titles                     |
| `--muted` | `text-muted`     | `#9CA3AE`  | Descriptions, field labels, secondary info |
| `--faint` | `text-faint`     | `#6B7280`  | Placeholders, metadata, section dividers   |

#### Lines

| Variable          | Tailwind utility       | Dark value               | Use                                 |
| ----------------- | ---------------------- | ------------------------ | ----------------------------------- |
| `--line`          | `border-line`          | `rgba(255,255,255,0.06)` | Default borders, resting card edges |
| `--line-strong`   | `border-line-strong`   | `rgba(255,255,255,0.12)` | Inputs, hovered cards, sort button  |
| `--line-emphasis` | `border-line-emphasis` | `rgba(255,255,255,0.20)` | Checkbox ring, focused inputs       |

#### Accent (warm amber)

The single chromatic identity of the app. Use **only** for: primary CTA, FAB, active filter chip, focus ring, medium-priority indicator, the small status dot in the header, and the subtle page-top glow.

| Variable              | Tailwind utility          | Value                    | Use                                       |
| --------------------- | ------------------------- | ------------------------ | ----------------------------------------- |
| `--primary`           | `bg-primary text-primary` | `#F5A66B`                | FAB, active chip text/border, glyphs      |
| `--primary-hover`     | `bg-primary-hover`        | `#F8B987`                | FAB hover, button hover                   |
| `--on-primary`        | `text-on-primary`         | `#1A0E03`                | Foreground on filled `--primary` surfaces |
| `--primary-bg`        | `bg-primary-bg`           | `rgba(245,166,107,0.10)` | Active chip fill, checkbox-hover fill     |
| `--primary-bg-strong` | `bg-primary-bg-strong`    | `rgba(245,166,107,0.18)` | Pressed states                            |
| `--primary-border`    | `border-primary-border`   | `rgba(245,166,107,0.22)` | Active chip border                        |
| `--primary-glow`      | (used in body bg)         | `rgba(245,166,107,0.04)` | Page-top radial gradient — set-and-forget |
| `--ring`              | `ring-ring`               | `rgba(245,166,107,0.45)` | Focus ring (handled globally)             |

#### Status

| Variable      | Tailwind utility            | Value                    | Use                                         |
| ------------- | --------------------------- | ------------------------ | ------------------------------------------- |
| `--danger`    | `text-danger` / `bg-danger` | `#F87171`                | Destructive actions, overdue, high priority |
| `--danger-bg` | `bg-danger-bg`              | `rgba(248,113,113,0.10)` | Destructive button hover                    |
| `--success`   | `text-success`              | `#4ADE80`                | Completed-this-week stat, success toasts    |

#### Semantic tag colors

Each tag category gets a dedicated low-opacity background + matching saturated foreground. Pills are **never** generic gray — the color is the whole point. Add new tag categories here, don't improvise.

| Tag          | Tailwind utility group | FG / BG                               |
| ------------ | ---------------------- | ------------------------------------- |
| bill         | `tag-bill`             | `#F87171` on `rgba(248,113,113,0.10)` |
| dinner       | `tag-dinner`           | `#FB923C` on `rgba(251,146,60,0.10)`  |
| judith       | `tag-judith`           | `#F472B6` on `rgba(244,114,182,0.10)` |
| subscription | `tag-subscription`     | `#60A5FA` on `rgba(96,165,250,0.10)`  |

Unknown tags fall back to `bg-subtle text-muted`. New tag types added to the data model **must** add a token row here; do not let unknown tags ship as gray.

### Radius

`rounded-sm` (6px), `rounded-md` (10px), `rounded-lg` (14px), `rounded-xl` (20px), `rounded-2xl` (24px), `rounded-full`.

Vary radius by element to create implicit hierarchy — don't make everything the same size:

| Element                           | Radius         |
| --------------------------------- | -------------- |
| Tag pill, chip, FAB, theme toggle | `rounded-full` |
| Input, sort button, search bar    | `rounded-lg`   |
| Todo card                         | `rounded-xl`   |
| Modal dialog                      | `rounded-2xl`  |
| Kbd hint, small icon button       | `rounded-sm`   |

### Shadow

| Utility       | Use                                                           |
| ------------- | ------------------------------------------------------------- |
| `shadow-soft` | Resting cards (very subtle)                                   |
| `shadow-card` | Hovered / elevated cards                                      |
| `shadow-pop`  | Modal dialog                                                  |
| `shadow-fab`  | FAB — layered: inner ring + accent-tinted drop + neutral drop |

`shadow-fab` is the only place we use a colored shadow; it ties the FAB visually to the accent.

### Typography

- `font-sans` → Geist for everything. `font-mono` → Geist Mono for tags, kbd hints, and metadata where tabular feel helps.
- Stylistic sets: `font-feature-settings: "ss01", "cv11"` applied at body root for Geist's preferred glyph variants.
- Size & weight scale, with letter-spacing baked in:

| Use                                    | Class chain                                                        |
| -------------------------------------- | ------------------------------------------------------------------ |
| Page title                             | `text-5xl font-semibold tracking-[-0.045em]`                       |
| Card title                             | `text-[15px] font-medium tracking-[-0.005em]`                      |
| Body text / inputs                     | `text-sm`                                                          |
| Description / muted                    | `text-[13px] leading-[1.55]`                                       |
| Metadata, kbd                          | `text-[11px] font-medium`                                          |
| Section header (UPPERCASE — only here) | `text-[10px] font-semibold uppercase tracking-[0.14em] text-faint` |
| Tag pill text                          | `text-[10px] font-semibold tracking-[0.04em] font-mono`            |

Tight tracking on display sizes is non-negotiable — Geist gets airy fast at large weights without it.

## Motion

Motion exists to **explain change**. Short durations, easing that lands gently.

### Tokens

| Var             | Value                               | Use                                 |
| --------------- | ----------------------------------- | ----------------------------------- |
| `--motion-fast` | 120ms                               | Hover / state colour shifts         |
| `--motion-base` | 200ms                               | Enters, transforms, card hover lift |
| `--motion-slow` | 320ms                               | Larger surface transitions          |
| `--ease-smooth` | `cubic-bezier(0.22, 1, 0.36, 1)`    | Default                             |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | FAB, "pop-in" affordances           |

### Animations

| Utility            | Effect                           | Where                |
| ------------------ | -------------------------------- | -------------------- |
| `animate-fade-in`  | opacity 0→1                      | Modal backdrop       |
| `animate-pop-in`   | scale + slide with spring easing | Dialog, FAB on mount |
| `animate-slide-up` | translateY(8px) → 0, fade-in     | New items, sections  |
| `animate-chip-in`  | scale(0.85) + fade               | Label chips on add   |
| `animate-check`    | scale(0.6) → 1 + spring          | Checkbox tick        |

### Hover / press

- Buttons, chips, list items, cards get `transition-all` with `--motion-fast` or `--motion-base` (cards) on `--ease-smooth`.
- Card hover lifts `-translate-y-px` and shifts to `bg-card-hover` + `border-line-strong`. This is the canonical "hover affordance" pattern — every interactive surface should do _something_ on hover.
- Press feedback: `active:scale-95` on FAB, `active:scale-[0.98]` on dialog buttons. Use sparingly.

## Components

### Buttons

- **Primary**: `bg-primary text-on-primary hover:bg-primary-hover` · subtle press scale.
- **Ghost**: transparent; hover → `bg-subtle`.
- **Sort / dropdown trigger**: `bg-card border border-line-strong hover:border-line-emphasis hover:bg-card-hover` — looks like an input until interacted with, by design.
- **Danger** (destructive text): `text-danger hover:bg-danger-bg`.
- All `<button>`s receive `cursor: pointer` via base layer; disabled get `cursor: not-allowed opacity-40`.

### Inputs

- `bg-card`, `border border-line-strong`, `rounded-lg`, height 44px.
- Placeholders use `text-faint`.
- Focus relies on the global focus-visible ring (`ring-3 ring-ring border-line-emphasis`).
- Search input includes a leading magnifier icon (Lucide `Search`, 14px, `text-faint`) and a trailing `<kbd>⌘K</kbd>`. Kbd: `bg-subtle border border-line rounded-sm text-faint text-[11px] font-mono px-1.5 py-0.5`.

### Filter chips

- `rounded-full bg-subtle border border-line text-muted text-[13px] font-medium px-3 py-1.5`.
- Hover → `bg-subtle-hover text-fg`.
- **Active** → `bg-primary-bg text-primary border-primary-border`.
- Optional leading `swatch` (6px dot) showing the tag's semantic color, for category chips.
- Optional trailing `count` in `text-[11px] text-faint font-variant-numeric: tabular-nums` (active state uses `text-primary opacity-75`).

### Tag pills

- `inline-flex items-center rounded-full px-2 py-[3px] font-mono text-[10px] font-semibold tracking-[0.04em] lowercase`.
- Color comes from the `tag-{name}` utility (see Semantic tag colors).
- Pseudo-element `::before` adds a `#` glyph at 55% opacity — keep this consistent so tags are visually unambiguous everywhere.
- Width is content-driven; never pad past 8px horizontal.

### Cards (todo items)

- `flex gap-3.5 bg-card border border-line rounded-xl px-[18px] py-4 pl-5 mb-2`.
- Relative-positioned with `overflow-hidden` to clip the priority bar.
- **Priority indicator** (left edge, 3px wide, inset 14px vertically):
    - High → `--danger`
    - Medium → `--primary` (the accent — medium is "you care, but it's not on fire")
    - Low → `--line-strong` (neutral, present but de-emphasized)
- Hover: `border-line-strong bg-card-hover -translate-y-px`.
- Completed state: `opacity-60` on the whole card, `line-through` on title, checkbox shows filled.

#### Card body layout

1. Checkbox (20px, 1.5px ring, `mt-0.5`) — see below.
2. Title row (`text-[15px] font-medium tracking-[-0.005em] mb-1`).
3. Optional description row (`text-[13px] text-muted leading-[1.55] mb-3`). Cards without a description skip this entirely — don't reserve space.
4. Tag row (`flex gap-1.5 flex-wrap`).
5. Metadata row (see below).

### Checkbox

- 20px circle, `border-1.5 border-line-emphasis rounded-full`.
- Hover → `border-primary bg-primary-bg`.
- Checked → `bg-primary border-primary` with a 12px `Check` icon in `text-on-primary`.
- Use the `animate-check` spring on the icon when transitioning to checked.

### Metadata row

A horizontal row at the bottom of a card, `text-[11px] font-medium text-faint`, gap-3.5, with small (12px) leading icons. Each item is `inline-flex items-center gap-1.5`.

Color variants:

- Default → `text-faint` (e.g. "5d ago", "Created Mon")
- Due soon (≤3 days) → `text-primary`
- Overdue → `text-danger`

Common items: due date (calendar icon), created time (clock icon), assignee (avatar), comment count (bubble icon). Keep to 2–3 items per card; the row should never wrap.

### Section headers

Between groups of todos ("This week", "Later", "Done"). `text-[10px] font-semibold uppercase tracking-[0.14em] text-faint` followed by a `flex-1 h-px bg-line` divider. The only place we use uppercase.

### Header stat

The "4 open · 12 completed this week" subtitle under the page title. `text-[13px] text-muted` with a 6px `--primary` dot leading the line, ringed by a 4px `--primary-bg` halo (`box-shadow: 0 0 0 4px`). Counts separated by `text-faint` middot.

### Theme toggle

A 3-state segmented pill in the top-right of the header. Outer pill: `bg-subtle border border-line rounded-full p-1 gap-0.5`. Each button: 32px round, ghost. Active button: `bg-card-hover text-fg` with `box-shadow: 0 0 0 1px var(--line-strong)` — the inner ring is what makes it read as "selected" without needing a fill color.

Persisted under `simple-todos:theme`. System mode listens to `prefers-color-scheme` live. Inline bootstrap script in `<head>` sets the class before paint (no flash).

### FAB

Bottom-right, `fixed bottom-8 right-8`. 52px round, `bg-primary text-on-primary`, with `shadow-fab` (layered: 1px accent-tinted ring + accent drop + neutral drop). `+` icon at 22px, 2.5 stroke.

- Hover: `bg-primary-hover -translate-y-0.5`.
- Press: `scale-95`.
- Mount: `animate-pop-in` with spring easing.
- Position right edge aligns to the content column on wide viewports (`right: max(2rem, calc((100vw - 760px)/2 + 2rem))`).
- Keyboard shortcut "N" opens the new-todo modal; surface this in the `title`/tooltip.

### Modal

- Backdrop: `bg-overlay backdrop-blur-md animate-fade-in`.
- Dialog: `bg-card rounded-2xl shadow-pop animate-pop-in`. Bottom-sheet on mobile (`items-end`), centered card on `sm+`.
- Closes on Esc, backdrop click, ✕.

### Empty state

When a filter returns zero results or the list is empty: centered column, `py-16 text-center`. A 32px outline icon (`ClipboardList` or `Inbox`) in `text-faint` over a `bg-subtle rounded-full p-4`. Heading `text-base font-medium text-fg`, sub `text-[13px] text-muted mt-1 max-w-xs mx-auto`. Optional primary CTA below, `mt-5`.

Never show a literal "No results" — always pair with a suggestion ("Try clearing filters" / "Add your first todo").

## Dark mode

- Three-state: **system** / **light** / **dark** via `<ThemeToggle />` in the header.
- Persisted under `simple-todos:theme`.
- An inline bootstrap script in `<head>` sets the class before paint (no flash).
- "System" listens to `prefers-color-scheme` changes live.
- `color-scheme` on `<html>` keeps native form controls and scrollbars matching.

## Accessibility

- Interactive elements are real `<button>`s with discernable labels (text or `aria-label`).
- Focus-visible rings on every focusable element. Never remove the outline without replacing it.
- Token contrast tuned for WCAG AA against the paired surface in both modes. Tag pill foregrounds verified against their tinted backgrounds.
- Reduced motion: animations / transitions collapse to ~1ms under `@media (prefers-reduced-motion: reduce)`.
- Priority indicators carry meaning via color — duplicate that signal in `aria-label` (e.g. `aria-label="High priority"`) and surface "Overdue" / due date as text, not color alone.

## Adding a new component

1. Reach for existing tokens. If a token is missing, add it to `globals.css` and to the table above.
2. Pick the right radius for the element type (see Radius). Don't default to `rounded-xl` for everything.
3. Default to the global hover/colour transition — don't fight it with `transition-none`.
4. Ensure interactive elements have `cursor: pointer` (base layer covers `<button>` already; explicit `cursor-pointer` only on `<div>`/`<span>` shims).
5. If the component introduces color, decide first whether the color is **semantic** (status, category, priority) or **decorative** (don't). If decorative, remove it.
6. Run `npm run lint && npm run build` before committing.
