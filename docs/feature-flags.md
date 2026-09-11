# Feature flags

All flags are compile-time `VITE_*` strings. Parsing lives in `src/config/flag-parsing.ts` so Vite config and the app cannot disagree.

Two kinds:

| Kind | How it is stored | Default | What “off” means |
| --- | --- | --- | --- |
| Behaviour | `features.*` object | closed unless noted | Hide UI; code may stay in the bundle |
| Packaging | bare `const NICHE_MODULE` | **on** | Drop the module from the production bundle |

`isEnabled` only treats the text `"true"` as on. `Boolean("false")` is a trap and is tested.

`isEnabledByDefault` only treats `"false"` as off. Used for the niche module so a missing env var does not strip the buyer’s data from the UI.

## Flags

| Variable | Kind | Default | Effect |
| --- | --- | --- | --- |
| `VITE_NICHE_MODULE` | packaging | on | Clients, projects, delivery, time, CSV. Off → set `false` **and** see [niche-module.md](./niche-module.md) |
| `VITE_AUTH_GITHUB` | behaviour | off | GitHub button. Must also enable the provider in Supabase or users land on raw JSON |
| `VITE_BILLING` | behaviour | off | `/app/billing` and upgrade actions. Gate migration is independent |
| `VITE_SENTRY_DSN` | behaviour | unset | Error reporting; package not downloaded when empty |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | config | unset | Auth + sync. Missing → local-only |

## Never `VITE_`

These belong in Edge Function secrets / the host’s server env:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_WEBHOOK_SECRET`

`src/config/secret-leak.test.ts` fails the suite if a `VITE_` name looks like a secret (`VITE_SUPABASE_ANON_KEY` is the documented exception).

## Proving niche stripping

```bash
npm run verify:niche
```

Two proofs: twelve string markers absent when off and present when on, **and** the off build at least 20 KB smaller. A missing translation file can hide a marker without removing the module; the size floor exists because of that.
