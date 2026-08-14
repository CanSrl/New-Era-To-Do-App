# Codebase Structure

**Analysis Date:** 2026-08-14

## Directory Layout

```
yapilacaklar-listesi/
├── src/
│   ├── main.tsx              # Bootstrap: i18n, monitoring, providers, router
│   ├── router.tsx            # Route table
│   ├── index.css             # Tailwind v4 entry + design tokens
│   ├── test-setup.ts         # Vitest setup (pins language to tr)
│   ├── vite-env.d.ts         # Vite/env type declarations
│   ├── assets/               # Static imports used by components
│   ├── components/           # Feature components + providers
│   │   └── ui/               # Radix primitives wrappers (dialog, alert-dialog)
│   ├── config/               # Build-time feature flags
│   ├── i18n/                 # i18next setup, typed keys
│   │   └── locales/          # tr.json, en.json
│   ├── lib/                  # Domain logic, sync, data access, types
│   ├── pages/                # Route-level components
│   └── store/                # Zustand stores
├── supabase/
│   ├── config.toml           # Local stack config incl. redirect allowlist
│   ├── migrations/           # Schema + RLS (timestamped .sql)
│   ├── tests/                # rls.test.mjs — schema security tests
│   └── snippets/             # (empty)
├── e2e/                      # Playwright specs (Turkish filenames) + helpers.ts
├── scripts/                  # clean-dist.mjs, generate-pwa-icons.mjs
├── public/                   # PWA icons, favicon, _redirects
├── docs/                     # Documentation
├── .planning/codebase/       # GSD codebase map
├── .github/workflows/ci.yml  # CI: quality + integration jobs
├── vite.config.ts            # Alias, PWA, Sentry chunking
├── vitest.config.ts          # Unit test config (jsdom)
├── playwright.config.ts      # E2E config (locale pinned to tr-TR)
├── eslint.config.js
├── tsconfig.json / .app.json / .node.json
├── vercel.json               # SPA rewrite
└── CLAUDE.md                 # Living project plan
```

## Directory Purposes

**`src/components/`:**
- Purpose: All React components except route-level pages
- Contains: Feature components (`TaskList`, `TaskItem`, `TaskForm`, `FilterBar`, `CategoryManager`, `StatsDashboard`), providers (`ThemeProvider`, `AuthProvider`, `SyncProvider`, `ErrorBoundary`), chrome (`AppLayout`, `AccountMenu`, `SyncIndicator`, `LanguageSwitcher`, `AuthDialog`)
- Key files: `src/components/AppLayout.tsx`, `src/components/SyncProvider.tsx`

**`src/components/ui/`:**
- Purpose: Thin, reusable Radix wrappers shared by feature components
- Key files: `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`

**`src/pages/`:**
- Purpose: One component per route
- Key files: `src/pages/TasksPage.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/ResetPasswordPage.tsx`, `src/pages/AuthCallbackPage.tsx`, `src/pages/NotFoundPage.tsx`, `src/pages/CrashTestPage.tsx` (dev only)

**`src/store/`:**
- Purpose: Application state
- Key files: `src/store/index.ts` (persisted domain + sync bookkeeping), `src/store/ui.ts` (ephemeral dialog state)

**`src/lib/`:**
- Purpose: Everything non-React — types, pure logic, sync, data access
- Key files: `src/lib/types.ts`, `src/lib/sync.ts`, `src/lib/sync-merge.ts`, `src/lib/task-repository.ts`, `src/lib/task-mapping.ts`, `src/lib/category-mapping.ts`, `src/lib/supabase.ts`, `src/lib/database.types.ts` (generated), `src/lib/tasks.ts`, `src/lib/categories.ts`, `src/lib/auth-errors.ts`, `src/lib/auth-callback.ts`, `src/lib/monitoring.ts`, `src/lib/utils.ts`

**`src/i18n/`:**
- Purpose: Translation setup and type safety
- Key files: `src/i18n/index.ts`, `src/i18n/i18next.d.ts` (types derived from `tr.json`), `src/i18n/locales/tr.json`, `src/i18n/locales/en.json`

**`src/config/`:**
- Purpose: Build-time flags read from `import.meta.env`
- Key files: `src/config/features.ts`

**`supabase/migrations/`:**
- Purpose: Forward-only schema history
- Key files: `supabase/migrations/20260812120000_init_schema.sql`, `supabase/migrations/20260813120000_categories.sql`

