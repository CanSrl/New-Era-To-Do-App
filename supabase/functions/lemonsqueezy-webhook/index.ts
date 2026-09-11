import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseEvent, verifySignature } from '../_shared/billing/lemonsqueezy.ts';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-signature',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors });

    const secret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET') ?? '';
    const rawBody = await req.text();
    const signature = req.headers.get('X-Signature') ?? '';

    if (!(await verifySignature(rawBody, signature, secret))) {
        return new Response('invalid signature', { status: 401, headers: cors });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new Response('invalid json', { status: 400, headers: cors });
    }

    const event = parseEvent(payload);
    if (!event) return new Response('ignored', { status: 200, headers: cors });

    const expectTest = Deno.env.get('LEMONSQUEEZY_TEST_MODE') === 'true';
    if (event.testMode !== expectTest) {
        return new Response('test_mode mismatch', { status: 200, headers: cors });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let userId = event.userId;
    if (event.name === 'subscription_created') {
        if (!userId) return new Response('missing user_id', { status: 400, headers: cors });
    } else {
        const { data: existing } = await supabase
            .from('subscriptions')
            .select('user_id, updated_at')
            .eq('provider_subscription_id', event.providerSubscriptionId)
            .maybeSingle();
        if (!existing) return new Response('unknown subscription', { status: 200, headers: cors });
        if (event.updatedAt <= existing.updated_at) {
            return new Response('stale', { status: 200, headers: cors });
        }
        userId = existing.user_id;
    }

    const row = {
        user_id: userId,
        provider: 'lemonsqueezy',
        provider_subscription_id: event.providerSubscriptionId,
        provider_customer_id: event.providerCustomerId,
        status: event.status,
        variant_id: event.variantId,
        renews_at: event.renewsAt,
        ends_at: event.endsAt,
        trial_ends_at: event.trialEndsAt,
        test_mode: event.testMode,
        updated_at: event.updatedAt,
    };

    const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'user_id' });
    if (error) return new Response(error.message, { status: 500, headers: cors });

    return new Response('ok', { status: 200, headers: cors });
});
