# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-12

First packaged starter-kit cut. Live LemonSqueezy checkout is not verified
(store activation is still a human step).

### Added

- Local-first task app with optional Supabase auth and multi-device sync
- Niche module: clients, projects, delivery view, timers, time logs, CSV export
- Feature flag `VITE_NICHE_MODULE` with `npm run verify:niche` (markers + size)
- Billing schema, Pro client cap (1 client on the free plan), `SyncOutcome.blocked`
- LemonSqueezy adapter + webhook / checkout / portal Edge Functions
- `/app/billing` behind `RequireAuth` and `VITE_BILLING` (default off)
- English buyer docs under `docs/`
- `supabase/seed.sql` demo user `demo@example.com` / `demodemo1`

### Security

- RLS on all public tables; `anon` is granted nothing
- Security headers in `vercel.json` and `public/_headers` (live `curl -I` still pending a public URL)
- Secret-name guard so `VITE_` cannot carry service-role or webhook keys
