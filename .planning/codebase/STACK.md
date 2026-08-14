# Technology Stack

**Analysis Date:** 2026-08-14

## Languages

**Primary:**
- TypeScript ~5.9.3 — all application code under `src/`, config files (`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`), E2E specs in `e2e/`
- TSX/JSX (`react-jsx`) — components in `src/components/`, pages in `src/pages/`

**Secondary:**
- SQL (PostgreSQL) — migrations in `supabase/migrations/20260812120000_init_schema.sql`, `supabase/migrations/20260813120000_categories.sql`
- JavaScript (ESM `.mjs`) — build helper `scripts/clean-dist.mjs`, schema security tests `supabase/tests/rls.test.mjs`
- JSON — translation catalogs in `src/i18n/locales/` (imported via `resolveJsonModule`)
- CSS — `src/index.css` (Tailwind v4 entrypoint)

## Runtime

**Environment:**
- Browser (SPA, ES2023 target per `tsconfig.app.json`)
- Node.js 22 for tooling and CI (`.github/workflows/ci.yml` uses `actions/setup-node@v5` with `node-version: '22'`)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)
- CI installs with `npm ci --legacy-peer-deps` (`.github/workflows/ci.yml`)

## Frameworks

**Core:**
- React 19.2 (`react`, `react-dom`) — UI layer, entry `src/main.tsx`
- React Router DOM 7.18 — routing, defined in `src/router.tsx`
- Zustand 5.0 — primary state store with `persist` middleware, `src/store/index.ts` (line 86) and `src/store/ui.ts`
- Tailwind CSS 4.2 via `@tailwindcss/vite` — styling, no `tailwind.config` file (v4 CSS-first config in `src/index.css`)
- Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`) — accessible modals under `src/components/ui/`
- react-i18next 17 + i18next 26 + `i18next-browser-languagedetector` — `src/i18n/index.ts`, typed keys via `src/i18n/i18next.d.ts`

**Testing:**
- Vitest 4.1 — unit tests, config `vitest.config.ts`, setup `src/test-setup.ts`, jsdom 29 environment
- Playwright 1.62 (`@playwright/test`) — E2E, config `playwright.config.ts`, specs in `e2e/`
- Plain Node test script — schema/RLS security suite `supabase/tests/rls.test.mjs`

**Build/Dev:**
- Vite 8 (`vite.config.ts`) with `@vitejs/plugin-react` 6
- `vite-plugin-pwa` 1.2 — service worker (`registerType: 'autoUpdate'`), Workbox precache with `globIgnores: ['**/sentry-*.js']`
- `scripts/clean-dist.mjs` — runs as `prebuild`; Vite's `emptyOutDir` silently fails on the OneDrive path
- ESLint 9 flat config (`eslint.config.js`) + `typescript-eslint` 8, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- PostCSS 8 + autoprefixer
- `sharp` 0.35 — icon generation tooling in `scripts/`
- Supabase CLI 2.110 (dev dependency) — local stack and `npm run db:types`

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.111 — auth + Postgres access; client created in `src/lib/supabase.ts` and is `null` when unconfigured (local-first)
- `zustand` ^5.0.12 — source of truth for tasks/categories; sync sits on top
- `react-router-dom` ^7.18.2 — routes plus per-route `errorElement`s
- `@sentry/react` ^10.70 — loaded only via dynamic `import()` in `src/lib/monitoring.ts`; split into a named `sentry` chunk by `manualChunks` in `vite.config.ts`

**Infrastructure:**
- `date-fns` ^4.1 — date formatting/locales
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop reordering in `src/components/TaskList.tsx`
- `framer-motion` ^12.37 — animations
- `sonner` ^2.0.7 — toast notifications
- `lucide-react` ^0.577 — icon set
- `clsx` + `tailwind-merge` — class composition helper in `src/lib/utils.ts`
- `canvas-confetti` ^1.9.4 — completion feedback

## Configuration

**Environment:**
- Vite `import.meta.env`, typed in `src/vite-env.d.ts`
- `.env.example` documents the variables; `.env.local` holds local values (never read/committed)
- Recognized variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_GITHUB`, `VITE_SENTRY_DSN`
- Feature flags centralized in `src/config/features.ts`; `isEnabled()` accepts only the literal string `"true"`
- All optional: with no variables set the app runs fully local-first (LocalStorage only)

**Build:**
- `vite.config.ts` — alias `@` → `./src`, `__SENTRY_DEBUG__`/`__SENTRY_TRACING__` defined as `false`, PWA manifest
- `tsconfig.json` (project references) → `tsconfig.app.json` (app, strict + `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`, path alias `@/*`) and `tsconfig.node.json`
- `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`
- `supabase/config.toml` — local stack (API port 54321, DB port 54322, auth redirect allowlist)

## Platform Requirements

**Development:**
- Node.js 22, npm
- Docker + Supabase CLI for `npx supabase start` (needed for `npm run test:rls` and E2E integration job)
- Playwright browsers (locale pinned to `tr-TR` in `playwright.config.ts`)

**Production:**
- Static SPA hosting. Vercel rewrite config in `vercel.json`; Netlify-style fallback in `public/_redirects`
- Supabase (hosted Postgres + Auth) for optional sync
- Service worker/PWA served over HTTPS

---

*Stack analysis: 2026-08-14*
