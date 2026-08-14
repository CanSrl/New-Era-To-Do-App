<!-- refreshed: 2026-08-14 -->
# Architecture

**Analysis Date:** 2026-08-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                  Bootstrap / Provider Shell                  │
│  `src/main.tsx` — ErrorBoundary > ThemeProvider >            │
│  AuthProvider > SyncProvider > RouterProvider + Toaster      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Routing / Shell                          │
│      `src/router.tsx`      →      `src/components/AppLayout` │
└────────┬─────────────────────────────────┬──────────────────┘
         │                                 │
         ▼                                 ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  Pages                   │   │  Feature components          │
│  `src/pages/*.tsx`       │   │  `src/components/*.tsx`      │
└────────┬─────────────────┘   └───────────┬──────────────────┘
         │                                 │
         └──────────────┬──────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           State (primary source of truth)                    │
│  `src/store/index.ts` (persisted tasks/categories/sync meta) │
│  `src/store/ui.ts` (ephemeral UI state)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           Sync orchestration + pure merge engine             │
│  `src/lib/sync.ts`  ·  `src/lib/sync-merge.ts` (pure)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Repository + row mapping (network boundary)         │
│  `src/lib/task-repository.ts`                                │
│  `src/lib/task-mapping.ts` · `src/lib/category-mapping.ts`   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LocalStorage (zustand persist)   ·   Supabase (Postgres+RLS)│
│  `src/lib/supabase.ts`            ·   `supabase/migrations/` │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Bootstrap | Mounts React root, installs i18n, starts monitoring, nests providers | `src/main.tsx` |
| Router | Route table, per-route `errorElement`, dev-only crash route | `src/router.tsx` |
| App shell | Sidebar/bottom nav, theme toggle, global task form, `n`/`Escape` shortcuts | `src/components/AppLayout.tsx` |
| Task store | Persisted tasks, categories, filters, dirty ids, tombstones, `ownerId` | `src/store/index.ts` |
| UI store | Non-persisted dialog state (`isTaskFormOpen`, `editingTaskId`) | `src/store/ui.ts` |
| Sync orchestrator | One sync round: fetch → merge → push → delete → apply | `src/lib/sync.ts` |
| Merge engine | Pure conflict resolution for tasks and categories, id remapping | `src/lib/sync-merge.ts` |
| Repository | All Supabase reads/writes for tasks and categories | `src/lib/task-repository.ts` |
| Mapping | Row ⇄ domain field-name translation | `src/lib/task-mapping.ts`, `src/lib/category-mapping.ts` |
| Auth provider | Session, sign in/up/out, OAuth, exposes `isConfigured` | `src/components/AuthProvider.tsx` |
| Sync provider | Debounce, polling, status/pendingCount context | `src/components/SyncProvider.tsx` |
| Error boundaries | Root boundary + `RouteErrorBoundary` for router-caught errors | `src/components/ErrorBoundary.tsx` |
| Feature flags | Build-time flags read from `import.meta.env` | `src/config/features.ts` |
| i18n | Resource bundles, typed keys, language detection/persistence | `src/i18n/index.ts` |

## Pattern Overview

**Overall:** Local-first single-page app with an explicit sync layer over a
remote store. Layered by module role (`components` → `store` → `lib`), not by
feature folder.

**Key Characteristics:**
- The device Zustand store is the source of truth; the cloud is an optional overlay.
- Supabase may be unconfigured (`supabase` is `null`); the app must stay fully functional.
- Conflict resolution is a pure function with no network access, so it is exhaustively unit-testable.
- User-facing strings never originate in pure layers — those return `TranslationKey` values.
- Optional subsystems (GitHub auth, Sentry) are behind build-time flags / dynamic import.

## Layers

**Presentation:**
- Purpose: Render UI, capture input, read from stores
- Location: `src/components/`, `src/pages/`, `src/components/ui/`
- Contains: React function components, Radix wrappers
- Depends on: stores, `src/lib/utils.ts`, i18n
- Used by: router

**Providers (cross-cutting runtime):**
- Purpose: Theme, auth session, sync scheduling, error containment
- Location: `src/components/{ThemeProvider,AuthProvider,SyncProvider,ErrorBoundary}.tsx`
- Contains: React context + effects
- Depends on: `src/lib/supabase.ts`, `src/lib/sync.ts`, store
- Used by: `src/main.tsx`

**State:**
- Purpose: Own domain data and sync bookkeeping
- Location: `src/store/`
- Contains: Zustand stores; `index.ts` uses `persist` middleware, `ui.ts` does not
- Depends on: `src/lib/types.ts`, `src/lib/tasks.ts`, `src/lib/categories.ts`
- Used by: components, sync orchestrator