**`e2e/`:**
- Purpose: Playwright end-to-end specs, including two-browser-context sync scenarios
- Key files: `e2e/helpers.ts`, `e2e/senkron.spec.ts`, `e2e/gorevler.spec.ts`, `e2e/kategoriler.spec.ts`, `e2e/auth.spec.ts`, `e2e/hata-siniri.spec.ts`

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell, meta/OG tags
- `src/main.tsx`: React bootstrap and provider tree
- `src/router.tsx`: Route definitions

**Configuration:**
- `vite.config.ts`: Alias `@` → `src`, PWA manifest/workbox, Sentry chunking
- `vitest.config.ts`, `playwright.config.ts`: Test runners
- `tsconfig.app.json`: Strict compiler settings (`strict`, `noUnusedLocals`)
- `.env.example`: Documented environment variables (never read `.env.local`)
- `supabase/config.toml`: Local stack, `additional_redirect_urls`
- `vercel.json`, `public/_redirects`: SPA fallback

**Core Logic:**
- `src/store/index.ts`: Source of truth for tasks and categories
- `src/lib/sync.ts`: Sync orchestration
- `src/lib/sync-merge.ts`: Pure conflict resolution
- `src/lib/task-repository.ts`: Supabase data access

**Testing:**
- Unit: co-located `src/**/*.test.ts` (e.g. `src/lib/sync-merge.test.ts`, `src/store/index.test.ts`)
- E2E: `e2e/*.spec.ts`
- Schema security: `supabase/tests/rls.test.mjs`

## Naming Conventions

**Files:**
- React components: PascalCase `.tsx` — `TaskItem.tsx`, `SyncProvider.tsx`
- Non-React modules: kebab-case `.ts` — `sync-merge.ts`, `task-repository.ts`, `auth-errors.ts`
- Unit tests: sibling `<name>.test.ts` — `src/lib/tasks.test.ts`
- E2E specs: Turkish, kebab/lowercase `.spec.ts` — `e2e/hata-siniri.spec.ts`
- Migrations: `YYYYMMDDHHMMSS_snake_case.sql`
- Node scripts: kebab-case `.mjs` — `scripts/clean-dist.mjs`

**Directories:**
- Lowercase, single word — `components`, `store`, `lib`, `pages`, `config`, `i18n`, `locales`

**Route paths:**
- English and lowercase (`/app/settings`) even though the UI ships in Turkish, because the starter kit is sold internationally.

## Where to Add New Code

**New Feature (planned niche module — clients/projects/time logs):**
- Feature code: `src/features/{clients,projects,timeLogs}/` (new tree, per CLAUDE.md)
- Flag: add an entry to `src/config/features.ts` so the whole module can be removed in one line
- Schema: new timestamped file in `supabase/migrations/` with full RLS **and** GRANTs
- RLS coverage: extend `supabase/tests/rls.test.mjs`

**New Component:**
- Feature component: `src/components/<Name>.tsx`
- Reusable primitive: `src/components/ui/<name>.tsx`

**New Route:**
- Page component: `src/pages/<Name>Page.tsx`
- Register in `src/router.tsx` with an `errorElement`

**New State:**
- Persisted/synced domain data: extend `src/store/index.ts` (also add dirty ids + tombstones + `pendingCount` wiring in `src/components/SyncProvider.tsx`)
- Transient UI state: `src/store/ui.ts`

**New Data Access:**
- Query/mutation functions: `src/lib/<entity>-repository.ts`
- Row mapping: `src/lib/<entity>-mapping.ts`
- Regenerate types with `npm run db:types` (writes `src/lib/database.types.ts`)

**New User-Facing Text:**
- Add the key to `src/i18n/locales/tr.json` **and** `src/i18n/locales/en.json`; `src/i18n/i18n.test.ts` fails on drift

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (`cn` class merging) or a focused `src/lib/<topic>.ts`

**Tests:**
- Unit: alongside the module as `<module>.test.ts`
- E2E: `e2e/<konu>.spec.ts`

## Special Directories

**`dist/`:**
- Purpose: Production build output
- Generated: Yes (cleaned by `scripts/clean-dist.mjs`, not by Vite's `emptyOutDir`)
- Committed: No

**`src/lib/database.types.ts`:**
- Purpose: Supabase-generated database types
- Generated: Yes (`npm run db:types`)
- Committed: Yes — edit the schema, not this file

**`test-results/`:**
- Purpose: Playwright artifacts
- Generated: Yes / Committed: No

**`.planning/`:**
- Purpose: GSD planning and codebase map
- Generated: By GSD commands / Committed: Yes

**`public/`:**
- Purpose: Copied verbatim into the build (PWA icons, `_redirects`)
- Generated: Icons come from `scripts/generate-pwa-icons.mjs` / Committed: Yes

---

*Structure analysis: 2026-08-14*
