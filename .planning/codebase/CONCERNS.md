<!-- refreshed: 2026-08-14 -->
# Codebase Concerns

**Analysis Date:** 2026-08-14

## Tech Debt

**Full-snapshot sync (no incremental fetch):**
- Issue: Every sync round pulls the user's *entire* task and category set (`select('*')` with no filter, pagination, or `updated_at` cursor). Remote deletions can only be detected by full-set comparison, so partial fetch is impossible without a server-side tombstone table.
- Files: `src/lib/task-repository.ts` (`fetchRemoteTasks`, `fetchRemoteCategories`), `src/lib/sync.ts`
- Impact: Payload and merge cost grow linearly with data. Documented as viable "up to a few thousand tasks"; also collides with Supabase's default 1000-row PostgREST cap — beyond that rows silently vanish from the snapshot and the merge engine would treat them as remote deletions.
- Fix approach: Add explicit `.range()` paging (or a `limit` guard that throws instead of truncating) now; add `deleted_tasks` tombstone table + `updated_at` cursor later.

**No component-level unit tests:**
- Issue: Unit tests cover only pure modules (`src/lib/*`, `src/store/index.ts`, `src/i18n`, `src/config`). Every React component is verified exclusively through Playwright.
- Files: no `*.test.tsx` exists anywhere under `src/components/` or `src/pages/`
- Impact: Component regressions surface only in the slow E2E job; provider wiring (`SyncProvider`, `AuthProvider`, `ThemeProvider`) has no fast failing test.
- Fix approach: Add `@testing-library/react` and cover `SyncProvider` state transitions and `TaskForm` validation at the unit level.

**`--legacy-peer-deps` required in CI:**
- Issue: Both CI jobs install with `npm ci --legacy-peer-deps`, meaning at least one dependency declares an incompatible peer range (React 19 / Vite 8 ecosystem).
- Files: `.github/workflows/ci.yml`
- Impact: Peer conflicts are permanently masked; a genuinely broken upgrade will install cleanly and fail at runtime instead of at install time.
- Fix approach: Identify the offending package (`npm ci` without the flag, read the error), pin or replace it, remove the flag.

**Accessibility linting not installed:**
- Issue: `eslint-plugin-jsx-a11y` is listed as remaining work in `CLAUDE.md` but is absent from `eslint.config.js` and `package.json`.
- Files: `eslint.config.js`, `package.json`
- Impact: Accessibility invariants (labels, roles, keyboard handlers) are enforced by convention and review only.
- Fix approach: Add the plugin with its recommended flat config; fix fallout before merging.

**Version is `0.0.0`, no changelog:**
- Issue: `package.json` `version: "0.0.0"`, no `CHANGELOG.md`, no tags.
- Files: `package.json`
- Impact: A starter kit sold to developers cannot communicate breaking changes.
- Fix approach: Adopt semver + `CHANGELOG.md` (already scoped as Phase 6).

## Known Bugs

**Seed category divergence across differently-localized devices:**
- Symptoms: The same account seeded first in Turkish on one device and English on another produces two parallel default sets ("İş" and "Work"); name-based dedup in `mergeCategories` cannot fold them.
- Files: `src/lib/categories.ts`, `src/lib/sync-merge.ts`
- Trigger: Fresh install of the same account under two different browser languages before first sync.
- Workaround: Accepted deliberately (documented in `CLAUDE.md`); user deletes duplicates manually.

**Conflicting edits are dropped silently:**
- Symptoms: With last-writer-wins on `updatedAt` (cloud wins on ties), an edit made offline on device A can disappear with no user-visible notice.
- Files: `src/lib/sync-merge.ts`
- Trigger: Same task edited on two devices while offline.
- Workaround: None in-product. Needs at minimum a toast when a local dirty change is discarded (`plan.discardedIds` already carries the information — it is currently only used to clear dirty flags).

## Security Considerations

**No HTTP security headers on the deployment:**
- Risk: No Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, or `X-Frame-Options` is set. The app is clickjackable and has no CSP defense-in-depth around the Supabase token stored in LocalStorage.
- Files: `vercel.json` (rewrites only), `public/_redirects`
- Current mitigation: React escaping; no `dangerouslySetInnerHTML` anywhere in `src/`.
- Recommendations: Add a `headers` block to `vercel.json` with CSP (`connect-src` limited to the Supabase project + Sentry ingest), `frame-ancestors 'none'`, `nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

**Auth session persisted in LocalStorage:**
- Risk: `persistSession: true` with `storageKey: 'yapilacaklar-auth'` puts the refresh token where any injected script can read it.
- Files: `src/lib/supabase.ts`
- Current mitigation: PKCE flow, no third-party scripts, strict React rendering.
- Recommendations: Ship the CSP above; document the tradeoff for starter-kit buyers who will add analytics/marketing scripts.

**Category color is written straight into inline styles without local validation:**
- Risk: The DB enforces `check (color ~ '^#[0-9a-f]{6}$')`, but locally-created and LocalStorage-restored categories bypass that check and flow into `style={{ color, backgroundColor: `${color}1a` }}`.
- Files: `src/components/TaskItem.tsx:161`, `src/store/index.ts` (`addCategory`/`updateCategory`), `src/lib/categories.ts`
- Current mitigation: UI uses `input[type=color]`, which can only emit `#rrggbb`; React rejects most style injection attempts.
- Recommendations: Validate the hex pattern in `createCategory`/`updateCategory` so the local invariant matches the DB constraint. Cheap, removes a whole class of doubt.

