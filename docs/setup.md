# Setup

## Requirements

- Node.js 18+
- For auth, sync, RLS tests, and demo seed: Docker + [Supabase CLI](https://supabase.com/docs/guides/cli)

## App only (local-first)

```bash
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:5173 — the app is at `/app`. With no `VITE_SUPABASE_*` variables, sign-in is hidden and everything stays in LocalStorage.

## With local Supabase

```bash
npx supabase start
```

Copy **API URL** and **anon key** from the command output into `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon jwt from the start output>
```

Restart `npm run dev` after changing env files (Vite inlines `VITE_*` at compile time).

Apply schema + demo rows:

```bash
npx supabase db reset
```

Then sign in as:

| Field | Value |
| --- | --- |
| Email | `demo@example.com` |
| Password | `demodemo1` |

The seed is a **free-plan** account: one client (Acme Agency), two projects, four tasks, two time logs. A second client is rejected by the database gate.

If the API returns 502 after `db reset`, Kong cached the old container:

```bash
docker restart supabase_kong_yapilacaklar-listesi
```

## Cloud Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Put `Project URL` and `anon public` key in `.env.local` (or the host's env). **Never** put `service_role` behind a `VITE_` prefix.
3. Push migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
4. Under **Authentication → URL Configuration**, add the **exact** redirect URLs you use (`http://localhost:5173/auth/callback`, production `/auth/callback`). Supabase silently falls back to `site_url` on mismatch — it does not error.
5. Hosted projects confirm email by default. The app shows a “check your inbox” state until the link is clicked.

`supabase/seed.sql` is for **local** `db reset`. Do not run it against a production project unless you intend to create `demo@example.com`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on 5173 (`strictPort`: it will not silently hop) |
| `npm run build` | Production build (clears `dist/` first) |
| `npm run lint` | ESLint including jsx-a11y |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (starts its own dev server) |
| `npm run test:rls` | Schema/RLS tests (needs local Supabase) |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` |
| `npm run verify:niche` | Proves the niche module actually leaves the bundle when off |
