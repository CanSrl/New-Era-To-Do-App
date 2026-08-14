# External Integrations

**Analysis Date:** 2026-08-14

## APIs & External Services

**Backend-as-a-Service:**
- Supabase — Postgres data API + Auth, the only backend dependency
  - SDK/Client: `@supabase/supabase-js` ^2.111, instantiated in `src/lib/supabase.ts`
  - Auth: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Optional by design: `isSupabaseConfigured` is `false` without both vars and the client is `null`; every caller must null-check

**Error Tracking:**
- Sentry — optional, off by default
  - SDK/Client: `@sentry/react` ^10.70, wrapped by `src/lib/monitoring.ts`
  - Auth: `VITE_SENTRY_DSN`
  - Loaded with dynamic `import()` only when a DSN exists; `tracesSampleRate: 0`, `sendDefaultPii: false`, plus a `scrub()` beforeSend that strips `event.user` and `request.cookies`

**Identity Provider:**
- GitHub OAuth — via Supabase, off by default behind `features.githubAuth` (`src/config/features.ts`)
  - Auth: `VITE_AUTH_GITHUB` on the client; provider secrets configured server-side in Supabase (`supabase/config.toml` around line 349 for local)

## Data Storage

**Databases:**
- PostgreSQL (Supabase)
  - Connection: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  - Client: `supabase-js` PostgREST query builder; generated types in `src/lib/database.types.ts` (`npm run db:types`)
  - Tables: `profiles`, `categories`, `tasks` — `supabase/migrations/20260812120000_init_schema.sql`, `supabase/migrations/20260813120000_categories.sql`
  - Access layers: `src/lib/task-repository.ts`, `src/lib/tasks.ts`, `src/lib/categories.ts`
  - Security: full RLS for `authenticated` only, no `anon` grants; verified by `supabase/tests/rls.test.mjs`

**Local Storage (primary store):**
- Browser LocalStorage via Zustand `persist` (`src/store/index.ts`)
  - Holds tasks, categories, `ownerId`, dirty ids and deletion tombstones
  - Additional keys: `yapilacaklar-auth` (Supabase session, `storageKey` in `src/lib/supabase.ts`), `yapilacaklar-language` (i18n choice, `src/i18n/index.ts`), theme key in `src/components/ThemeProvider.tsx`

**File Storage:**
- Not used. Supabase Storage is not integrated.

**Caching:**
- Workbox service worker precache via `vite-plugin-pwa` (`vite.config.ts`); the `sentry-*.js` chunk is excluded from precache. No server-side cache.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: `src/components/AuthProvider.tsx` (session state, sign in/up/out, OAuth, password reset), UI in `src/components/AuthDialog.tsx` and `src/components/AccountMenu.tsx`
  - Flow: PKCE, `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`
  - Methods: email/password; GitHub OAuth via `signInWithOAuth` (`AuthProvider.tsx:116`) gated by the feature flag
  - Password reset target: `${window.location.origin}/reset-password` (`AuthProvider.tsx:136`); handled by `src/pages/ResetPasswordPage.tsx`
  - `profiles` rows are created automatically by an `auth.users` trigger
  - Errors are mapped to translation keys in `src/lib/auth-errors.ts`, never to literal strings
  - No route guards: `/app/*` is public because the app is local-first

## Monitoring & Observability

**Error Tracking:**
- Sentry, disabled unless `VITE_SENTRY_DSN` is set. Single wrapper `src/lib/monitoring.ts` exposing `initMonitoring()`, `captureError()`, `isMonitoringConfigured`.

**Logs:**
- `console.error` fallback inside `captureError()` — errors are never silently swallowed.
- Error boundaries: root `src/components/ErrorBoundary.tsx` outside the providers, plus per-route `errorElement`s in `src/router.tsx`. `/app/__crash` (`src/pages/CrashTestPage.tsx`) is registered in dev builds only.

## CI/CD & Deployment

**Hosting:**
- Static SPA. `vercel.json` rewrites non-asset paths to `/index.html`; `public/_redirects` provides the Netlify equivalent.
- Host must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for sync (README).

**CI Pipeline:**
- GitHub Actions, `.github/workflows/ci.yml`, on push to `main`, all PRs and manual dispatch; concurrency-cancels stale runs
  - Job `kalite`: `npm run lint`, `npx tsc -b --noEmit`, `npm test`, `npm run build`
  - Job `entegrasyon`: `supabase/setup-cli@v1` starts the local stack, writes `.env.local` with the local API URL and anon key, then runs the RLS and Playwright suites; the Playwright report is uploaded as an artifact on failure

## Environment Configuration

**Required env vars:**
- None are strictly required — the app runs local-first with zero config.
- For sync/auth: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_AUTH_GITHUB` (GitHub sign-in button), `VITE_SENTRY_DSN` (error tracking)
- Declared in `src/vite-env.d.ts`, documented in `.env.example`

**Secrets location:**
- `.env.local` (gitignored) locally; hosting provider environment settings in production; GitHub Actions generates its own `.env.local` at run time.
- Only anon-safe, `VITE_`-prefixed values may reach the client. A service role key must never carry the `VITE_` prefix — it would ship in the bundle.

## Webhooks & Callbacks

**Incoming:**
- No server webhooks (no backend, no Edge Functions).
- Browser OAuth/email callback route: `/auth/callback` → `src/pages/AuthCallbackPage.tsx` with parsing in `src/lib/auth-callback.ts`; redirect target set at `src/components/AuthProvider.tsx:118`.
- Redirect URLs must be allowlisted exactly: `additional_redirect_urls` in `supabase/config.toml` locally, Authentication → URL Configuration in the cloud project. A non-matching URL silently falls back to `site_url`.

**Outgoing:**
- Supabase REST/Auth calls from `src/lib/tasks.ts`, `src/lib/categories.ts`, `src/lib/task-repository.ts`, `src/lib/sync.ts`
- Sentry ingest requests, only when a DSN is configured

**Payments:**
- Not integrated. Stripe is ruled out (Turkey); iyzico / LemonSqueezy / Paddle remain candidates. No `subscriptions` table exists yet.

---

*Integration audit: 2026-08-14*