**Payment gating not yet built — the highest-value future risk:**
- Risk: Pro gating must exist in Postgres (function + `WITH CHECK`), not just UI, and webhook signatures must be verified. Neither exists yet.
- Files: none (`subscriptions` table not created)
- Current mitigation: Not applicable — feature absent.
- Recommendations: Write the DB-level gate before the first paid UI element ships.

**GitHub OAuth misconfiguration is undetectable client-side:**
- Risk: `signInWithOAuth` does not error when the provider is disabled; it redirects the user into a raw Supabase JSON error.
- Files: `src/components/AuthProvider.tsx`, `src/config/features.ts`
- Current mitigation: Button gated behind `features.githubAuth`, default off.
- Recommendations: Keep default off; document the required Supabase + GitHub setup in `docs/` before enabling.

## Performance Bottlenecks

**Every dirty change reloads the whole cloud snapshot:**
- Problem: A single task toggle schedules a sync 1500 ms later that refetches all tasks and all categories.
- Files: `src/components/SyncProvider.tsx` (`DEBOUNCE_MS`), `src/lib/sync.ts`
- Cause: Full-snapshot design (see Tech Debt).
- Improvement path: Skip the pull when only a push is pending and the last pull is younger than `POLL_MS`.

**60-second poll runs regardless of pending state:**
- Problem: `setInterval(syncNow, POLL_MS)` plus `visibilitychange` plus `online` all fire full rounds even for an idle, unchanged account.
- Files: `src/components/SyncProvider.tsx`
- Cause: Polling chosen over Realtime for simplicity (a documented, reasonable tradeoff).
- Improvement path: Back off the interval when consecutive rounds return zero changes.

**Merge work is O(local × remote) per round:**
- Problem: `remapTaskCategories` runs twice per round over the full task list, plus two merges.
- Files: `src/lib/sync.ts`, `src/lib/sync-merge.ts`
- Cause: Correctness-first structure; acceptable at current scale.
- Improvement path: Only revisit if task counts exceed a few thousand.

## Fragile Areas

**Sync ordering:**
- Files: `src/lib/sync.ts`, `src/lib/task-repository.ts`
- Why fragile: Categories must be pushed first (else FK 23503 on tasks), tasks written and deleted next, categories deleted last. The order is load-bearing and enforced only by comments plus tests.
- Safe modification: Change nothing about the three-step order without running `npm test` and `npm run test:rls`.
- Test coverage: Merge logic is well covered (`sync-merge.test.ts`, `sync-merge-categories.test.ts`); the *ordering* inside `runSync` has no direct unit test — `src/lib/sync.ts` has no `sync.test.ts`.

**`pendingCount` must include category counters:**
- Files: `src/components/SyncProvider.tsx`
- Why fragile: If category dirty/tombstone counts are dropped from the sum, category-only changes never trigger a sync until the next poll. This has regressed once already.
- Safe modification: Keep `e2e/senkron.spec.ts` green.
- Test coverage: E2E only.

**`ownerId` device-ownership semantics:**
- Files: `src/store/index.ts` (`prepareForSync`)
- Why fragile: Three-branch logic whose failure modes are data resurrection and mass re-push. The "different account" branch wipes local tasks and categories outright.
- Safe modification: Do not add re-seeding to the wipe branch; that resurrects deleted defaults.
- Test coverage: Good — `src/store/index.test.ts` covers the branches.

**RLS depends on GRANTs that are easy to forget:**
- Files: `supabase/migrations/20260812120000_init_schema.sql`, `supabase/migrations/20260813120000_categories.sql`
- Why fragile: Policies are never evaluated without the matching `grant ... to authenticated`. This caused a real outage once.
- Safe modification: Any new table needs GRANT + policies + an assertion in `supabase/tests/rls.test.mjs`.
- Test coverage: Strong — `npm run test:rls`.

