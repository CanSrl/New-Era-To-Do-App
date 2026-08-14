# Testing Patterns

**Analysis Date:** 2026-08-14

## Test Framework

**Runners (three separate suites):**
- **Vitest 4** — unit tests. Config: `vitest.config.ts`
- **Playwright 1.62** — end-to-end. Config: `playwright.config.ts`
- **Plain Node ESM script** — schema/RLS security tests. File: `supabase/tests/rls.test.mjs`

**Assertion Library:**
- Vitest built-in `expect`
- Playwright `expect` (auto-retrying web assertions)
- RLS suite uses a hand-rolled `check(name, passed, detail)` collector — no framework

**Run Commands:**
```bash
npm test            # Vitest, single run
npm run test:watch  # Vitest watch mode
npm run test:e2e    # Playwright (starts the dev server itself)
npm run test:rls    # Schema security tests (needs `npx supabase start`)
npm run lint        # ESLint
npx tsc -b --noEmit # Type check
```

**Current counts:** ~169 unit assertions across 11 files, 67 e2e tests across 8 specs, ~30 schema checks.

## Test File Organization

**Location:**
- Unit tests are **co-located** with the module under test: `src/lib/tasks.ts` ↔ `src/lib/tasks.test.ts`
- E2E specs live in `e2e/`, isolated from `src/`
- Schema tests live in `supabase/tests/`

**Naming:**
- Unit: `<module>.test.ts` (only `.ts` — `include: ['src/**/*.test.ts']`, no `.tsx` component tests exist)
- E2E: Turkish domain names — `gorevler.spec.ts` (tasks), `kategoriler.spec.ts`, `senkron.spec.ts` (sync), `gezinme.spec.ts` (navigation), `dil.spec.ts` (language), `auth.spec.ts`, `auth-callback.spec.ts`, `hata-siniri.spec.ts` (error boundary)

**Structure:**
```
src/
  lib/sync-merge.ts + sync-merge.test.ts
  store/index.ts    + index.test.ts
  test-setup.ts                   # global setup, pins i18n language to 'tr'
e2e/
  helpers.ts                      # shared locators + flows
  *.spec.ts
supabase/tests/rls.test.mjs
```

**What goes where:**
- Pure logic, store reducers, mappings, i18n integrity → Vitest
- User flows, routing, dialogs, multi-device sync → Playwright
- RLS, triggers, constraints, GRANTs → `rls.test.mjs`

## Test Structure

**Unit suite organization (`src/lib/sync-merge.test.ts`):**
```ts
import { describe, it, expect } from 'vitest';
import { mergeTasks } from './sync-merge';
import type { Task } from './types';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
    return { id, title: `Görev ${id}`, priority: 'medium', completed: false,
             categoryId: null, createdAt: '2026-01-01T00:00:00.000Z',
             updatedAt: '2026-01-01T00:00:00.000Z', position: 0, ...overrides };
}

describe('yalnızca yerelde olan görev', () => {
    it('dirty ise buluta gönderilir ve cihazda kalır', () => {
        const plan = mergeTasks({ local: [makeTask('a')], remote: [], dirtyIds: ['a'], tombstones: [] });
        expect(plan.toPush.map(t => t.id)).toEqual(['a']);
    });
});
```

**Patterns:**
- `describe` names the **scenario** ("only local task", "task on both sides"), `it` states the **expected outcome** — both in Turkish, phrased as behaviour not implementation.
- Arrange / act / assert separated by blank lines.
- A local `makeTask(id, overrides)` factory per test file; overrides spread last.
- Small named readers to reduce assertion noise: `const ids = (tasks: readonly Task[]) => tasks.map(t => t.id).sort()`, `const store = () => useTaskStore.getState()`.

**Setup / teardown:**
- Global: `src/test-setup.ts` awaits `i18n.changeLanguage('tr')` (jsdom reports `en-US`, which would make seeded category names vary).
- Store tests use a `resetStore()` helper in `beforeEach` that clears `localStorage` and calls `useTaskStore.setState({...})` with a full explicit initial state (`src/store/index.test.ts`).
- `restoreMocks: true` in `vitest.config.ts` — mocks are restored automatically; no manual `vi.restoreAllMocks()`.
- Environment is `jsdom` because the zustand `persist` middleware needs `localStorage`.

## Mocking

**Framework:** Vitest `vi`. Mocking is deliberately minimal — the architecture pushes logic into pure functions so mocks are usually unnecessary.

**Patterns:**
```ts
const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
captureError(new Error('patladı'));
expect(spy).toHaveBeenCalledWith('Yakalanan hata:', expect.any(Error), '');
```

**What to Mock:**
- Console output when asserting on logging behaviour (`src/lib/monitoring.test.ts`)
- Browser APIs jsdom does not provide, at the narrowest possible scope

**What NOT to Mock:**
- The merge engine, store, or mapping layers — call them directly with fabricated data
- Supabase. Cloud behaviour is verified against a **real local Supabase stack** in `supabase/tests/rls.test.mjs` and in Playwright's `senkron.spec.ts`, never with a fake client.
- Sentry. `monitoring.test.ts` only covers the DSN-less default; the enabled path is covered end-to-end.

## Fixtures and Factories

