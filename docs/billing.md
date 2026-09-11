# Billing (LemonSqueezy)

Pro gating is database-enforced. The UI is a twin of that gate, not a replacement.

## What to configure

Edge Function secrets (never `VITE_`):

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_WEBHOOK_SECRET`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_VARIANT_ID`
- `LEMONSQUEEZY_TEST_MODE` (`true` locally, `false` in production)
- `SUPABASE_SERVICE_ROLE_KEY` (already on the functions runtime)

Client:

- `VITE_BILLING=true` to register `/app/billing` and show upgrade actions.

Webhook URL: `/functions/v1/lemonsqueezy-webhook` with `verify_jwt = false`. Signature is HMAC-SHA256 of the **raw** body (`X-Signature`).

## Switching providers

Provider-specific code lives in `supabase/functions/_shared/billing/lemonsqueezy.ts` behind `provider.ts`. Replace that file, keep `SubscriptionEvent`, and leave `is_pro` / `src/lib/billing.ts` mapping in sync.

## Removing billing

1. Delete `supabase/migrations/20260901130000_billing_gate.sql` (the client INSERT cap).
2. Optionally delete `20260901120000_billing.sql` if you do not need `subscriptions`.
3. Leave `VITE_BILLING` unset (default off) so the billing route is not registered.

If you keep the gate migration and turn the flag off, free users hit the limit with no upgrade path.