**Module-order trap in i18n seeding:**
- Files: `src/lib/categories.ts`, `src/store/index.ts`
- Why fragile: The store calls `seedCategories()` during module evaluation, so `categories.ts` must import i18n directly. Refactoring the import graph can silently produce categories named after translation keys.
- Test coverage: `src/lib/categories.test.ts`, `src/i18n/i18n.test.ts`.

**OneDrive build path:**
- Files: `scripts/clean-dist.mjs`, `vite.config.ts`
- Why fragile: Vite's `emptyOutDir` fails silently under the OneDrive path, so a custom prebuild script does the cleanup and hard-fails on error. Removing it lets stale bundles get precached by the service worker.

## Scaling Limits

**Cloud rows per user:**
- Current capacity: Comfortable to a few thousand tasks.
- Limit: PostgREST default max rows (1000) truncates the snapshot with no error; merge then interprets missing rows as deletions.
- Scaling path: Explicit paging in `fetchRemoteTasks`/`fetchRemoteCategories` plus a server-side tombstone table.

**LocalStorage:**
- Current capacity: ~5 MB per origin holds the full task set, tombstones, and dirty lists.
- Limit: Quota exceeded writes throw inside zustand `persist` and are not handled anywhere.
- Scaling path: Wrap the persist storage adapter with a quota-error handler; consider IndexedDB.

**Tombstone TTL:**
- Current capacity: 30 days (`TOMBSTONE_TTL_MS` in `src/store/index.ts`).
- Limit: A device offline longer than 30 days resurrects tasks deleted elsewhere.
- Scaling path: Document the window; server-side tombstones remove the limit.

## Dependencies at Risk

**Vite 8 / Vitest 4 / React 19 bleeding edge:**
- Risk: Very recent majors across the toolchain; the `--legacy-peer-deps` requirement is evidence the ecosystem has not fully caught up.
- Impact: Upgrades may break the build in ways CI installs paper over.
- Migration plan: Resolve the peer conflict, then keep majors pinned and upgrade deliberately.

**`@sentry/react` shipped as a dependency while monitoring defaults off:**
- Risk: A ~150 KB gzip chunk lives in `dependencies` and is only excluded from precache by a filename glob (`globIgnores: ['**/sentry-*.js']`) that depends on the `manualChunks` name staying `sentry`.
- Impact: Rename the chunk and every user silently downloads the payload again.
- Migration plan: Add a build assertion that no precached asset matches `sentry`.

## Missing Critical Features

**No route protection anywhere under `/app`:**
- Problem: Deliberate — the app is local-first and login is optional.
- Blocks: The moment account-specific pages (billing, subscription) land, a guard must exist; there is no primitive for one today.

**Niche module absent (`clients`, `projects`, `time_logs`):**
- Problem: The differentiating product surface is unbuilt.
- Blocks: Freemium positioning; also the feature-flag isolation pattern (`src/config/features.ts`) is unproven against a whole module.

**Payment provider undecided:**
- Problem: Stripe is unusable from Turkey; iyzico vs. LemonSqueezy/Paddle unresolved.
- Blocks: All revenue work, and the shape of the `subscriptions` table.

**No packaging deliverables:**
- Problem: No `supabase/seed.sql` demo data, no English README, no `docs/` set for a buyer.
- Blocks: Selling the starter kit.

## Test Coverage Gaps

**`src/lib/sync.ts` orchestration:**
- What's not tested: The push/delete ordering, the `inFlight` lock, and `errorKeyFor` mapping have no unit test; only the pure merge functions they call do.
- Files: `src/lib/sync.ts` (no sibling `sync.test.ts`)
- Risk: A reordering regression reaches production unless the specific E2E path catches it.
- Priority: High

**React components:**
- What's not tested: Every file under `src/components/` and `src/pages/`, at the unit level.
- Files: `src/components/*.tsx`, `src/pages/*.tsx`
- Risk: Slow feedback; provider-level regressions found only in the 25-minute integration job.
- Priority: Medium

**No coverage measurement or threshold:**
- What's not tested: There is no `test:coverage` script and no threshold in `vitest.config.ts`, so gaps are invisible.
- Files: `package.json`, `vitest.config.ts`
- Risk: Coverage silently erodes as the niche module lands.
- Priority: Medium

**LocalStorage failure paths:**
- What's not tested: Quota-exceeded and corrupt-JSON rehydration in the zustand `persist` layer.
- Files: `src/store/index.ts`
- Risk: A corrupt store can white-screen the app before the root `ErrorBoundary` renders meaningfully.
- Priority: Medium

**Repository error translation:**
- What's not tested: `SyncUnavailableError` and `error.message` rethrow paths in `src/lib/task-repository.ts`.
- Files: `src/lib/task-repository.ts`
- Risk: Supabase error shape changes surface as `sync.error.unknown` for every failure.
- Priority: Low

---

*Concerns audit: 2026-08-14*
