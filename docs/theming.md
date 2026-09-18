# Theming

Everything visual comes from CSS custom properties in `src/index.css`. Change
the tokens, and every screen — marketing page, app shell, task list, niche
module — follows. Nothing in the components hardcodes a colour.

## The palette

Tokens are stored as bare HSL triples (`243 75% 59%`), not finished colours,
so opacity can be added anywhere (`hsl(var(--primary) / 0.1)`). They are
declared twice: `:root` for light, `.dark` for dark.

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `--primary` | brand, buttons, active nav, focus ring | indigo `243 75% 59%` | `245 85% 70%` |
| `--accent` | second half of the brand gradient | violet `262 80% 62%` | `265 85% 72%` |
| `--highlight` | warm spot accent: urgent badge, Pro mark | amber `38 92% 50%` | `38 96% 60%` |
| `--success` / `--warning` / `--destructive` | semantic state, priority badges | — | — |
| `--background` / `--card` / `--popover` | surfaces | — | — |
| `--muted` / `--secondary` | quiet fills | — | — |
| `--border` / `--input` / `--ring` | edges | — | — |
| `--shadow-tint` | hue the elevation shadows are tinted with | — | — |

### Amber is never in the gradient

The brand gradient is `primary → accent` (indigo → violet) and both ends carry
white text at ≥4.5:1. `--highlight` is deliberately excluded from it: white on
amber lands around 2:1, so every label on the warm end of such a gradient would
be unreadable. Amber is used as a solid fill with `--highlight-foreground`
(near-black) on top, or as a low-opacity wash behind coloured text.

### Swapping the palette

Change the `:root` and `.dark` blocks — that is the whole job. Two extra places
read colour and cannot use tokens; both are commented in place:

- `src/pages/TasksPage.tsx` — `canvas-confetti` parses colours with `hexToRgb`,
  so it only accepts hex literals. Any other format degrades silently.
- `src/lib/categories.ts` — the category swatches are **data**, not theme. They
  are written into the database (`color` is constrained to `#rrggbb`) and must
  stay stable across theme changes, otherwise existing rows would disagree with
  new ones.

The animated background (`src/components/ui/InteractiveBackground.tsx`) reads
`--primary`, `--accent` and `--highlight` from computed style at runtime and
re-reads them when the `dark` class on `<html>` changes, so it follows the
theme on its own.

## Surfaces

`--radius` (0.625rem) is the single root of the radius scale; `--radius-sm`
through `--radius-3xl` are derived from it in the `@theme` block. `rounded-xl`
and `rounded-2xl` are redefined there on purpose — Tailwind ships fixed values
for those two, so leaving them out would split the scale in half the moment
`--radius` changes.

Elevation is `--shadow-e1` / `e2` / `e3`, tinted with `--shadow-tint` rather
than pure black: a neutral shadow reads as grey dirt on the near-white light
background. `--shadow-glow-sm/md/lg` derive from `--primary` and are for
brand emphasis, not for depth.

## Typography

Two families, both self-hosted from `public/fonts/`:

- **Inter Variable** — body and UI (`--font-sans`)
- **Plus Jakarta Sans Variable** — `h1`–`h3` and the wordmark (`--font-display`)

Only the `latin` and `latin-ext` subsets ship. Turkish needs both: `ı` is in
latin, `ğ ş İ` are in latin-ext. The other subsets would roughly triple the
precache with glyphs the UI never renders.

> **Do not add a Google Fonts `<link>` back to `index.html`.** The app is an
> offline-capable PWA, and `e2e/landing.spec.ts` asserts the marketing page
> makes no request outside localhost. Fonts are in the service worker precache
> (`globPatterns` includes `woff2` in `vite.config.ts`), so they survive
> offline.

## The one rule when writing components

Never write a Tailwind palette class (`bg-emerald-500`, `text-red-600`,
`from-cyan-500`). Use the semantic token (`bg-success`, `text-destructive`,
`from-primary`). A palette class is invisible until someone re-themes and finds
one screen still wearing the old brand — which is exactly what happened to the
stats cards, the priority badges and the landing feature cards before this doc
existed. To check:

```bash
grep -rnE '\b(bg|text|border|from|to|via|ring|shadow)-(slate|gray|red|amber|emerald|teal|cyan|blue|indigo|violet|rose|white|black)(-[0-9]{2,3})?\b' src --include='*.tsx'
```

It should print nothing.
