# Coding Conventions

**Analysis Date:** 2026-08-14

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `src/components/TaskItem.tsx`, `src/components/SyncProvider.tsx`
- Pages: PascalCase + `Page` suffix — `src/pages/SettingsPage.tsx`, `src/pages/NotFoundPage.tsx`
- Library / pure modules: kebab-case `.ts` — `src/lib/sync-merge.ts`, `src/lib/task-mapping.ts`, `src/lib/auth-errors.ts`
- Unit tests: co-located `<module>.test.ts` — `src/lib/tasks.test.ts`
- E2E specs: Turkish, kebab/plain `.spec.ts` — `e2e/gorevler.spec.ts`, `e2e/senkron.spec.ts`
- Barrel-ish entry points named `index.ts` — `src/store/index.ts`, `src/i18n/index.ts`

**Functions:**
- camelCase, verb-first for actions: `addTask`, `mergeTasks`, `remapTaskCategories`, `toCalendarDate`, `pushRemoteTasks`
- `to*` prefix for coercion helpers (`toPriority`, `toIsoTimestamp`, `toSupported`)
- `*Key` suffix for functions returning i18n keys (`authErrorKey`, `errorKeyFor`)
- Components are named function declarations, exported named (not default): `export function TaskItem(...)`

**Variables:**
- camelCase locals, `SCREAMING_SNAKE_CASE` module constants — `TOMBSTONE_TTL_MS`, `LEGACY_FILTERS`, `CALENDAR_DATE`, `DEFAULT_CATEGORIES`, `STORAGE_KEY`
- Boolean flags read as predicates: `isDragging`, `isDeleting`, `supabaseReady`, `inFlight`

**Types:**
- PascalCase. `interface` for object shapes (`Task`, `Category`, `TaskState`, `TaskItemProps`), `type` for unions and discriminated results (`Priority`, `FilterStatus`, `SyncOutcome`, `TranslationKey`)
- Props interfaces named `<Component>Props`, declared directly above the component
- **Domain unions are language-independent** (`'low' | 'medium' | 'high'`); display strings live only in `src/i18n/locales/*.json`. Never introduce a Turkish or English literal as a type value.

## Code Style

**Formatting:**
- No Prettier config in the repo — formatting is by convention, matched to the surrounding file.
- Indentation: **4 spaces** in `src/**` and `e2e/**`; 2 spaces in root config files (`vite.config.ts`, `eslint.config.js`, `playwright.config.ts`).
- Quotes: single quotes everywhere.
- Semicolons: **used in `src/**`**, **omitted in `e2e/**` and root configs**. Follow the file you are editing.
- Trailing commas in multi-line literals.

**Linting:**
- Flat config: `eslint.config.js` (ESLint 9).
- Extends `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`.
- Ignored: `dist`, `dev-dist`, `supabase/.temp`, `playwright-report`, `test-results`.
- `e2e/**/*.ts` and `*.config.ts` get Node + browser globals.
- `eslint-plugin-jsx-a11y` is **not yet installed** (tracked as remaining work in CLAUDE.md).

**TypeScript strictness (`tsconfig.app.json`) — non-negotiable:**
`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`.
`verbatimModuleSyntax` means type-only imports **must** use `import type { X } from ...`.

## Import Organization

**Order (observed in `src/components/TaskItem.tsx`, `src/lib/sync.ts`):**
1. React / third-party packages (`react`, `@dnd-kit/*`, `date-fns`, `lucide-react`, `react-i18next`)
2. Local types (`import type { Task } from '../lib/types'`)
3. Local modules — store, lib helpers, i18n
4. UI primitives (`./ui/dialog`, `./ui/alert-dialog`)

**Path Aliases:**
- `@/*` → `src/*`, declared in `tsconfig.app.json`, `vite.config.ts`, and `vitest.config.ts`.
- In practice application code uses **relative imports** (`../lib/types`, `./index`). Match the local file; do not mass-convert.

## Error Handling

**Pure layers return translation keys, never text.** `authErrorKey()` in `src/lib/auth-errors.ts` and `errorKeyFor()` in `src/lib/sync.ts` reduce raw provider errors to a `TranslationKey`; the UI calls `t(key)`. This keeps a rendered error correct after a language switch.

