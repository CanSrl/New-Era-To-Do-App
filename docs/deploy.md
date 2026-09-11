# Deploy

Static SPA. Build output is `dist/`. `VITE_*` values are baked in at **build** time — set them on the host before the build, not only at runtime.

## Environment on the host

| Name | Required | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | for auth/sync | Hosted project URL |
| `VITE_SUPABASE_ANON_KEY` | for auth/sync | Anon JWT; RLS-protected |
| `VITE_NICHE_MODULE` | no | Default on; `false` to strip |
| `VITE_BILLING` | no | `true` only after LemonSqueezy secrets exist |
| `VITE_AUTH_GITHUB` | no | Also enable the provider in Supabase |
| `VITE_SENTRY_DSN` | no | Empty = no Sentry chunk |

Do not set `SUPABASE_SERVICE_ROLE_KEY` or LemonSqueezy keys as `VITE_*`. Those go on **Supabase Edge Function secrets**.

After deploy, add the production origin to Supabase **Authentication → URL Configuration** (`https://<domain>/auth/callback` and `https://<domain>/reset-password` as used by the app). Exact match only.

## Vercel

`vercel.json` already has:

- SPA rewrite to `index.html` (except hashed assets)
- Security headers (CSP, `nosniff`, `DENY` framing, referrer, permissions, HSTS)

Connect the GitHub repo, set the env table, deploy. Framework preset: Vite. Output: `dist`. Install command should keep `--legacy-peer-deps` if the host’s npm is strict about peer ranges (`npm install --legacy-peer-deps`).

## Netlify

`public/_redirects` and `public/_headers` are the twins of `vercel.json`. Vite copies `public/` into `dist/`.

- Build: `npm run build`
- Publish directory: `dist`
- Same `VITE_*` env as above

`_headers` and `vercel.json` **must stay in lockstep**. A policy change in only one file means the app is protected differently depending on the host — you will only notice in production with `curl -I`.

## Security headers (live check)

After a URL exists, confirm (Phase 1 leftover):

```bash
curl -sI https://<your-domain>/
```

Expect:

- `content-security-policy` including `frame-ancestors 'none'`
- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: strict-origin-when-cross-origin`

There is no live demo URL in this repo yet; that step is the publisher’s.

## Edge Functions (billing)

Deploy functions with the Supabase CLI against the linked cloud project. Webhook `lemonsqueezy-webhook` has `verify_jwt = false` (LemonSqueezy cannot send a Supabase JWT). Signature verification is the only gate. See [billing.md](./billing.md).

## PWA

`start_url` is `/app` in `vite.config.ts`. If the marketing page path changes, update that too or an installed app opens the landing page instead of tasks.