**Test Data:**
```ts
// per-file factory, no shared fixtures directory
function makeTask(id: string, overrides: Partial<Task> = {}): Task { ... }
function addTask(title: string, overrides: Partial<Task> = {}) { store().addTask({...}); }
```

**Location:**
- Unit: inline factories at the top of each test file. There is no `fixtures/` directory — do not create one for a single consumer.
- E2E: `e2e/helpers.ts` exports `gotoApp`, `openTaskForm`, `addTask`, `isAuthEnabled`, plus locator builders `taskDialog`, `taskHeading`, `toggleButton`, `editButton`, `deleteButton`.
- RLS: unique emails per run via `const stamp = Date.now()` so reruns do not collide.

## Coverage

**Requirements:** no coverage tool configured and no threshold enforced. Confidence comes from breadth across the three suites, not from a percentage.

**View Coverage:**
```bash
npx vitest run --coverage   # requires installing @vitest/coverage-v8 first
```

## Test Types

**Unit Tests (Vitest):**
- Scope: `src/store/index.ts` (largest suite, ~49 cases), `src/lib/sync-merge*.ts`, `src/lib/tasks.ts`, `src/lib/categories.ts`, `src/lib/task-mapping.ts`, `src/lib/auth-errors.ts`, `src/lib/auth-callback.ts`, `src/lib/monitoring.ts`, `src/config/features.ts`, `src/i18n/i18n.test.ts`
- No React component rendering tests exist (no Testing Library dependency). UI behaviour is covered by Playwright instead.

**i18n integrity tests (`src/i18n/i18n.test.ts`):**
- Flattens both locale JSON files to `a.b.c` keys and asserts identical key sets, no empty strings, and matching `{{placeholder}}` / plural forms. This is the only thing that catches a missing English key — the type system references the Turkish file only.

**E2E (Playwright):**
- `testDir: './e2e'`, chromium only, `workers: 1` (tests share the same origin's LocalStorage), `retries: 2` in CI, `trace: 'on-first-retry'`, `reporter: 'github'` in CI.
- **`locale: 'tr-TR'` is pinned.** Chromium defaults to en-US; without this every Turkish-text selector breaks.
- `webServer` runs `npm run dev` and reuses an existing server locally.

**Multi-device tests (`e2e/senkron.spec.ts`):**
Each Playwright browser context is a separate device (own LocalStorage + session):
```ts
async function openDevice(browser: Browser): Promise<Page> {
    const context = await browser.newContext()
    const page = await context.newPage()
    await gotoApp(page)
    return page
}
```
These specs self-skip when Supabase is absent:
```ts
test.beforeAll(async ({ browser }) => { /* ... */ supabaseReady = await isAuthEnabled(page) })
test.beforeEach(() => { test.skip(!supabaseReady, 'Supabase yapılandırılmamış; senkron kapalı.') })
```

**Schema security tests (`supabase/tests/rls.test.mjs`):**
- Signs up two real users through the anon client and asserts user A cannot read/write user B's rows, that the profile trigger fires, that composite FK `(category_id, user_id)` holds, and that `anon` has no grants.
- Pre-flight `fetch(`${URL}/auth/v1/health`)` prints an actionable message and `process.exit(1)` if the stack is down.
- Exits non-zero when any `check()` fails.

## Common Patterns

**Async Testing:**
```ts
await expect(initMonitoring()).resolves.toBeNull();
```
Playwright: always assert with auto-retrying matchers, never `waitForTimeout`.
```ts
await expect(taskHeading(page, 'Ekmek al')).toBeVisible()
await expect(toggleButton(page, 'Ekmek al')).toHaveAttribute('aria-pressed', 'true')
```

**Error Testing:**
```ts
expect(() => captureError('düz metin hata')).not.toThrow();
```

**Accessible selectors only.** E2E locators use `getByRole`, `getByLabel`, `getByTitle`, `getByText` — no CSS or test-id selectors anywhere. This doubles as an accessibility regression net.

**Regression tests carry a comment naming the bug they guard.** Every trap documented in `CLAUDE.md` has a corresponding test with a comment explaining it (`features.test.ts` on `Boolean("false")`, `rls.test.mjs` on missing GRANTs, `senkron.spec.ts` on `pendingCount` omitting category counters).

## CI

`.github/workflows/ci.yml`, two parallel jobs on every push to `main` and every PR, with `cancel-in-progress` concurrency:
- **kalite** — `npm run lint` → `npx tsc -b --noEmit` → `npm test` → `npm run build`
- **entegrasyon** — starts a trimmed Supabase stack (`-x realtime,storage-api,imgproxy,studio,...`), writes `.env.local` from `supabase status -o json`, runs `npm run test:rls`, installs chromium, runs `npm run test:e2e`; uploads `playwright-report/` and `test-results/` as an artifact on failure.

Install uses `npm ci --legacy-peer-deps`.

## Rules for New Tests

- Verify tests are green before a structural change, then again after.
- Manual browser clicking is not verification; add an automated test.
- New pure logic → Vitest, co-located. New user-visible flow → a Playwright spec using `e2e/helpers.ts`. New table, policy, trigger, or constraint → add checks to `supabase/tests/rls.test.mjs`.
- RLS mistakes are invisible in single-account manual testing; always verify with two accounts.

---

*Testing analysis: 2026-08-14*