**Error reduction pattern:**
```ts
export function authErrorKey(error: { code?: string; message: string }): TranslationKey {
    switch (error.code) {
        case 'invalid_credentials': return 'auth.error.invalidCredentials';
        ...
    }
    // Kod alanı her hata için dolmuyor; mesaj içeriği kırılgan ama tek yedek.
    const message = error.message.toLowerCase();
    if (message.includes('invalid login credentials')) return 'auth.error.invalidCredentials';
    return 'auth.error.unknown';
}
```
Always: stable `code` first, message-substring fallback second, generic key last.

**Discriminated result objects instead of throwing** for expected outcomes — `SyncOutcome` in `src/lib/sync.ts` is `{ status: 'ok' | 'skipped' | 'error' }`. Throwing is reserved for programmer errors and repository-level failures (`SyncUnavailableError` in `src/lib/task-repository.ts`).

**Coercion helpers never throw.** `toPriority`, `toCalendarDate`, `toIsoTimestamp` (`src/lib/tasks.ts`) accept `unknown` and fall back to a safe default, because they parse LocalStorage data written by older app versions.

**Boundaries:** root `src/components/ErrorBoundary.tsx` wraps providers/router; every top-level route additionally defines `errorElement` in `src/router.tsx` (React Router swallows render errors before they reach the root).

## Logging

**Framework:** none. `src/lib/monitoring.ts` is the single sink.

**Patterns:**
- Call `captureError(error, context?)` from `src/lib/monitoring.ts`; never import Sentry directly (it is lazily `import()`-ed so it stays out of the main bundle and out of the PWA precache).
- With no `VITE_SENTRY_DSN`, `captureError` logs `console.error('Yakalanan hata:', error, context)`. Do not swallow errors silently.
- No `console.log` in shipped code paths.

## Comments

**When to Comment:**
- Comments are **in Turkish** and explain *why*, not *what*. This codebase comments every non-obvious decision, especially traps that already caused a real bug (RLS GRANT, `Boolean("false")`, Playwright locale, module-order/i18n seeding, `dist/` cleaning).
- Legacy-data and migration reasoning is always documented next to the mapping table (`LEGACY_PRIORITIES` in `src/lib/tasks.ts`, `LEGACY_FILTERS` in `src/store/index.ts`).

**JSDoc/TSDoc:**
- `/** ... */` on exported functions, interfaces, and non-obvious fields. Individual interface fields carry doc comments where the format matters (`/** '#rrggbb' — veritabanı kısıtı da bu biçimi zorunlu tutar. */` in `src/lib/types.ts`).
- Multi-paragraph doc blocks for anything with history or a hazard (`src/lib/types.ts` `Priority`, `Task.dueDate`).

## Function Design

**Size:** small and single-purpose. Complex logic is extracted into pure modules (`src/lib/sync-merge.ts`) so it is unit-testable without network.

**Parameters:**
- 3+ related arguments become a single object: `mergeTasks({ local, remote, dirtyIds, tombstones })`.
- Optional configuration as a trailing `options` object with a default `= {}` (see `addTask` in `e2e/helpers.ts`).
- Accept `unknown` at data boundaries and narrow inside.

**Return Values:**
- Prefer plain data (a "plan" object) over side effects: `mergeTasks` returns `{ tasks, toPush, toDelete, discardedIds }` and the caller performs I/O.
- `readonly` arrays in signatures where input is not mutated.

## Module Design

**Exports:**
- Named exports only; no default exports for components or helpers (`src/i18n/index.ts` default-exports the i18n instance, which is the exception).
- Test-only escape hatches are explicit and suffixed: `resetMonitoringForTests()`.

**Barrel Files:** not used for components. `src/store/index.ts` and `src/i18n/index.ts` are real modules, not re-export barrels.

**Layering rules:**
- `src/lib/*` must not import from `src/components/*`.
- Pure merge/mapping modules must not perform network calls — that belongs in `src/lib/task-repository.ts` and `src/lib/sync.ts`.
- Feature toggles are read only from `src/config/features.ts`; never read `import.meta.env` flags inline.
- `src/lib/categories.ts` imports i18n directly on purpose (store seeds run at module-body time).

---

*Convention analysis: 2026-08-14*