**Domain / pure logic:**
- Purpose: Merge decisions, id/position generation, seeding, error classification
- Location: `src/lib/sync-merge.ts`, `src/lib/tasks.ts`, `src/lib/categories.ts`, `src/lib/auth-errors.ts`, `src/lib/auth-callback.ts`
- Depends on: types only (no network, no React)
- Used by: store, sync orchestrator, providers

**Data access:**
- Purpose: Talk to Supabase, translate rows
- Location: `src/lib/task-repository.ts`, `src/lib/*-mapping.ts`, `src/lib/supabase.ts`, `src/lib/database.types.ts`
- Used by: `src/lib/sync.ts` only

**Database:**
- Purpose: Storage plus authorization
- Location: `supabase/migrations/`
- Contains: `profiles`, `categories`, `tasks`, RLS policies, GRANTs, triggers
- Verified by: `supabase/tests/rls.test.mjs`

## Data Flow

### Primary mutation path

1. User acts in a component (e.g. `src/components/TaskItem.tsx`) and calls a store action.
2. `src/store/index.ts` applies the change, stamps `updatedAt`, and records the id in `dirtyIds` (or a tombstone for deletes).
3. `persist` middleware writes to LocalStorage immediately — this alone is a complete, working app.
4. `src/components/SyncProvider.tsx` observes `pendingCount` (tasks *and* categories) and schedules `runSync` after `DEBOUNCE_MS` (1500 ms).
5. `src/lib/sync.ts` fetches full remote snapshots, merges, and writes back.

### Sync round (`src/lib/sync.ts`)

1. Guard: skip if `inFlight`, `navigator.onLine === false`, or Supabase unconfigured (`SyncUnavailableError`).
2. `fetchRemoteCategories()` + `fetchRemoteTasks()` in parallel (`src/lib/task-repository.ts`).
3. `mergeCategories(...)` → push categories **first** (task FK requires them).
4. `remapTaskCategories(...)` rewrites task links for deduplicated categories.
5. `mergeTasks(...)` → `pushRemoteTasks` → `deleteRemoteTasks`.
6. `deleteRemoteCategories(...)` **last**, so dependent tasks are already updated.
7. `applySyncResult(...)` replaces local rows with server-returned rows (trigger-refreshed `updated_at`) and clears dirty ids/tombstones.

Conflict rule: newer `updatedAt` wins; on a tie the cloud wins so every device converges. Polling refresh runs every `POLL_MS` (60 s).

### Auth flow

1. `AuthProvider` subscribes to Supabase auth state (`src/components/AuthProvider.tsx`).
2. On login, `prepareForSync(userId)` sets `ownerId` and adopts local guest data.
3. Email links land on `/auth/callback` (`src/pages/AuthCallbackPage.tsx`), parsed by `src/lib/auth-callback.ts`; password reset lands on `/reset-password`.

**State Management:**
- Persisted domain state: `src/store/index.ts` (LocalStorage, versioned with migrations for legacy Turkish values).
- Ephemeral UI state: `src/store/ui.ts`.
- Server session state: React context in `AuthProvider`; sync status in `SyncProvider`.

## Key Abstractions

**Merge plan:**
- Purpose: Declarative result of comparing local and remote sets (`toPush`, `toDelete`, `discardedIds`, `obsoleteTombstoneIds`, `idRemap`)
- Examples: `src/lib/sync-merge.ts`
- Pattern: Pure function returning a plan the caller executes

**Repository:**
- Purpose: Sole network boundary for domain data; throws `SyncUnavailableError` when Supabase is absent
- Examples: `src/lib/task-repository.ts`
- Pattern: Module-level async functions, not a class

**Row mapper:**
- Purpose: Convert snake_case DB rows to camelCase domain objects
- Examples: `src/lib/task-mapping.ts`, `src/lib/category-mapping.ts`

**Tombstone:**
- Purpose: Propagate deletes across devices; TTL 30 days
- Examples: `src/store/index.ts`

**TranslationKey:**
- Purpose: Pure layers return keys instead of rendered text
- Examples: `src/i18n/index.ts`, `src/lib/sync.ts`, `src/lib/auth-errors.ts`

**Feature flag:**
- Purpose: Build-time removal of optional subsystems
- Examples: `src/config/features.ts`

## Entry Points

**Browser bootstrap:**
- Location: `src/main.tsx` (via `index.html`)
- Triggers: Page load
- Responsibilities: i18n side-effect import, `initMonitoring()`, provider nesting, router mount

