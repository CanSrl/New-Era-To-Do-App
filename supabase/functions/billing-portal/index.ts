import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchCustomerPortalUrl } from '../_shared/billing/lemonsqueezy.ts';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors });

    const auth = req.headers.get('Authorization');
    if (!auth) return new Response('unauthorized', { status: 401, headers: cors });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return new Response('unauthorized', { status: 401, headers: cors });

    const { data: sub } = await supabase
        .from('subscriptions')
        .select('provider_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!sub) return new Response('not found', { status: 404, headers: cors });

    try {
        const url = await fetchCustomerPortalUrl({
            apiKey: Deno.env.get('LEMONSQUEEZY_API_KEY') ?? '',
            subscriptionId: sub.provider_subscription_id,
        });
        return new Response(JSON.stringify({ url }), {
            headers: { ...cors, 'Content-Type': 'application/json' },
        });
    } catch {
        return new Response('portal failed', { status: 502, headers: cors });
    }
});
