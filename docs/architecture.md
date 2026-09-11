# Architecture

Local-first SPA: React 19, TypeScript, Vite 8, Tailwind v4, Zustand, Supabase, Radix, dnd-kit, framer-motion, react-i18next, PWA.

## Data flow

The Zustand store on the device is the primary source. Supabase is an optional sync layer. If env is missing, the app still works and the auth UI is not rendered.

```
UI → store (LocalStorage, persist v7)
       ↓  dirty ids + tombstones
    runSync (pure merge in src/lib/sync-merge.ts, network in task-repository.ts)
       ↓
    Postgres + RLS
```

Merge is a **pure function** (no I/O). Conflict rule: newer `updatedAt` wins; ties go to the cloud so every device converges. Cloud is fetched as a **full snapshot** each tour — fine up to a few thousand rows.

`ownerId` records which account the device data belongs to. Without it, every sign-in treated all tasks as “pending push” and resurrected rows another device had deleted.

## Sync order

Writes independent → dependent: clients → projects → categories → tasks → time logs.  
Deletes the reverse. **All writes finish before any deletes** in the same tour.

A 23503 in the middle aborts the whole tour. Isolation for **terminal** errors (`42501`, `23514`, `23502`, `23503`) exists on client push (`SyncOutcome.blocked`) so a free-plan second client does not jam task sync.

`pendingChangeCount` is derived from `PENDING_FIELDS` in `src/store/index.ts`. A new record type that is not on that list never triggers sync until the next poll.

## Schema

Seven tables. RLS: `authenticated` sees only own rows; `anon` is granted nothing. **Without GRANT, RLS policies are never evaluated** — that was a real bug; `npm run test:rls` guards it.

Composite FKs include `user_id` so a user cannot attach a task to someone else’s category/client/project.

Niche tables (`clients`, `projects`, `time_logs`) and `tasks.client_id` / `tasks.project_id` come from two migrations that can be deleted together. See [niche-module.md](./niche-module.md).

`subscriptions` is starter-kit billing, not niche. The client INSERT cap is a **separate** migration so a buyer can drop the gate without dropping the table. See [billing.md](./billing.md).

## Error boundaries

Two layers: React Router `errorElement` on top-level routes (the router swallows render errors and never reaches the root), plus a root `ErrorBoundary` outside theme/auth/sync providers. `/app/__crash` exists only in development.

Optional Sentry: no DSN means no network and the Sentry chunk is not precached.

## i18n

`tr` + `en`. Typed keys against the Turkish JSON. User-facing pure layers return `TranslationKey`, not rendered strings. Playwright locale is pinned to `tr-TR`.