**Route table:**
- Location: `src/router.tsx`
- Routes: `/` → `/app`; `/app` (shell) with index `TasksPage` and `settings`; `/reset-password`; `/auth/callback`; `*` not-found; `/app/__crash` dev-only

**Build/tooling:**
- `vite.config.ts` (alias `@` → `src`, PWA, Sentry chunk split + precache exclusion)
- `scripts/clean-dist.mjs` (prebuild; `emptyOutDir` fails silently on the OneDrive path)
- `.github/workflows/ci.yml` (quality job + integration job)

## Architectural Constraints

- **Threading:** Single-threaded browser main thread. A service worker (vite-plugin-pwa, `autoUpdate`) runs separately and precaches the build, excluding `sentry-*.js`.
- **Global state:** `inFlight` in `src/lib/sync.ts` is a module-level lock preventing overlapping sync rounds (`resetSyncLock()` exists for tests). `supabase` in `src/lib/supabase.ts` is a module singleton that may be `null`.
- **Module order:** `src/store/index.ts` calls `seedCategories()` during module evaluation, so `src/lib/categories.ts` imports i18n directly; `src/main.tsx` imports `./i18n` before rendering.
- **Sync ordering:** Categories push → tasks push/delete → categories delete. Violating this yields Postgres 23503.
- **FK is composite:** `tasks.category_id` references `(category_id, user_id)`; a single-column FK would bypass RLS.
- **No unique constraint on category names:** deliberate — a 23505 would drop the entire sync round.
- **Circular imports:** None observed; dependencies flow components → store → lib.

## Anti-Patterns

### Returning rendered text from pure layers

**What happens:** A sync/auth helper returns a Turkish or English string directly.
**Why it's wrong:** The message freezes in the language active when the error occurred; switching language leaves stale text on screen.
**Do this instead:** Return a `TranslationKey` and render with `t()` at the component layer — see `errorKeyFor` in `src/lib/sync.ts`.

### Counting only task changes when deciding to sync

**What happens:** `pendingCount` omits `dirtyCategoryIds` / `categoryTombstones`.
**Why it's wrong:** Category-only edits never trigger a round and wait for the 60 s poll — this shipped as a real bug once.
**Do this instead:** Include all four counters, as in `src/components/SyncProvider.tsx`; guarded by `e2e/senkron.spec.ts`.

### Adding RLS policies without GRANTs

**What happens:** A migration creates policies but does not grant table privileges to `authenticated`.
**Why it's wrong:** Without GRANT, policies are never evaluated and access fails (or is misjudged as safe).
**Do this instead:** Grant explicitly per table; `supabase/tests/rls.test.mjs` enforces it.

### Reaching into Supabase from components

**What happens:** A component imports `supabase` and queries a table directly.
**Why it's wrong:** Bypasses merge, dirty tracking, and the null-client guard, breaking local-first behavior.
**Do this instead:** Mutate the store; let `src/lib/sync.ts` and `src/lib/task-repository.ts` own the network.

### Importing Sentry at module scope

**What happens:** `@sentry/react` is imported statically.
**Why it's wrong:** ~150 KB gzip is pulled into the main chunk and precached even with monitoring disabled.
**Do this instead:** Keep the dynamic `import()` inside `src/lib/monitoring.ts`.

## Error Handling

**Strategy:** Contain failures at the layer that can explain them; never let a sync failure destroy local data.

**Patterns:**
- Repository throws `Error(error.message)`; `runSync` catches and downgrades to `{ status: 'error', messageKey }`.
- `SyncUnavailableError` is a skip, not an error (`status: 'skipped'`).
- Root `ErrorBoundary` sits outside all providers; every top-level route also sets `errorElement={<RouteErrorBoundary />}` because React Router swallows render errors.
- Auth errors are normalized to keys in `src/lib/auth-errors.ts`.

## Cross-Cutting Concerns

**Logging/monitoring:** `src/lib/monitoring.ts` — dynamic Sentry load, no-op without `VITE_SENTRY_DSN`, buffers errors during load.
**Validation:** Client-side form checks plus database CHECK constraints (e.g. `color` `#rrggbb`); RLS is the authorization boundary.
**Authentication:** Optional. `AuthProvider` exposes `isConfigured`; no route guards under `/app`.
**Internationalization:** `react-i18next`, `tr` fallback, typed keys via `src/i18n/i18next.d.ts`, verified by `src/i18n/i18n.test.ts`.
**Theming:** `ThemeProvider` with `storageKey="yapilacaklar-theme"`, Tailwind v4 tokens in `src/index.css`.

---

*Architecture analysis: 2026-08-14*
